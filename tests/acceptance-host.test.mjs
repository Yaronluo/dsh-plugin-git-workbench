import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
import { build } from 'esbuild'
import { loadTs } from './helpers/load-ts.mjs'

const { createEditorLauncher } = await loadTs('src/host/editor-launcher.ts')
const noIcons = { lookup: async commands => commands.map(() => undefined) }
const app = process.env.DSH_DESKTOP_APP_ROOT || (process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, 'Programs', 'DSH Desktop', 'resources', 'app') : '')
const modulePath = name => join(app, 'node_modules', '@deepseek-ai', name, 'lib', 'index.js')
const hostAvailable = app && existsSync(modulePath('cordis')) && existsSync(modulePath('dsh-host-webserver'))
const profile = process.env.USERPROFILE ? join(process.env.USERPROFILE, '.dsh', 'profiles', 'desktop') : ''
const puppeteerModule = process.env.DSH_PUPPETEER_MODULE || join(profile, 'node_modules', 'puppeteer-core', 'lib', 'puppeteer', 'puppeteer-core.js')
const browserPath = process.env.DSH_BROWSER_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
const browserAvailable = browserPath && existsSync(puppeteerModule)

/*
 * Local Windows editor timing evidence (measurement note, not a machine-independent assertion):
 * cold first listEditors() racing the constructor warm-up: 805.368ms initial run, 919.952ms traced rerun.
 * After a fresh default launcher's icon shell closed: first call 101.576ms; calls 2–6 were
 * 102.934, 101.566, 95.376, 106.372, 105.126ms. Five icons were present and zero PowerShell
 * shells started during those six post-warm calls. (One other warm sample was 207.380ms.)
 */

function git(cwd, args) {
  execFileSync('git', args, {
    cwd, timeout: 10_000, windowsHide: true, stdio: 'ignore',
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' },
  })
}

function makeRepo(parent, name = 'repo with spaces') {
  const repo = join(parent, name)
  mkdirSync(repo, { recursive: true })
  git(repo, ['init', '--quiet'])
  git(repo, ['config', 'user.email', 'acceptance@example.invalid'])
  git(repo, ['config', 'user.name', 'DSH acceptance'])
  writeFileSync(join(repo, 'tracked file.txt'), 'committed\n')
  // A tiny, valid 1x1 PNG. Its exact bytes are checked over the real blob route below.
  writeFileSync(join(repo, 'pixel.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pXcAAAAASUVORK5CYII=', 'base64'))
  git(repo, ['add', 'tracked file.txt', 'pixel.png'])
  git(repo, ['commit', '--quiet', '-m', 'acceptance base'])
  return repo
}

async function startRealHost(t, fallback) {
  const { Context } = await import(pathToFileURL(modulePath('cordis')).href)
  const { default: WebServer } = await import(pathToFileURL(modulePath('dsh-host-webserver')).href)
  const entry = await loadTs('src/index.ts')
  const ctx = new Context()
  t.after(async () => { await ctx.fiber.dispose() })
  ctx.provide('workspaceRegistry', {})
  await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
  const server = ctx.get('webServer')
  server.registerFallback((req, res) => {
    if (fallback && req.url === '/fixture') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div></body></html>')
      return
    }
    res.writeHead(405); res.end('Method Not Allowed')
  })
  await ctx.plugin(entry)
  return { ctx, server, base: `http://127.0.0.1:${server.port}` }
}

async function postRoute(base, endpoint, payload) {
  const response = await fetch(`${base}/dsh-git/${endpoint}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  })
  return { response, body: await response.json() }
}

const pathKey = value => resolve(value).replace(/\\/g, '/').toLowerCase()

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForArgv(logPath, count, timeoutMs = 5_000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    if (existsSync(logPath)) {
      const lines = readFileSync(logPath, 'utf8').split(/\r?\n/).filter(Boolean)
      if (lines.length >= count) return lines.map(line => JSON.parse(line))
    }
    await wait(25)
  }
  throw new Error(`Timed out waiting for ${count} argv record(s) in ${logPath}`)
}

function createFakeCmd(directory, fileName) {
  mkdirSync(directory, { recursive: true })
  const capture = join(directory, 'capture.mjs')
  const logPath = join(directory, 'argv.jsonl')
  const command = join(directory, fileName)
  writeFileSync(capture, [
    "import { appendFileSync } from 'node:fs'",
    "import { dirname, join } from 'node:path'",
    "import { fileURLToPath } from 'node:url'",
    "appendFileSync(join(dirname(fileURLToPath(import.meta.url)), 'argv.jsonl'), `${JSON.stringify(process.argv.slice(2))}\\n`) ",
  ].join('\n'), 'utf8')
  writeFileSync(command, `@echo off\r\n"${process.execPath}" "%~dp0capture.mjs" %*\r\n`, 'utf8')
  return { command, logPath }
}

class SseStatuses {
  constructor(reader) {
    this.reader = reader
    this.buffer = ''
    this.queue = []
    this.waiters = []
    this.failure = undefined
    this.heartbeats = 0
    this.done = false
    this.pumpPromise = this.pump()
  }

  deliver(status) {
    const waiter = this.waiters.shift()
    if (waiter) {
      clearTimeout(waiter.timer)
      waiter.resolve(status)
    } else this.queue.push(status)
  }

  fail(error) {
    this.failure = error
    for (const waiter of this.waiters.splice(0)) {
      clearTimeout(waiter.timer)
      waiter.reject(error)
    }
  }

  async pump() {
    const decoder = new TextDecoder()
    try {
      while (true) {
        const { value, done } = await this.reader.read()
        if (done) { this.done = true; this.fail(new Error('SSE stream ended')); return }
        this.buffer += decoder.decode(value, { stream: true })
        let boundary
        while ((boundary = this.buffer.indexOf('\n\n')) >= 0) {
          const frame = this.buffer.slice(0, boundary).replace(/\r/g, '')
          this.buffer = this.buffer.slice(boundary + 2)
          let event = ''
          const data = []
          for (const line of frame.split('\n')) {
            if (line.startsWith(': ping')) this.heartbeats += 1
            else if (line.startsWith('event:')) event = line.slice(6).trim()
            else if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
          }
          if (event === 'status') this.deliver(JSON.parse(data.join('\n')))
        }
      }
    } catch (error) { this.done = true; this.fail(error) }
  }

  nextStatus(timeoutMs) {
    if (this.queue.length) return Promise.resolve(this.queue.shift())
    if (this.failure) return Promise.reject(this.failure)
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject, timer: undefined }
      waiter.timer = setTimeout(() => {
        this.waiters = this.waiters.filter(item => item !== waiter)
        reject(new Error(`No status event within ${timeoutMs}ms`))
      }, timeoutMs)
      this.waiters.push(waiter)
    })
  }
}

test('chosen fake editor CLIs receive separate argv elements (plain and JetBrains)', {
  skip: process.platform !== 'win32' && 'The acceptance check needs real Windows .cmd launch semantics',
  timeout: 20_000,
}, async t => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-git-acceptance-editor-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const repo = makeRepo(root)
  const plainBin = join(root, 'fake bin', 'plain')
  const ideaBin = join(root, 'fake bin', 'jetbrains')
  const plain = createFakeCmd(plainBin, 'plain-editor.cmd')
  const idea = createFakeCmd(ideaBin, 'idea.cmd')
  assert.equal(existsSync(plain.command.replace(/\.cmd$/i, '.exe')), false, 'plain CLI is an exe-less .cmd shim')
  assert.equal(existsSync(idea.command.replace(/\.cmd$/i, '.exe')), false, 'JetBrains-style CLI is an exe-less .cmd shim')

  const env = { ...process.env, PATH: `${plainBin};${ideaBin};${process.env.PATH ?? ''}` }
  const plainLauncher = createEditorLauncher({ env: { ...env, DSH_GIT_EDITOR: plain.command }, appIcons: noIcons })
  const [plainChoice] = await plainLauncher.listEditors()
  assert.equal(plainChoice.command, plain.command)
  const plainTarget = join(repo, 'tracked file.txt')
  const plainResult = await plainLauncher.open({ repo, file: 'tracked file.txt' }, plainChoice.command)
  assert.equal(plainResult.ok, true)
  const plainArgv = (await waitForArgv(plain.logPath, 1))[0]
  assert.deepEqual(plainArgv, [plainTarget])

  const ideaLauncher = createEditorLauncher({ env: { ...env, DSH_GIT_EDITOR: idea.command }, appIcons: noIcons })
  const [ideaChoice] = await ideaLauncher.listEditors()
  assert.equal(ideaChoice.command, idea.command)
  const ideaTarget = join(repo, 'tracked file.txt')
  const ideaResult = await ideaLauncher.open({ repo, file: 'tracked file.txt', line: 37 }, ideaChoice.command)
  assert.equal(ideaResult.ok, true)
  const ideaArgv = (await waitForArgv(idea.logPath, 1))[0]
  assert.deepEqual(ideaArgv, ['--line', '37', ideaTarget])
  t.diagnostic(JSON.stringify({ plainArgv, ideaArgv }))
})

test('real Cordis SSE pushes a changed revision after a tracked-file edit and stays quiet otherwise', {
  skip: !hostAvailable && 'Set DSH_DESKTOP_APP_ROOT to run against an installed DSH host',
  timeout: 20_000,
}, async t => {
  const { Context } = await import(pathToFileURL(modulePath('cordis')).href)
  const { default: WebServer } = await import(pathToFileURL(modulePath('dsh-host-webserver')).href)
  const { loadTs } = await import('./helpers/load-ts.mjs')
  const entry = await loadTs('src/index.ts')
  const root = mkdtempSync(join(tmpdir(), 'dsh-git-acceptance-sse-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const repo = makeRepo(root)

  const ctx = new Context()
  t.after(async () => { await ctx.fiber.dispose() })
  ctx.provide('workspaceRegistry', {})
  await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
  const server = ctx.get('webServer')
  server.registerFallback((_req, res) => { res.writeHead(405); res.end('Method Not Allowed') })
  await ctx.plugin(entry)
  const base = `http://127.0.0.1:${server.port}`

  const png = readFileSync(join(repo, 'pixel.png'))
  const blobUrl = `${base}/dsh-git/blob?path=${encodeURIComponent(repo)}&file=${encodeURIComponent('pixel.png')}`
  const blob = await fetch(blobUrl)
  assert.equal(blob.status, 200)
  assert.equal(blob.headers.get('content-type'), 'image/png')
  assert.deepEqual(Buffer.from(await blob.arrayBuffer()), png)
  // A tracked text file is deliberately sampled too: route behavior is reported honestly below.
  const textUrl = `${base}/dsh-git/blob?path=${encodeURIComponent(repo)}&file=${encodeURIComponent('tracked file.txt')}`
  const textBlob = await fetch(textUrl)
  assert.ok([200, 404].includes(textBlob.status), `unexpected non-image blob status ${textBlob.status}`)
  const unknownUrl = `${base}/dsh-git/blob?path=${encodeURIComponent(repo)}&file=${encodeURIComponent('not-an-image.txt')}`
  const unknownBlob = await fetch(unknownUrl)
  assert.equal(unknownBlob.status, 404)
  const unknownBody = await unknownBlob.json()
  assert.equal(unknownBody.ok, false)

  const abort = new AbortController()
  t.after(() => abort.abort())
  const response = await fetch(`${base}/dsh-git/events?path=${encodeURIComponent(repo)}`, { signal: abort.signal })
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /text\/event-stream/)
  const reader = response.body.getReader()
  const statuses = new SseStatuses(reader)
  const first = await statuses.nextStatus(10_000)
  assert.ok(first.revision)
  assert.ok(first.head)
  assert.equal(first.dirtyFiles, 0)

  const editStart = performance.now()
  writeFileSync(join(repo, 'tracked file.txt'), 'committed\nappended by acceptance\n', 'utf8')
  const changed = await statuses.nextStatus(10_000)
  const latencyMs = Number((performance.now() - editStart).toFixed(3))
  assert.notEqual(changed.revision, first.revision)
  assert.equal(changed.head, first.head)
  assert.equal(changed.dirtyFiles, 1)

  const quietStart = performance.now()
  await assert.rejects(statuses.nextStatus(7_000), /No status event within 7000ms/)
  const quietMs = Number((performance.now() - quietStart).toFixed(3))
  assert.equal(statuses.queue.length, 0)
  assert.equal(statuses.done, false)
  t.diagnostic(JSON.stringify({
    repo, latencyMs, first: { revision: first.revision, head: first.head, dirtyFiles: first.dirtyFiles },
    changed: { revision: changed.revision, head: changed.head, dirtyFiles: changed.dirtyFiles },
    quietMs, heartbeatsDuringQuiet: statuses.heartbeats,
    image: { status: blob.status, contentType: blob.headers.get('content-type'), bytes: png.length },
    nonImage: { trackedTextStatus: textBlob.status, contentType: textBlob.headers.get('content-type'), unknownPathStatus: unknownBlob.status, error: unknownBody.error },
  }))
  await reader.cancel()
  abort.abort()
})

test('real Cordis host scopes two repos, rejects missing upstream, and retries worktree open without recreating it', {
  skip: (!hostAvailable || !browserAvailable) && 'Set DSH_DESKTOP_APP_ROOT and install/configure headless Chrome/Puppeteer',
  timeout: 20_000,
}, async t => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-git-real-host-acceptance-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const alpha = makeRepo(root, 'repo-alpha')
  const beta = makeRepo(root, 'repo-beta')
  const remote = join(root, 'alpha-remote.git')
  git(alpha, ['branch', '-M', 'main'])
  git(root, ['init', '--bare', '--quiet', remote])
  git(alpha, ['remote', 'add', 'origin', remote])
  git(alpha, ['push', '--quiet', '--set-upstream', 'origin', 'main'])
  writeFileSync(join(alpha, 'upstream-only.txt'), 'UPSTREAM_SENTINEL\n')
  git(alpha, ['add', 'upstream-only.txt'])
  git(alpha, ['commit', '--quiet', '-m', 'alpha local commit'])
  writeFileSync(join(alpha, 'working-only.txt'), 'WORKING_SENTINEL\n')
  git(beta, ['branch', '-M', 'beta-main'])
  writeFileSync(join(beta, 'beta-only.txt'), 'BETA_SENTINEL\n')

  const { base } = await startRealHost(t, true)
  const sessionAlpha = 'acceptance-session-alpha'
  const sessionBeta = 'acceptance-session-beta'
  const alphaStatusResult = await postRoute(base, 'status', { path: alpha })
  const betaStatusResult = await postRoute(base, 'status', { path: beta })
  assert.equal(alphaStatusResult.body.ok, true)
  assert.equal(betaStatusResult.body.ok, true)
  const alphaStatus = alphaStatusResult.body.value
  const betaStatus = betaStatusResult.body.value
  assert.equal(alphaStatus.branch, 'main')
  assert.equal(alphaStatus.upstream, 'origin/main')
  assert.equal(betaStatus.branch, 'beta-main')
  assert.equal(betaStatus.upstream, undefined)

  const alphaDiffResult = await postRoute(base, 'diff', { path: alpha })
  const alphaUpstreamDiff = await postRoute(base, 'diff', { path: alpha, base: 'origin/main', target: 'HEAD' })
  const betaDiffResult = await postRoute(base, 'diff', { path: beta })
  assert.equal(alphaDiffResult.body.ok, true)
  assert.equal(alphaUpstreamDiff.body.ok, true)
  assert.equal(betaDiffResult.body.ok, true)
  const alphaFiles = alphaDiffResult.body.value.files.map(file => file.path)
  const alphaUpstreamFiles = alphaUpstreamDiff.body.value.files.map(file => file.path)
  const betaFiles = betaDiffResult.body.value.files.map(file => file.path)
  assert.ok(alphaFiles.includes('working-only.txt'))
  assert.ok(alphaUpstreamFiles.includes('upstream-only.txt'))
  assert.deepEqual(betaFiles, ['beta-only.txt'])

  const betaRemotes = await postRoute(base, 'remotes', { path: beta })
  assert.equal(betaRemotes.body.ok, true)
  assert.deepEqual(betaRemotes.body.value, [])
  const invalidUpstream = await postRoute(base, 'diff', { path: beta, base: 'origin/main', target: 'HEAD' })
  assert.ok(invalidUpstream.response.status >= 400)
  assert.equal(invalidUpstream.body.ok, false)
  assert.ok(invalidUpstream.body.error, 'the host must return a real ref error, not a successful empty diff')

  const alphaWorktreeName = `alpha-${Date.now().toString(36)}`
  const alphaCreated = await postRoute(base, 'create-worktree', { path: alpha, name: alphaWorktreeName })
  assert.equal(alphaCreated.body.ok, true, alphaCreated.body.error)
  const alphaWorktrees = await postRoute(base, 'worktrees-status', { path: alpha })
  const betaWorktrees = await postRoute(base, 'worktrees-status', { path: beta })
  assert.equal(alphaWorktrees.body.value.length, 2)
  assert.equal(betaWorktrees.body.value.length, 1)
  assert.ok(alphaWorktrees.body.value.some(item => pathKey(item.path) === pathKey(alphaCreated.body.path)), JSON.stringify({ created: alphaCreated.body.path, worktrees: alphaWorktrees.body.value }))
  assert.ok(!betaWorktrees.body.value.some(item => pathKey(item.path) === pathKey(alphaCreated.body.path)))

  // Resolve two real Session snapshots and exercise the real per-(session,cwd) view store.
  const { resolveWorkspaceCwd } = await loadTs('src/client/cwd-resolver.ts')
  const { activeGitView, setActiveGitView } = await loadTs('src/client/panels/navigation.ts')
  const snapshots = { sessions: { byId: {
    [sessionAlpha]: { id: sessionAlpha, cwd: alpha },
    [sessionBeta]: { id: sessionBeta, cwd: beta },
  } }, workspaces: { items: [
    { workspaceId: 'alpha-workspace', path: alpha, sessionIds: [sessionAlpha] },
    { workspaceId: 'beta-workspace', path: beta, sessionIds: [sessionBeta] },
  ] } }
  assert.equal(resolveWorkspaceCwd({ sessionId: sessionAlpha }, snapshots), alpha)
  assert.equal(resolveWorkspaceCwd({ sessionId: sessionBeta }, snapshots), beta)
  assert.equal(resolveWorkspaceCwd({ sessionId: 'unknown-session' }, snapshots), '')
  setActiveGitView(sessionAlpha, alpha, 'worktrees')
  setActiveGitView(sessionBeta, beta, 'history')
  assert.equal(activeGitView(sessionAlpha, alpha), 'worktrees')
  assert.equal(activeGitView(sessionBeta, beta), 'history')
  assert.equal(activeGitView(sessionAlpha, beta), 'changes', 'a mismatched repo cannot inherit another session/repo view')

  assert.ok(browserAvailable, 'this machine needs the configured headless Chrome/Puppeteer for real component assertions')
  const { default: puppeteer } = await import(pathToFileURL(puppeteerModule).href)
  const bundled = await build({
    stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
      import React from 'react'; import {createRoot} from 'react-dom/client';
      import {ChangesTab} from './src/client/diff/ChangesTab.tsx';
      import {writeWorkbenchUiState} from './src/client/diff/workbench-state.ts';
      import {CreateWorktreeDialog} from './src/client/dialogs/WorktreeDialogs.tsx';
      import {createWorktreeOpener} from './src/client/workspace-actions.ts';
      const root=createRoot(document.getElementById('root'));
      window.__diffRequests=[]; window.__delayNextWorkingDiff=false; window.__delayedWorkingStarted=false; window.__delayedWorkingFinished=false;
      window.__createRequests=0; window.__workspaceEvents=[]; window.__failNextOpen=false; window.__worktreeClosed=false;
      const realFetch=window.fetch.bind(window);
      window.fetch=async(input,init={})=>{
        const url=String(input);
        if(url==='/dsh-git/create-worktree'&&init.method==='POST') window.__createRequests++;
        if(url==='/dsh-git/diff'&&init.method==='POST'){
          const body=JSON.parse(init.body||'{}');
          window.__diffRequests.push({path:body.path,base:body.base??null,target:body.target??null});
          const response=await realFetch(input,init);
          if(window.__delayNextWorkingDiff&&body.base==='HEAD'&&!body.target){
            window.__delayNextWorkingDiff=false;const text=await response.text();window.__delayedWorkingStarted=true;
            await new Promise(resolve=>setTimeout(resolve,1200));window.__delayedWorkingFinished=true;
            return new Response(text,{status:response.status,headers:{'content-type':response.headers.get('content-type')||'application/json'}});
          }
          return response;
        }
        return realFetch(input,init);
      };
      window.mountChanges=(cwd,sessionId,compareTarget)=>{
        writeWorkbenchUiState(sessionId,cwd,{selectedFile:null,compareTarget,compareScope:'all',focusedFile:null,commitMessage:'',fileListScrollTop:0,diffScrollTop:0});
        root.render(<ChangesTab key={sessionId+cwd} cwd={cwd} sessionId={sessionId}/>);
      };
      window.mountWorktree=(cwd,branch)=>{
        window.__workspaceEvents=[];window.__failNextOpen=true;window.__worktreeClosed=false;
        const opener=createWorktreeOpener({
          workspaces:{create:async({path})=>{const workspaceId='workspace-'+(window.__workspaceEvents.filter(e=>e.type==='create').length+1);window.__workspaceEvents.push({type:'create',path,workspaceId});return{workspaceId}}},
          uiWorkspace:{openWorkspace:async workspaceId=>{window.__workspaceEvents.push({type:'open',workspaceId});if(window.__failNextOpen){window.__failNextOpen=false;throw new Error('Injected open failure')}}}
        });
        root.render(<CreateWorktreeDialog path={cwd} currentBranch={branch} onClose={()=>{window.__worktreeClosed=true}} onOpenWorktree={opener}/>);
      };
    ` },
    bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'process.env.NODE_ENV': '"development"' },
  })
  const browser = await puppeteer.launch({ executablePath: browserPath, headless: true, timeout: 10_000, args: ['--no-first-run', '--disable-background-networking'] })
  t.after(() => browser.close())
  const page = await browser.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  const fixtureResponse = await page.goto(`${base}/fixture`, { waitUntil: 'domcontentloaded', timeout: 5_000 })
  assert.equal(fixtureResponse.status(), 200)
  await page.addScriptTag({ content: bundled.outputFiles[0].text })

  await page.evaluate(path => { window.__delayNextWorkingDiff = true; window.mountChanges(path, 'browser-alpha', 'working-head') }, alpha)
  await page.waitForFunction(() => window.__delayedWorkingStarted, { timeout: 7_000 })
  await page.click('.dsh-git-compare-trigger')
  await page.evaluate(() => [...document.querySelectorAll('.dsh-git-compare-option')].find(button => button.textContent.includes('与上游分支对比')).click())
  await page.waitForFunction(() => document.body.textContent.includes('UPSTREAM_SENTINEL'), { timeout: 7_000 })
  const upstreamLabel = await page.$eval('.dsh-git-compare-trigger', node => node.textContent)
  await page.waitForFunction(() => window.__delayedWorkingFinished, { timeout: 5_000 })
  await new Promise(resolve => setTimeout(resolve, 100))
  const afterStale = await page.evaluate(() => ({
    text: document.body.textContent,
    requests: window.__diffRequests,
  }))
  assert.match(upstreamLabel, /main.*origin\/main/)
  assert.match(afterStale.text, /UPSTREAM_SENTINEL/)
  assert.doesNotMatch(afterStale.text, /WORKING_SENTINEL/)
  assert.ok(afterStale.requests.some(request => request.base === 'origin/main' && request.target === 'HEAD'))

  await page.evaluate(path => window.mountChanges(path, 'browser-beta', 'branch-upstream'), beta)
  await page.waitForFunction(() => [...document.querySelectorAll('[role="alert"]')].some(node => node.textContent.includes('当前分支未配置上游，无法对比。')), { timeout: 7_000 })
  const betaUi = await page.evaluate(() => ({
    error: [...document.querySelectorAll('[role="alert"]')].map(node => node.textContent).find(text => text.includes('当前分支未配置上游')),
    diffRequests: window.__diffRequests.filter(request => request.path.endsWith('repo-beta')),
  }))
  assert.equal(betaUi.error, '当前分支未配置上游，无法对比。')
  assert.equal(betaUi.diffRequests.length, 0, 'no-upstream is explicit instead of a fabricated empty diff')

  const worktreeName = `retry-${Date.now().toString(36)}`
  await page.evaluate((path, branch) => window.mountWorktree(path, branch), beta, 'beta-main')
  await page.focus('input[placeholder="例如 feature-login"]')
  await page.type('input[placeholder="例如 feature-login"]', worktreeName)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent.includes('已创建：') && document.querySelector('[role="alert"]')?.textContent.includes('Injected open failure'), { timeout: 10_000 })
  const failedOpen = await page.evaluate(() => ({
    status: document.querySelector('[role="status"]')?.textContent,
    error: document.querySelector('[role="alert"]')?.textContent,
    retry: [...document.querySelectorAll('button')].find(button => button.type === 'submit')?.textContent,
    createRequests: window.__createRequests,
    workspaceEvents: window.__workspaceEvents,
  }))
  assert.equal(failedOpen.retry, '重试打开工作区')
  assert.equal(failedOpen.createRequests, 1)
  const createdPath = failedOpen.status.replace(/^已创建：/, '')
  assert.equal(failedOpen.workspaceEvents[0].type, 'create')
  assert.equal(failedOpen.workspaceEvents[0].path, createdPath)
  assert.equal(failedOpen.workspaceEvents[1].type, 'open')
  assert.match(failedOpen.error, /工作树已保留，可重试打开/)
  assert.ok(existsSync(createdPath), 'the actual Git worktree remains after open failure')

  await page.click('button[type="submit"]')
  await page.waitForFunction(() => window.__worktreeClosed, { timeout: 5_000 })
  const retried = await page.evaluate(() => ({ createRequests: window.__createRequests, events: window.__workspaceEvents }))
  assert.equal(retried.createRequests, 1, 'retry must reuse createdPath without another Git create-worktree request')
  assert.deepEqual(retried.events.map(event => event.type), ['create', 'open', 'create', 'open'])
  assert.deepEqual(retried.events.filter(event => event.type === 'create').map(event => event.path), [createdPath, createdPath])
  assert.deepEqual(retried.events.filter(event => event.type === 'open').map(event => event.workspaceId), ['workspace-1', 'workspace-2'])

  const betaWorktreesAfterRetry = await postRoute(base, 'worktrees-status', { path: beta })
  assert.equal(betaWorktreesAfterRetry.body.value.length, 2)
  const listed = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: beta, encoding: 'utf8', timeout: 10_000, windowsHide: true })
  assert.equal(listed.split(/\r?\n/).filter(line => line.startsWith('worktree ')).length, 2)
  assert.ok(listed.split(/\r?\n/).some(line => line.startsWith('worktree ') && pathKey(line.slice('worktree '.length)) === pathKey(createdPath)))
  assert.deepEqual(pageErrors, [])
  t.diagnostic(JSON.stringify({
    repos: { alpha: { path: alpha, branch: alphaStatus.branch, upstream: alphaStatus.upstream, diffFiles: alphaFiles, worktrees: alphaWorktrees.body.value.map(item => item.path) },
      beta: { path: beta, branch: betaStatus.branch, upstream: betaStatus.upstream, diffFiles: betaFiles, remotes: betaRemotes.body.value, missingUpstream: { status: invalidUpstream.response.status, error: invalidUpstream.body.error }, worktreesAfterRetry: betaWorktreesAfterRetry.body.value.map(item => item.path) } },
    sessions: { [sessionAlpha]: resolveWorkspaceCwd({ sessionId: sessionAlpha }, snapshots), [sessionBeta]: resolveWorkspaceCwd({ sessionId: sessionBeta }, snapshots), viewAlpha: activeGitView(sessionAlpha, alpha), viewBeta: activeGitView(sessionBeta, beta) },
    comparison: { label: upstreamLabel, delayedOldDiffIgnored: !afterStale.text.includes('WORKING_SENTINEL'), requests: afterStale.requests },
    worktreeOpen: { failed: failedOpen, retried: retried.events, gitWorktreeCount: 2, pageErrors },
  }))
})

test('real Git host reports locked-worktree refusal and measures a single --force', {
  skip: !hostAvailable && 'Set DSH_DESKTOP_APP_ROOT to run against an installed DSH host',
  timeout: 20_000,
}, async t => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-git-locked-worktree-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const repo = makeRepo(root, 'repo-locked')
  const { base } = await startRealHost(t)
  const name = `locked-${Date.now().toString(36)}`
  const created = await postRoute(base, 'create-worktree', { path: repo, name })
  assert.equal(created.body.ok, true, created.body.error)
  const worktreePath = created.body.path
  const reason = 'acceptance lock reason'
  const locked = await postRoute(base, 'lock-worktree', { path: repo, worktreePath, reason })
  assert.equal(locked.body.ok, true, locked.body.error)

  const withoutForce = await postRoute(base, 'remove-worktree', { path: repo, worktreePath, force: false })
  const existsAfterNoForce = existsSync(worktreePath)
  assert.equal(withoutForce.body.ok, false)
  assert.equal(existsAfterNoForce, true, 'locked worktree must remain after ordinary remove')
  assert.match(withoutForce.body.error, /cannot remove a locked working tree/i)
  assert.match(withoutForce.body.error, /lock reason: acceptance lock reason/)

  // The host maps force:true to one `--force`; this captures whether this Git version needs -f twice.
  const withOneForce = await postRoute(base, 'remove-worktree', { path: repo, worktreePath, force: true })
  const existsAfterOneForce = existsSync(worktreePath)
  assert.equal(withOneForce.body.ok, false, 'one --force cannot remove a locked tree on the installed Git')
  assert.equal(existsAfterOneForce, true, 'a failed forced remove must retain the locked directory')
  assert.match(withOneForce.body.error, /cannot remove a locked working tree/i)
  assert.match(withOneForce.body.error, /use 'remove -f -f' to override or unlock first/)
  const worktrees = await postRoute(base, 'worktrees-status', { path: repo })
  assert.equal(worktrees.body.ok, true)
  assert.ok(worktrees.body.value.some(item => pathKey(item.path) === pathKey(worktreePath)), 'failed force leaves the worktree registered')
  t.diagnostic(JSON.stringify({
    worktreePath, lock: locked.body, reason,
    withoutForce: { result: withoutForce.body, directoryExists: existsAfterNoForce },
    oneForce: { result: withOneForce.body, directoryExists: existsAfterOneForce, registeredWorktrees: worktrees.body.value.map(item => item.path) },
  }))
})

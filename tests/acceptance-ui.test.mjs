import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { loadTs } from './helpers/load-ts.mjs'

const local = process.env.LOCALAPPDATA || ''
const profile = process.env.USERPROFILE ? join(process.env.USERPROFILE, '.dsh', 'profiles', 'desktop') : ''
const puppeteerModule = process.env.DSH_PUPPETEER_MODULE || join(profile, 'node_modules', 'puppeteer-core', 'lib', 'puppeteer', 'puppeteer-core.js')
const browserPath = process.env.DSH_BROWSER_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
const app = process.env.DSH_DESKTOP_APP_ROOT || join(local, 'Programs', 'DSH Desktop', 'resources', 'app')
const hostModule = join(app, 'node_modules', '@deepseek-ai', 'dsh-client-ui-conversation', 'lib', 'client.js')
const available = browserPath && existsSync(puppeteerModule) && existsSync(hostModule)
const skipReason = !available && 'Install DSH and Chrome, or set DSH_PUPPETEER_MODULE / DSH_BROWSER_PATH'

let browser
let bundleText
let hostCss
let className
let pluginCss
let compatibilityCss
let assertionCount = 0
const screenshotPaths = []
const screenshotFailures = []

const check = new Proxy(assert, {
  get(target, key) {
    const method = target[key]
    if (typeof method !== 'function') return method
    return (...args) => {
      assertionCount += 1
      return method.apply(target, args)
    }
  },
})

// Nine aliases come from the installed compatibility stylesheet at :root. Supplement only
// its six omissions from the installed theme table; dark mode follows prefers-color-scheme.
const lightTokens = `:root{--dsw-font-family:Arial,sans-serif;--ds-font-family-code:Consolas,monospace;--dsw-alias-bg-layer-2:#ffffff;--dsw-alias-bg-layer-3:#ffffff;--dsw-alias-bg-overlay:#e9ecf2;--dsw-alias-state-success-primary:#22c55e;--dsw-alias-state-warn-primary:#f59e0b;--dsw-alias-state-idle-primary:#d4d4d4;color-scheme:light}@media(prefers-color-scheme:dark){:root{--dsw-alias-bg-layer-2:#2c2c2e;--dsw-alias-bg-layer-3:#353638;--dsw-alias-bg-overlay:#61666b;--dsw-alias-state-success-primary:#22c55e;--dsw-alias-state-warn-primary:#f59e0b;--dsw-alias-state-idle-primary:#545557;color-scheme:dark}}`

before(async () => {
  if (!available) return

  const { default: puppeteer } = await import(pathToFileURL(puppeteerModule).href)
  const { sheetText } = await loadTs('src/client/styles.ts')
  const source = readFileSync(hostModule, 'utf8')
  const cssMatch = source.match(/const css\$4 = ("(?:[^"\\]|\\.)*");/)
  assert.ok(cssMatch, 'installed host ConversationRoot CSS must be available')
  hostCss = JSON.parse(cssMatch[1])
  const hostClasses = source.match(/var ConversationRoot_module_css_default = (\{[\s\S]*?\});/)
  assert.ok(hostClasses, 'installed host class map must be available')
  className = key => {
    const found = hostClasses[1].match(new RegExp('"' + key + '": "([^" ]+)"'))
    assert.ok(found, `host ${key} CSS class is available`)
    return found[1]
  }
  pluginCss = sheetText()
  const compatibilityPath = join(app, 'lib', 'native-ui', 'assets', 'compatibility-chrome-FdPoIB88.css')
  compatibilityCss = existsSync(compatibilityPath) ? readFileSync(compatibilityPath, 'utf8') : ''
  assert.ok(compatibilityCss, 'installed desktop compatibility token stylesheet must be available')

  const bundled = await build({
    stdin: { resolveDir: resolve('.'), loader: 'tsx', contents: `
      import React from 'react'; import {createRoot} from 'react-dom/client';
      import {GitWorkbenchPage} from './src/client/panels/GitWorkbenchPage.tsx';
      import {BranchChip} from './src/client/chips/BranchChip.tsx';
      import {CreateBranchDialog} from './src/client/dialogs/CreateBranchDialog.tsx';
      import {CreateWorktreeDialog} from './src/client/dialogs/WorktreeDialogs.tsx';
      function hooks(mount){
        return {
          useSessions:select=>select({byId:{[mount.sessionId]:{id:mount.sessionId,cwd:mount.path}}}),
          useWorkspaces:select=>select({items:[]}),
        };
      }
      const roots=[];
      for(const mount of window.__fixtureMounts||[]){
        const node=document.getElementById(mount.id); if(!node) continue;
        const root=createRoot(node); roots.push(root);
        if(mount.kind==='chip') root.render(<BranchChip cwd={mount.path} sessionId={mount.sessionId} {...hooks(mount)} onOpenGitPanel={async()=>{}}/>);
        else root.render(<GitWorkbenchPage cwd={mount.path} sessionId={mount.sessionId} onOpenGitSidechat={()=>{}} {...hooks(mount)} openView={()=>{}}/>);
      }
      function DirectDialogs(){
        const [which,setWhich]=React.useState(null);
        return <div>
          <button id="direct-branch-launch" type="button" onClick={()=>setWhich('branch')}>Open branch dialog</button>
          <button id="direct-worktree-launch" type="button" onClick={()=>setWhich('worktree')}>Open worktree dialog</button>
          {which==='branch'&&<CreateBranchDialog path="/repo" currentBranch="main" onClose={()=>setWhich(null)} onSuccess={()=>{}}/>}
          {which==='worktree'&&<CreateWorktreeDialog path="/repo" currentBranch="main" onClose={()=>setWhich(null)} onSuccess={()=>{}}/>}
        </div>;
      }
      const direct=document.getElementById('direct-fixture');
      if(direct) roots.push(createRoot(direct).render(<DirectDialogs/>));
    ` },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'git-acceptance-fixture', setup(api) {
      api.onResolve({ filter: /(?:^|\/)api\.js$/ }, () => ({ path: 'api', namespace: 'fixture' }))
      // Keep the production hook in the bundle; only the Git transport is in-memory.
      api.onResolve({ filter: /use-git-status\.js$/ }, () => ({ path: 'status', namespace: 'fixture' }))
      api.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', resolveDir: resolve('.'), contents: args.path === 'status'
        ? `export {useGitStatus} from './src/client/hooks/use-git-status.ts';`
        : `export const errorMessage=e=>e?.message||String(e); export const blobUrl=()=>''; export const getEndpointUrl=p=>p;
          export const gitApi=new Proxy({}, {get:(_,name)=>(...args)=>{
            const data=window.__gitData||{};
            if(name==='subscribeEvents'){
              const [path,onStatus,onError]=args;
              const stream={path,onStatus,onError,closed:false};
              (data.streams||(data.streams=[])).push(stream);
              (data.apiCalls||(data.apiCalls=[])).push({name,args:[path]});
              return ()=>{stream.closed=true};
            }
            if(name==='listEditors'){
              data.editorProbeCalls=(data.editorProbeCalls||0)+1;
              (data.apiCalls||(data.apiCalls=[])).push({name,args:[]});
              const probe=data.editorProbe||{};
              return probe.error?Promise.reject(new Error(probe.error)):Promise.resolve(probe.editors||[]);
            }
            const path=args[0]; const repo=(data.repos||{})[path]||{};
            (data.apiCalls||(data.apiCalls=[])).push({name,args:Array.from(args,(value,index)=>index===1&&value instanceof AbortSignal?'[signal]':value)});
            if(name==='getStatus') return Promise.resolve(repo.status);
            if(name==='getDiff'||name==='requestDiff') return Promise.resolve(repo.diff);
            if(name==='getBranches') return Promise.resolve(repo.branches||{current:repo.status?.branch||'main',branches:[],dirtyFiles:repo.status?.dirtyFiles||0});
            if(name==='getWorktreesWithStatus'||name==='getWorktrees') return Promise.resolve(repo.worktrees||[]);
            if(name==='getLog') return Promise.resolve(repo.commits||[]);
            if(name==='getCommitDetail') return Promise.resolve(repo.detail||{});
            if(name==='getFileHistory') return Promise.resolve(repo.fileHistory||[]);
            if(name==='getBlame') return Promise.resolve(repo.blame||{totalLines:0,lines:[]});
            if(name==='getReflog') return Promise.resolve(repo.reflog||[]);
            if(name==='getStashes') return Promise.resolve(repo.stashes||[]);
            if(name==='removeWorktree') return Promise.resolve((repo.removeResults||{})[args[1]]||repo.removeResult||{ok:true});
            if(name==='createWorktree') return Promise.resolve({ok:true,path:path+'/worktrees/'+args[1]});
            if(name==='createBranch') return Promise.resolve({ok:true,branch:args[1]});
            if(name==='getLastCommitMessage') return Promise.resolve('');
            return Promise.resolve({ok:true});
          }});` }))
    } }],
  })
  bundleText = bundled.outputFiles[0].text
  browser = await puppeteer.launch({ executablePath: browserPath, headless: true, args: ['--no-first-run', '--disable-background-networking'] })
})

after(async () => { if (browser) await browser.close() })

function statusFor(path, overrides = {}) {
  return {
    isGit: true,
    branch: 'main',
    head: 'head-1',
    revision: 'revision-1',
    root: path,
    dirtyFiles: 1,
    entries: [],
    conflicts: 0,
    ahead: 0,
    behind: 0,
    stashCount: 0,
    ...overrides,
  }
}

function diffFor(file, marker = 'PATCH_INITIAL') {
  return {
    base: 'HEAD',
    target: 'working',
    files: [{
      path: file,
      status: 'modified',
      insertions: 1,
      deletions: 1,
      binary: false,
      rawPatch: `diff --git a/${file} b/${file}\n+${marker}`,
      hunks: [{
        header: '@@ -1 +1 @@', oldStart: 1, newStart: 1, oldLines: 1, newLines: 1,
        lines: [
          { type: 'del', oldNum: 1, content: 'original value' },
          { type: 'add', newNum: 1, content: marker },
        ],
      }],
    }],
    totalInsertions: 1,
    totalDeletions: 1,
  }
}

function repoFor(path, options = {}) {
  return {
    status: statusFor(path, options.status),
    diff: diffFor(options.file || 'src/fixture.ts', options.patch || 'PATCH_INITIAL'),
    branches: options.branches || { current: options.status?.branch || 'main', branches: [{ name: options.status?.branch || 'main', current: true }], dirtyFiles: options.status?.dirtyFiles ?? 1 },
    worktrees: options.worktrees || [],
    commits: options.commits || [{ hash: 'abcdef0123456789abcdef0123456789abcdef01', shortHash: 'abcdef0', subject: 'Fixture commit', author: 'Example', date: '2026-10-16', parents: [], refs: [] }],
    detail: options.detail || { hash: 'abcdef0123456789abcdef0123456789abcdef01', shortHash: 'abcdef0', subject: 'Fixture commit', body: 'Fixture details', author: 'Example', authorEmail: 'example@test.invalid', committer: 'Example', date: '2026-10-16', commitDate: '2026-10-16', parents: [], files: [], totalInsertions: 0, totalDeletions: 0 },
    fileHistory: options.fileHistory || [{ hash: 'abcdef0123456789abcdef0123456789abcdef01', shortHash: 'abcdef0', subject: 'Fixture file history', author: 'Example', date: '2026-10-16' }],
    blame: options.blame || { totalLines: 1, lines: [] },
    removeResult: options.removeResult,
    removeResults: options.removeResults,
    stashes: [],
  }
}

function dataFor(paths, overrides = {}) {
  const repos = {}
  for (const path of paths) repos[path] = repoFor(path, overrides[path] || {})
  return { repos, editorProbe: { editors: [] } }
}

async function openFixture({ data, mounts, width = 1440, height = 900, directDialogs = false }) {
  if (!browser) throw new Error('Chromium fixture is unavailable')
  const page = await browser.newPage()
  await page.setViewport({ width, height })
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const shellCss = `html,body{height:100%;margin:0}#native{height:100%;display:flex;flex-direction:column}#fixture{display:contents}#fixture.fixture-split{display:flex;flex:1;min-width:0;min-height:0;gap:8px}#fixture.fixture-split>.fixture-mount{display:flex;flex:1 1 0;min-width:0;min-height:0;overflow:hidden}#direct-fixture{display:contents}`
  await page.setContent(`<style>${shellCss}${lightTokens}${compatibilityCss}${hostCss}${pluginCss}</style>
  <main id="native" class="${className('root')}"><header style="height:76px;flex:none;border-bottom:1px solid #eee">对话　轨迹　上下文　编队　Git</header>
    <div data-conversation-content class="${className('body')}"><div data-conversation-scroll class="${className('scrollBody')}">
      <div class="${className('viewArea')}"><div id="fixture"></div>${directDialogs ? '<div id="direct-fixture"></div>' : ''}</div>
      <div data-composer-seat class="${className('composerSeat')}">原聊天输入框</div>
    </div></div>
  </main>`)
  await page.evaluate(({ fixtureMounts, gitData }) => {
    window.__gitData = gitData
    window.__fixtureMounts = fixtureMounts
    const fixture = document.getElementById('fixture')
    if (fixtureMounts.length > 1) {
      fixture.classList.add('fixture-split')
      fixtureMounts.forEach(mount => {
        const node = document.createElement('div')
        node.id = mount.id
        node.className = 'fixture-mount'
        fixture.appendChild(node)
      })
    }
  }, { fixtureMounts: mounts, gitData: data })
  await page.addScriptTag({ content: bundleText })
  return { page, errors }
}

async function clickText(page, selector, text) {
  await page.evaluate(({ selector, text }) => {
    const root = document.querySelector(selector)
    const button = [...(root?.querySelectorAll('button') || [])].find(node => node.textContent.trim().includes(text))
    if (!button) throw new Error(`Missing button text ${text} in ${selector}`)
    button.click()
  }, { selector, text })
}

async function pushStatusSnapshot(page, path, changes) {
  const streams = await page.evaluate(({ path, changes }) => {
    const repo = window.__gitData.repos[path]
    repo.status = { ...repo.status, ...changes }
    const active = window.__gitData.streams.filter(stream => stream.path === path && !stream.closed)
    for (const stream of active) stream.onStatus({ ...repo.status })
    return active.length
  }, { path, changes })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  return streams
}

function workbenchMount(path, sessionId, id = 'fixture') {
  return { kind: 'workbench', path, sessionId, id }
}

// Acceptance item 1: repository identity must remain scoped to each simultaneously mounted session.
test('Acceptance 1: sessions retain their own branches and changes while visibility switches', { skip: skipReason, timeout: 60000 }, async t => {
  const data = dataFor(['/repo-alpha', '/repo-beta'], {
    '/repo-alpha': { status: { branch: 'alpha-branch', root: '/repo-alpha' }, file: 'alpha/only-alpha.ts', patch: 'ALPHA_PATCH' },
    '/repo-beta': { status: { branch: 'beta-branch', root: '/repo-beta' }, file: 'beta/only-beta.ts', patch: 'BETA_PATCH' },
  })
  const { page, errors } = await openFixture({
    data,
    mounts: [workbenchMount('/repo-alpha', 'session-alpha', 'alpha'), workbenchMount('/repo-beta', 'session-beta', 'beta')],
  })
  t.after(() => page.close())
  await page.waitForFunction(() => [...document.querySelectorAll('.dsh-git-workbench')].length === 2)
  await page.waitForFunction(() => [...document.querySelectorAll('.dsh-git-file-row')].length >= 2)

  async function snapshot(id) {
    return page.$eval(`#${id}`, node => ({
      branch: node.querySelector('.dsh-git-current-branch')?.textContent.trim(),
      path: node.querySelector('.dsh-git-workbench-path')?.textContent.trim(),
      fileText: node.querySelector('.dsh-git-file-row')?.textContent || '',
      patchText: node.querySelector('.dsh-git-diff-lines')?.textContent || '',
    }))
  }
  const alpha = await snapshot('alpha')
  const beta = await snapshot('beta')
  check.match(alpha.branch, /alpha-branch/)
  check.equal(alpha.path, '/repo-alpha')
  check.match(alpha.fileText, /only-alpha\.ts/)
  check.match(alpha.patchText, /ALPHA_PATCH/)
  check.doesNotMatch(alpha.fileText + alpha.patchText, /only-beta\.ts|BETA_PATCH/)
  check.match(beta.branch, /beta-branch/)
  check.equal(beta.path, '/repo-beta')
  check.match(beta.fileText, /only-beta\.ts/)
  check.match(beta.patchText, /BETA_PATCH/)
  check.doesNotMatch(beta.fileText + beta.patchText, /only-alpha\.ts|ALPHA_PATCH/)

  for (const visible of ['alpha', 'beta', 'alpha', 'beta']) {
    await page.evaluate(visibleId => {
      for (const id of ['alpha', 'beta']) document.getElementById(id).style.visibility = id === visibleId ? 'visible' : 'hidden'
    }, visible)
    const both = await Promise.all([snapshot('alpha'), snapshot('beta')])
    check.match(both[0].branch, /alpha-branch/)
    check.equal(both[0].path, '/repo-alpha')
    check.match(both[0].fileText + both[0].patchText, /only-alpha\.ts|ALPHA_PATCH/)
    check.doesNotMatch(both[0].fileText + both[0].patchText, /only-beta\.ts|BETA_PATCH/)
    check.match(both[1].branch, /beta-branch/)
    check.equal(both[1].path, '/repo-beta')
    check.match(both[1].fileText + both[1].patchText, /only-beta\.ts|BETA_PATCH/)
    check.doesNotMatch(both[1].fileText + both[1].patchText, /only-alpha\.ts|ALPHA_PATCH/)
  }
  check.deepEqual(errors, [])
})

// Acceptance item 2: exercise the real useGitStatus focus listener and ChangesTab's keyed diff refetch.
test('Acceptance 2: focus refreshes edited patches and branch changes with stable dirty counts', { skip: skipReason, timeout: 60000 }, async t => {
  const path = '/repo-refresh'
  const { page } = await openFixture({ data: dataFor([path], { [path]: { file: 'src/refresh.ts', patch: 'PATCH_BEFORE_EDIT' } }), mounts: [workbenchMount(path, 'refresh-session')] })
  t.after(() => page.close())
  await page.waitForFunction(() => document.querySelector('.dsh-git-diff-lines')?.textContent.includes('PATCH_BEFORE_EDIT'))

  const before = await page.evaluate(() => ({
    statusCalls: window.__gitData.apiCalls.filter(call => call.name === 'getStatus' && call.args[0] === '/repo-refresh').length,
    diffCalls: window.__gitData.apiCalls.filter(call => call.name === 'getDiff' && call.args[0] === '/repo-refresh').length,
  }))
  // The page-side source is data only; replace its current snapshot and patch with a new edit.
  await page.evaluate(() => {
    const repo = window.__gitData.repos['/repo-refresh']
    repo.status = { ...repo.status, head: 'head-after-edit', revision: 'revision-after-edit', dirtyFiles: 1 }
    repo.diff.files[0].rawPatch = 'diff --git a/src/refresh.ts b/src/refresh.ts\n+PATCH_AFTER_EDIT'
    repo.diff.files[0].hunks[0].lines[1].content = 'PATCH_AFTER_EDIT'
  })
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.waitForFunction(() => document.querySelector('.dsh-git-diff-lines')?.textContent.includes('PATCH_AFTER_EDIT'))
  const edited = await page.evaluate(() => ({
    calls: window.__gitData.apiCalls.filter(call => call.name === 'getStatus' && call.args[0] === '/repo-refresh').length,
    diffCalls: window.__gitData.apiCalls.filter(call => call.name === 'getDiff' && call.args[0] === '/repo-refresh').length,
    dirty: window.__gitData.repos['/repo-refresh'].status.dirtyFiles,
  }))
  check.ok(edited.calls > before.statusCalls, 'a window focus must reload Git status through the real hook')
  check.ok(edited.diffCalls > before.diffCalls, 'the revision/head change must refetch the diff')
  check.equal(edited.dirty, 1, 'the edited file count remains unchanged')
  check.match(await page.$eval('.dsh-git-diff-lines', node => node.textContent), /PATCH_AFTER_EDIT/)

  const editDiffCalls = edited.diffCalls
  await page.evaluate(() => {
    const repo = window.__gitData.repos['/repo-refresh']
    repo.status = { ...repo.status, branch: 'feature/switched', head: 'head-after-branch-switch', revision: 'revision-after-branch-switch', dirtyFiles: 1 }
    repo.diff.files[0].rawPatch = 'diff --git a/src/refresh.ts b/src/refresh.ts\n+PATCH_AFTER_BRANCH_SWITCH'
    repo.diff.files[0].hunks[0].lines[1].content = 'PATCH_AFTER_BRANCH_SWITCH'
  })
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.waitForFunction(() => document.querySelector('.dsh-git-diff-lines')?.textContent.includes('PATCH_AFTER_BRANCH_SWITCH'))
  const switched = await page.evaluate(() => ({
    branch: document.querySelector('.dsh-git-current-branch')?.textContent.trim(),
    dirty: window.__gitData.repos['/repo-refresh'].status.dirtyFiles,
    diffCalls: window.__gitData.apiCalls.filter(call => call.name === 'getDiff' && call.args[0] === '/repo-refresh').length,
  }))
  check.equal(switched.branch, 'feature/switched')
  check.equal(switched.dirty, 1)
  check.ok(switched.diffCalls > editDiffCalls, 'a branch/revision change refetches even with the same dirty count')
  check.match(await page.$eval('.dsh-git-diff-lines', node => node.textContent), /PATCH_AFTER_BRANCH_SWITCH/)

  await page.evaluate(() => {
    window.__acceptanceFocusEvents = 0
    window.addEventListener('focus', () => { window.__acceptanceFocusEvents += 1 })
  })
  const beforeSse = await page.evaluate(() => ({
    statusCalls: window.__gitData.apiCalls.filter(call => call.name === 'getStatus' && call.args[0] === '/repo-refresh').length,
    diffCalls: window.__gitData.apiCalls.filter(call => call.name === 'getDiff' && call.args[0] === '/repo-refresh').length,
    liveStreams: window.__gitData.streams.filter(stream => stream.path === '/repo-refresh' && !stream.closed).length,
  }))
  await page.evaluate(() => {
    const repo = window.__gitData.repos['/repo-refresh']
    repo.diff.files[0].rawPatch = 'diff --git a/src/refresh.ts b/src/refresh.ts\\n+PATCH_FROM_SSE'
    repo.diff.files[0].hunks[0].lines[1].content = 'PATCH_FROM_SSE'
  })
  const pushedStreams = await pushStatusSnapshot(page, '/repo-refresh', { branch: 'feature/pushed', head: 'head-from-sse', revision: 'revision-from-sse', dirtyFiles: 1 })
  await page.waitForFunction(() => document.querySelector('.dsh-git-diff-lines')?.textContent.includes('PATCH_FROM_SSE'))
  const afterSse = await page.evaluate(() => ({
    statusCalls: window.__gitData.apiCalls.filter(call => call.name === 'getStatus' && call.args[0] === '/repo-refresh').length,
    diffCalls: window.__gitData.apiCalls.filter(call => call.name === 'getDiff' && call.args[0] === '/repo-refresh').length,
    focusEvents: window.__acceptanceFocusEvents,
    branch: document.querySelector('.dsh-git-current-branch')?.textContent.trim(),
  }))
  check.ok(beforeSse.liveStreams >= 1, 'the fixture keeps real status subscription callbacks')
  check.equal(pushedStreams, beforeSse.liveStreams)
  check.equal(afterSse.statusCalls, beforeSse.statusCalls, 'an SSE snapshot does not need an HTTP focus reload')
  check.ok(afterSse.diffCalls > beforeSse.diffCalls, 'a pushed status snapshot refetches the diff without focus')
  check.equal(afterSse.focusEvents, 0, 'the SSE refresh path dispatches no window focus event')
  check.equal(afterSse.branch, 'feature/pushed')
  check.match(await page.$eval('.dsh-git-diff-lines', node => node.textContent), /PATCH_FROM_SSE/)
})

// TESTING.md:284-307 item 4: the shipped view is inline, so the modal-focus text is obsolete; draft retention across view switches is a documented gap.
test('Acceptance 4: inline creation forms expose the draft-retention gap and natural focus behavior', { skip: skipReason, timeout: 60000 }, async t => {
  const path = '/repo-forms'
  const { page, errors } = await openFixture({ data: dataFor([path]), mounts: [workbenchMount(path, 'forms-session')] })
  t.after(() => page.close())

  await clickText(page, '.dsh-git-view-actions', '创建分支')
  await page.waitForSelector('.dsh-git-panel-form #dsh-git-branch-name')
  check.equal(await page.evaluate(() => document.activeElement.id), 'dsh-git-branch-name', 'focus lands on the name input in the inline form')
  check.equal(await page.$eval('.dsh-git-panel-form', node => node.getAttribute('role')), null)
  check.equal(await page.$eval('.dsh-git-panel-form', node => node.getAttribute('aria-modal')), null)
  check.equal(await page.$eval('.dsh-git-panel-form', node => node.classList.contains('dsh-git-panel-form')), true)
  await page.focus('#dsh-git-branch-name')
  await page.keyboard.type('feature/typed-branch')
  await page.click('.dsh-git-workbench-path')
  check.equal(await page.$eval('#dsh-git-branch-name', node => node.value), 'feature/typed-branch', 'blur must not erase the inline controlled value')
  const statusCallsBeforeRefresh = await page.evaluate(() => window.__gitData.apiCalls.filter(call => call.name === 'getStatus' && call.args[0] === '/repo-forms').length)
  await page.evaluate(() => {
    const repo = window.__gitData.repos['/repo-forms']
    repo.status = { ...repo.status, branch: 'main-after-refresh', head: 'head-after-refresh', revision: 'revision-after-refresh' }
    window.dispatchEvent(new Event('focus'))
  })
  await page.waitForFunction(before => window.__gitData.apiCalls.filter(call => call.name === 'getStatus' && call.args[0] === '/repo-forms').length > before, {}, statusCallsBeforeRefresh)
  check.equal(await page.$eval('#dsh-git-branch-name', node => node.value), 'feature/typed-branch', 'a focus-triggered background status refresh must preserve the active draft')
  const branchFormStreams = await pushStatusSnapshot(page, '/repo-forms', { head: 'head-branch-form-sse', revision: 'revision-branch-form-sse' })
  check.ok(branchFormStreams >= 1, 'the inline form remains subscribed to host status snapshots')
  check.equal(await page.$eval('#dsh-git-branch-name', node => node.value), 'feature/typed-branch', 'a pushed host status snapshot preserves the active branch draft')

  await page.focus('#dsh-git-branch-base')
  await page.keyboard.press('Tab')
  check.equal(await page.evaluate(() => document.activeElement.textContent.trim()), '取消', 'Tab follows the form controls in DOM order')
  await page.keyboard.down('Shift')
  await page.keyboard.press('Tab')
  await page.keyboard.up('Shift')
  check.equal(await page.evaluate(() => document.activeElement.id), 'dsh-git-branch-base')
  await page.focus('#dsh-git-branch-name')
  await page.keyboard.down('Shift')
  await page.keyboard.press('Tab')
  await page.keyboard.up('Shift')
  const backward = await page.evaluate(() => ({ id: document.activeElement?.id, label: document.activeElement?.getAttribute('aria-label'), inside: !!document.querySelector('.dsh-git-panel-form')?.contains(document.activeElement) }))
  check.equal(backward.label, '关闭', 'Shift+Tab follows natural DOM order to the preceding close button')
  check.equal(backward.inside, true)
  await page.$eval('.dsh-git-panel-form button[type="submit"]', node => node.focus())
  await page.keyboard.press('Tab')
  check.equal(await page.$eval('.dsh-git-panel-form', node => node.contains(document.activeElement)), false, 'Tab may leave the final inline control; there is no dialog trap')
  await page.focus('#dsh-git-branch-name')
  await page.keyboard.press('Escape')
  check.equal(await page.$eval('.dsh-git-panel-form', node => !!node), true, 'Escape is a no-op on the inline form')
  check.equal(await page.$eval('#dsh-git-branch-name', node => node.value), 'feature/typed-branch')

  await clickText(page, '.dsh-git-view-pages', '变更')
  check.equal(await page.$('.dsh-git-panel-form'), null)
  await clickText(page, '.dsh-git-view-actions', '创建分支')
  await page.waitForSelector('#dsh-git-branch-name')
  check.equal(await page.$eval('#dsh-git-branch-name', node => node.value), '', 'the view remount currently resets the unsaved branch draft')
  await clickText(page, '.dsh-git-panel-form', '取消')
  check.equal(await page.$eval('.dsh-git-view-tab[aria-selected="true"]', node => node.textContent.trim()), '变更', 'cancel returns to the changes page')

  await clickText(page, '.dsh-git-view-actions', '创建工作树')
  await page.waitForSelector('.dsh-git-panel-form input[placeholder="例如 feature-login"]')
  const worktreeInput = '.dsh-git-panel-form input[placeholder="例如 feature-login"]'
  check.equal(await page.evaluate(() => document.activeElement.matches('.dsh-git-panel-form input[placeholder="例如 feature-login"]')), true, 'focus lands on the worktree name input')
  await page.focus(worktreeInput)
  await page.keyboard.type('feature/typed-worktree')
  await page.click('.dsh-git-workbench-path')
  check.equal(await page.$eval(worktreeInput, node => node.value), 'feature/typed-worktree', 'blur must preserve the worktree field value')
  const worktreeStatusCalls = await page.evaluate(() => window.__gitData.apiCalls.filter(call => call.name === 'getStatus' && call.args[0] === '/repo-forms').length)
  await page.evaluate(() => {
    const repo = window.__gitData.repos['/repo-forms']
    repo.status = { ...repo.status, head: 'head-worktree-refresh', revision: 'revision-worktree-refresh' }
    window.dispatchEvent(new Event('focus'))
  })
  await page.waitForFunction(before => window.__gitData.apiCalls.filter(call => call.name === 'getStatus' && call.args[0] === '/repo-forms').length > before, {}, worktreeStatusCalls)
  check.equal(await page.$eval(worktreeInput, node => node.value), 'feature/typed-worktree', 'a focus-triggered status refresh must preserve the worktree draft too')
  const worktreeFormStreams = await pushStatusSnapshot(page, '/repo-forms', { head: 'head-worktree-form-sse', revision: 'revision-worktree-form-sse' })
  check.ok(worktreeFormStreams >= 1)
  check.equal(await page.$eval(worktreeInput, node => node.value), 'feature/typed-worktree', 'a pushed host status snapshot preserves the worktree draft')
  await page.focus(worktreeInput)
  await page.keyboard.press('Escape')
  check.equal(await page.$eval(worktreeInput, node => node.value), 'feature/typed-worktree', 'Escape does not close or clear the inline worktree form')
  await clickText(page, '.dsh-git-view-pages', '变更')
  await clickText(page, '.dsh-git-view-actions', '创建工作树')
  await page.waitForSelector(worktreeInput)
  check.equal(await page.$eval(worktreeInput, node => node.value), '', 'the view remount currently resets the unsaved worktree draft')
  await clickText(page, '.dsh-git-panel-form', '关闭')
  check.equal(await page.$eval('.dsh-git-view-tab[aria-selected="true"]', node => node.textContent.trim()), '工作树', 'the worktree close control returns to the worktrees page')
  check.deepEqual(errors, [])
})

// TESTING.md:284-307 item 6: locked rows disable removal; dirty rows surface refusal without force.
test('Acceptance 6: locked delete is disabled and dirty removal refusal is surfaced without force', { skip: skipReason, timeout: 60000 }, async t => {
  const path = '/repo-worktrees'
  const worktrees = [
    { path: '/repo-worktrees/locked-tree', branch: 'locked-branch', isCurrent: false, dirtyFiles: 0, locked: true, detached: false },
    { path: '/repo-worktrees/dirty-tree', branch: 'dirty-branch', isCurrent: false, dirtyFiles: 2, locked: false, detached: false },
  ]
  const data = dataFor([path], { [path]: {
    worktrees,
    removeResults: { '/repo-worktrees/dirty-tree': { ok: false, error: '工作树含未提交改动，拒绝移除' } },
  } })
  const { page } = await openFixture({ data, mounts: [workbenchMount(path, 'worktrees-session')] })
  t.after(() => page.close())
  await clickText(page, '.dsh-git-view-pages', '工作树')
  await page.waitForFunction(() => document.querySelectorAll('.dsh-git-worktree-row').length === 2)

  const locked = await page.$eval('.dsh-git-worktree-row', row => ({
    text: row.textContent,
    removeExists: !![...row.querySelectorAll('button')].find(button => button.textContent.includes('移除工作树')),
    removeDisabled: [...row.querySelectorAll('button')].find(button => button.textContent.includes('移除工作树'))?.disabled ?? null,
    removeTitle: [...row.querySelectorAll('button')].find(button => button.textContent.includes('移除工作树'))?.title,
  }))
  check.match(locked.text, /已锁定/)
  check.equal(locked.removeExists, true)
  check.equal(locked.removeDisabled, true)
  check.equal(locked.removeTitle, '已锁定的工作树需先解锁才能移除')

  const dirtyRemoveDisabled = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.dsh-git-worktree-row')].find(node => node.querySelector('.dsh-git-worktree-path')?.textContent.trim() === '/repo-worktrees/dirty-tree')
    return row?.querySelector('button.dsh-git-btn-danger')?.disabled ?? null
  })
  check.equal(dirtyRemoveDisabled, false)
  const dirtyRowFound = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.dsh-git-worktree-row')].find(node => node.querySelector('.dsh-git-worktree-path')?.textContent.trim() === '/repo-worktrees/dirty-tree')
    if (!row) return false
    row.querySelector('button.dsh-git-btn-danger')?.click()
    return true
  })
  check.equal(dirtyRowFound, true, 'the dirty row is identified by its exact worktree path')
  await page.waitForSelector('[role="group"][aria-label="确认移除工作树"]')
  check.equal(await page.$eval('[role="group"][aria-label="确认移除工作树"] input[type="checkbox"]', node => node.checked), false)
  await clickText(page, '[role="group"][aria-label="确认移除工作树"]', '确认移除工作树')
  await page.waitForFunction(() => document.querySelector('[role="alert"]')?.textContent.includes('工作树含未提交改动'))
  const calls = await page.evaluate(() => window.__gitData.apiCalls.filter(call => call.name === 'removeWorktree'))
  check.equal(calls.length, 1)
  check.equal(calls[0].args[0], path)
  check.equal(calls[0].args[1], '/repo-worktrees/dirty-tree')
  check.equal(calls[0].args[2], false, 'dirty removal is requested without force')
  check.equal(calls.some(call => call.args[2] === true), false)
  check.equal(await page.$eval('[role="alert"]', node => node.textContent.includes('已删除工作树')), false, 'a refusal must not be presented as success')
})

// Acceptance item 9: file history takes over the changes body in-place; close restores files and diff.
test('Acceptance 9: file history fills the changes body and preserves the pinned commit controls', { skip: skipReason, timeout: 60000 }, async t => {
  const path = '/repo-history'
  const { page } = await openFixture({ data: dataFor([path], { [path]: { file: 'src/history.ts', patch: 'HISTORY_PATCH' } }), mounts: [workbenchMount(path, 'history-session')], width: 430 })
  t.after(() => page.close())
  await page.waitForFunction(() => document.querySelector('.dsh-git-diff-lines')?.textContent.includes('HISTORY_PATCH'))
  await page.click('.dsh-git-file-menu summary')
  await page.click('.dsh-git-file-menu-items button[title="查看这个文件的历史与逐行责任"]')
  await page.waitForFunction(() => document.querySelector('.dsh-git-changes-body > .dsh-git-panel-form .dsh-git-scroll-list button'))
  const layout = await page.evaluate(() => {
    const body = document.querySelector('.dsh-git-changes-body')
    const form = body?.querySelector(':scope > .dsh-git-panel-form')
    const list = form?.querySelector('.dsh-git-scroll-list')
    const commit = document.querySelector('.dsh-git-commit-box')
    const bodyRect = body?.getBoundingClientRect()
    const formRect = form?.getBoundingClientRect()
    const commitRect = commit?.getBoundingClientRect()
    return {
      body: bodyRect && { top: bodyRect.top, bottom: bodyRect.bottom, height: bodyRect.height, width: bodyRect.width },
      form: formRect && { top: formRect.top, bottom: formRect.bottom, height: formRect.height, width: formRect.width },
      list: list && { clientHeight: list.clientHeight, scrollHeight: list.scrollHeight, clientWidth: list.clientWidth, scrollWidth: list.scrollWidth },
      commit: commitRect && { top: commitRect.top, bottom: commitRect.bottom, height: commitRect.height },
      visible: !!form && getComputedStyle(form).display !== 'none' && formRect.height > 0,
      directChild: form?.parentElement === body,
    }
  })
  check.ok(layout.visible, JSON.stringify(layout))
  check.equal(layout.directChild, true, 'the FileInspect form must take over the changes body directly')
  check.ok(layout.form.height >= 120, JSON.stringify(layout))
  check.ok(layout.form.top >= layout.body.top - 1 && layout.form.bottom <= layout.body.bottom + 2, JSON.stringify(layout))
  check.ok(layout.list.clientHeight > 0, JSON.stringify(layout))
  check.ok(layout.list.scrollWidth <= layout.list.clientWidth + 8, JSON.stringify(layout))
  check.ok(layout.commit.bottom <= 901, JSON.stringify(layout))
  check.ok(layout.commit.top >= layout.body.bottom - 2, 'commit controls remain outside and below the history takeover')
  check.ok(layout.commit.bottom - layout.commit.top > 0)

  await page.click('.dsh-git-panel-form button[aria-label="关闭"]')
  await page.waitForFunction(() => document.querySelector('.dsh-git-file-row') && document.querySelector('.dsh-git-diff-lines')?.textContent.includes('HISTORY_PATCH'))
  check.ok(await page.$('.dsh-git-changes-body > .dsh-git-panel-form') === null, 'closing history restores the normal file/diff body')
  check.ok(await page.$('.dsh-git-commit-box') !== null, 'the commit box returns with the changes view')
})

// Acceptance item 12: the file-history list is replaced in place by the commit detail, and no detail
// survives 返回, a tab switch, or closing the panel. The lazy-chunk failure branch cannot be triggered
// here — esbuild inlines the dynamic import, so the chunk never rejects — and that branch stays
// covered by tests/history-loading.test.mjs.
test('Acceptance 12: commit detail replaces the file history in place and leaves no residue', { skip: skipReason, timeout: 60000 }, async t => {
  const path = '/repo-drill'
  const first = { hash: '1'.repeat(40), shortHash: '1111111', subject: 'FIRST_HISTORY_SUBJECT', author: 'Example', date: '2026-10-16' }
  const second = { hash: '2'.repeat(40), shortHash: '2222222', subject: 'SECOND_HISTORY_SUBJECT', author: 'Example', date: '2026-10-15' }
  const { page, errors } = await openFixture({
    data: dataFor([path], {
      [path]: {
        file: 'src/drill.ts',
        patch: 'DRILL_PATCH',
        fileHistory: [first, second],
        detail: {
          hash: second.hash, shortHash: second.shortHash, subject: 'DRILLED_DETAIL_SUBJECT', body: 'DRILLED_DETAIL_BODY',
          author: 'Example', authorEmail: 'example@test.invalid', committer: 'Example', date: '2026-10-15', commitDate: '2026-10-15',
          parents: [], files: [], totalInsertions: 0, totalDeletions: 0,
        },
      },
    }),
    mounts: [workbenchMount(path, 'drill-session')],
  })
  t.after(() => page.close())
  await page.waitForFunction(() => document.querySelector('.dsh-git-diff-lines')?.textContent.includes('DRILL_PATCH'))

  const panel = '.dsh-git-changes-body > .dsh-git-panel-form'
  const waitForList = () => page.waitForFunction(selector => document.querySelector(`${selector} .dsh-git-scroll-list button`), {}, panel)
  const waitForDetail = () => page.waitForFunction(selector => document.querySelector(selector)?.textContent.includes('DRILLED_DETAIL_SUBJECT'), {}, panel)
  const state = () => page.evaluate(selector => {
    const form = document.querySelector(selector)
    return {
      rows: [...(form?.querySelectorAll('.dsh-git-scroll-list .dsh-git-reflog-row') || [])].map(row => row.textContent.trim()),
      text: (form?.textContent || '').replace(/\s+/g, ' '),
      back: [...(form?.querySelectorAll('button') || [])].filter(button => button.textContent.trim() === '返回').length,
      hasMessage: !!form?.querySelector('.dsh-git-detail-message'),
    }
  }, panel)
  const openHistory = async () => {
    await page.click('.dsh-git-file-menu summary')
    await page.click('.dsh-git-file-menu-items button[title="查看这个文件的历史与逐行责任"]')
    await waitForList()
  }

  await openHistory()
  const listed = await state()
  check.equal(listed.rows.length, 2, 'the file history lists every entry')
  check.match(listed.rows.join(' | '), /FIRST_HISTORY_SUBJECT/)
  check.match(listed.rows.join(' | '), /SECOND_HISTORY_SUBJECT/)
  check.equal(listed.back, 0, 'the plain list offers no 返回 button')
  check.equal(listed.hasMessage, false, 'no commit detail is rendered before drilling in')

  await page.click(`.dsh-git-scroll-list .dsh-git-reflog-row[title="${second.hash}"]`)
  await waitForDetail()
  const drilled = await state()
  check.equal(drilled.rows.length, 0, 'the detail replaces the history rows in place instead of appending below them')
  check.equal(drilled.hasMessage, true)
  check.match(drilled.text, /DRILLED_DETAIL_SUBJECT/)
  check.match(drilled.text, /DRILLED_DETAIL_BODY/)
  check.doesNotMatch(drilled.text, /FIRST_HISTORY_SUBJECT|SECOND_HISTORY_SUBJECT/)
  check.equal(drilled.back, 1, 'the drilled detail offers 返回')
  const fetched = await page.evaluate(hash => window.__gitData.apiCalls.filter(call => call.name === 'getCommitDetail' && call.args[1] === hash).length, second.hash)
  check.ok(fetched >= 1, 'the detail is fetched for the clicked commit hash')

  await clickText(page, panel, '返回')
  await waitForList()
  const restored = await state()
  check.equal(restored.rows.length, 2, '返回 restores the same file history')
  check.equal(restored.hasMessage, false, '返回 leaves no detail behind')

  await page.click(`.dsh-git-scroll-list .dsh-git-reflog-row[title="${second.hash}"]`)
  await waitForDetail()
  await clickText(page, panel, '责任')
  await page.waitForFunction(selector => !document.querySelector(selector)?.querySelector('.dsh-git-detail-message'), {}, panel)
  const blameTab = await state()
  check.equal(blameTab.hasMessage, false, 'switching to the 责任 tab drops the drilled detail')
  check.equal(blameTab.back, 0, 'no 返回 button survives the tab switch')
  check.doesNotMatch(blameTab.text, /DRILLED_DETAIL_SUBJECT/)

  await clickText(page, panel, '历史')
  await waitForList()
  const backToHistory = await state()
  check.equal(backToHistory.rows.length, 2, 'returning to 历史 shows the same file history, not a stale detail')
  check.equal(backToHistory.hasMessage, false)

  await page.click(`${panel} button[aria-label="关闭"]`)
  await page.waitForFunction(() => document.querySelector('.dsh-git-file-row') && document.querySelector('.dsh-git-diff-lines')?.textContent.includes('DRILL_PATCH'))
  check.ok(await page.$(`${panel} .dsh-git-detail-message`) === null, 'closing the panel leaves no commit detail')
  check.deepEqual(errors, [])
})

// Acceptance items 10/14: the host is stubbed, so assert icon/layout behavior and supplied data, not installed icon bytes.
test('Acceptance 10 and 14: editor menu keeps icons square and probes once after success', { skip: skipReason, timeout: 60000 }, async t => {
  const path = '/repo-editors'
  const iconA = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22%3E%3Crect width=%2224%22 height=%2224%22 fill=%22%23007acc%22/%3E%3C/svg%3E'
  const iconB = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 16 16%22%3E%3Ccircle cx=%228%22 cy=%228%22 r=%228%22 fill=%22%23e34f26%22/%3E%3C/svg%3E'
  const data = dataFor([path], { [path]: { file: 'src/editor.ts', patch: 'EDITOR_PATCH' } })
  const pathShim = 'C:\\P\\code.cmd'
  data.editorProbe = { editors: [
    { label: 'Visual Studio Code', command: pathShim, icon: iconA },
    { label: 'WebStorm', command: 'webstorm', icon: iconB },
    { label: 'IntelliJ IDEA', command: 'idea' },
  ] }
  const { page } = await openFixture({ data, mounts: [workbenchMount(path, 'editor-session')] })
  t.after(() => page.close())
  await page.waitForSelector('.dsh-git-open-editor')
  await page.click('.dsh-git-open-editor')
  await page.waitForFunction(() => document.querySelectorAll('.dsh-git-editor-option[role="menuitem"]').length === 5)
  await page.waitForFunction(() => [...document.querySelectorAll('img.dsh-git-editor-mark-image')].every(image => image.complete && image.naturalWidth > 0))
  const menu = await page.evaluate(() => {
    const entries = [...document.querySelectorAll('.dsh-git-editor-option[role="menuitem"]')]
    return {
      labels: entries.map(entry => entry.textContent.trim()),
      titles: entries.map(entry => entry.getAttribute('title') || ''),
      tag: document.querySelector('.dsh-git-editor-option .dsh-git-editor-tag')?.textContent || '',
      stuckLoading: document.querySelector('.dsh-git-editor-menu')?.textContent.includes('正在检测已安装的编辑器…') || false,
      icons: [...document.querySelectorAll('img.dsh-git-editor-mark-image')].map(image => ({
        src: image.getAttribute('src'), width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height,
      })),
      noIconMark: [...entries].find(entry => entry.textContent.includes('IntelliJ IDEA'))?.querySelector('.dsh-git-editor-mark, svg') !== null,
      marks: entries.filter(entry => !entry.textContent.includes('系统默认应用') && !entry.textContent.includes('显示文件位置')).map(entry => {
        const mark = entry.querySelector(':scope > .dsh-git-editor-mark, :scope > svg')
        const label = [...entry.querySelectorAll(':scope > span')].find(node => !node.classList.contains('dsh-git-editor-mark'))
        return { width: mark?.getBoundingClientRect().width, height: mark?.getBoundingClientRect().height, label: label?.textContent.trim(), labelClient: label?.clientWidth, labelScroll: label?.scrollWidth }
      }),
      probeCalls: window.__gitData.editorProbeCalls,
    }
  })
  check.equal(menu.labels.length, 5)
  check.equal(menu.tag, '（默认）', 'the OS association leads the list and carries the Windows 11 default tag')
  check.ok(menu.titles.includes(pathShim), 'the PATH-first code.cmd command returned by the host stays reachable as the row tooltip')
  check.ok(menu.labels.some(label => label.includes('Visual Studio Code')))
  check.equal(menu.labels.filter(label => label.includes('Visual Studio Code')).length, 1, 'the host-provided PATH-first shim result is rendered once')
  check.equal(menu.stuckLoading, false, 'the probe result is not stuck in its loading state')
  check.ok(menu.labels.some(label => label.includes('WebStorm')))
  check.ok(menu.labels.some(label => label.includes('IntelliJ IDEA')))
  check.ok(menu.labels.some(label => label === '系统默认应用（默认）'))
  check.ok(menu.labels.some(label => label === '显示文件位置'), 'the footer row reveals the file instead of opening it')
  check.equal(menu.icons.length, 2)
  check.equal(menu.icons[0].src, iconA)
  check.equal(menu.icons[1].src, iconB)
  for (const icon of menu.icons) {
    check.ok(Math.abs(icon.width - icon.height) <= 2, JSON.stringify(icon))
    check.ok(icon.width <= 20 && icon.height <= 20, JSON.stringify(icon))
  }
  check.equal(menu.noIconMark, true, 'an editor without a host icon still gets its drawn mark')
  check.equal(menu.marks.length, 3)
  for (const mark of menu.marks) {
    check.ok(mark.width > 0 && mark.width <= 20 && mark.height > 0 && mark.height <= 20, JSON.stringify(mark))
    check.ok(Math.abs(mark.width - mark.height) <= 2, JSON.stringify(mark))
    check.ok(mark.labelClient >= mark.labelScroll, `${mark.label} must remain fully visible`)
  }
  check.equal(menu.probeCalls, 1)

  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('.dsh-git-editor-menu'))
  check.equal(await page.evaluate(() => document.activeElement === document.querySelector('.dsh-git-open-editor')), true, 'Escape closes the diff-header menu and retains trigger focus')
  await page.click('.dsh-git-open-editor')
  await page.waitForSelector('.dsh-git-editor-menu')
  check.equal(await page.evaluate(() => window.__gitData.editorProbeCalls), 1, 'reopening after success reuses the mounted component cache')
  check.equal(await page.$eval('.dsh-git-editor-menu', node => node.textContent.includes('系统默认应用')), true)
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('.dsh-git-editor-menu'))

  await page.click('.dsh-git-file-menu summary')
  await page.click('.dsh-git-file-menu-items button[title="查看这个文件的历史与逐行责任"]')
  await page.waitForSelector('.dsh-git-changes-body > .dsh-git-panel-form .dsh-git-open-editor')
  await page.click('.dsh-git-changes-body > .dsh-git-panel-form .dsh-git-open-editor')
  await page.waitForFunction(() => document.querySelector('.dsh-git-editor-menu')?.querySelectorAll('.dsh-git-editor-option').length === 5)
  check.equal(await page.evaluate(() => window.__gitData.editorProbeCalls), 2, 'the history-toolbar control is a separate mounted component and probes once')
  check.equal(await page.$eval('.dsh-git-editor-menu', node => node.textContent.includes('系统默认应用')), true)
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('.dsh-git-editor-menu'))
  check.equal(await page.evaluate(() => document.activeElement === document.querySelector('.dsh-git-changes-body > .dsh-git-panel-form .dsh-git-open-editor')), true, 'Escape returns focus to the history-toolbar trigger')
  await page.click('.dsh-git-changes-body > .dsh-git-panel-form .dsh-git-open-editor')
  await page.waitForSelector('.dsh-git-editor-menu')
  check.equal(await page.evaluate(() => window.__gitData.editorProbeCalls), 2, 'success is cached for this mounted history-toolbar component')
  t.diagnostic('Editor probe cache is per mounted OpenInEditorMenu component, not per session; each mount asks once.')
})

test('Acceptance 10, 14, and 15: empty fallback covers both menus and failures retry on reopen', { skip: skipReason, timeout: 60000 }, async t => {
  const emptyPath = '/repo-editor-empty'
  const emptyData = dataFor([emptyPath])
  emptyData.editorProbe = { editors: [] }
  const emptyFixture = await openFixture({ data: emptyData, mounts: [workbenchMount(emptyPath, 'editor-empty')] })
  t.after(() => emptyFixture.page.close())
  const page = emptyFixture.page
  await page.waitForSelector('.dsh-git-open-editor')
  await page.click('.dsh-git-open-editor')
  await page.waitForFunction(() => document.querySelector('.dsh-git-editor-menu')?.textContent.includes('系统默认应用'))
  check.match(await page.$eval('.dsh-git-editor-menu', node => node.textContent), /没有检测到编辑器命令行/)
  check.equal(await page.$eval('.dsh-git-editor-menu', node => node.textContent.includes('系统默认应用')), true, 'empty probe retains the OS-association option')
  check.equal(await page.evaluate(() => window.__gitData.editorProbeCalls), 1)
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('.dsh-git-editor-menu'))
  check.equal(await page.evaluate(() => document.activeElement === document.querySelector('.dsh-git-open-editor')), true, 'diff-header Escape leaves focus on its trigger')

  await page.click('.dsh-git-file-menu summary')
  await page.click('.dsh-git-file-menu-items button[title="查看这个文件的历史与逐行责任"]')
  await page.waitForSelector('.dsh-git-changes-body > .dsh-git-panel-form .dsh-git-open-editor')
  const historyTrigger = '.dsh-git-changes-body > .dsh-git-panel-form .dsh-git-open-editor'
  await page.click(historyTrigger)
  await page.waitForFunction(() => document.querySelector('.dsh-git-editor-menu')?.textContent.includes('系统默认应用'))
  check.match(await page.$eval('.dsh-git-editor-menu', node => node.textContent), /没有检测到编辑器命令行/)
  check.equal(await page.evaluate(() => window.__gitData.editorProbeCalls), 2, 'the history-toolbar component probes once independently')
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('.dsh-git-editor-menu'))
  check.equal(await page.evaluate(() => document.activeElement === document.querySelector('.dsh-git-changes-body > .dsh-git-panel-form .dsh-git-open-editor')), true, 'history-toolbar Escape leaves focus on its trigger')

  const errorPath = '/repo-editor-error'
  const errorData = dataFor([errorPath])
  errorData.editorProbe = { error: 'editor probe unavailable' }
  const errorFixture = await openFixture({ data: errorData, mounts: [workbenchMount(errorPath, 'editor-error')] })
  t.after(() => errorFixture.page.close())
  const errorPage = errorFixture.page
  await errorPage.waitForSelector('.dsh-git-open-editor')
  await errorPage.click('.dsh-git-open-editor')
  await errorPage.waitForSelector('.dsh-git-editor-menu [role="alert"]')
  check.match(await errorPage.$eval('.dsh-git-editor-menu [role="alert"]', node => node.textContent), /editor probe unavailable/)
  check.equal(await errorPage.$eval('.dsh-git-editor-menu', node => node.textContent.includes('系统默认应用')), true)
  check.equal(await errorPage.evaluate(() => window.__gitData.editorProbeCalls), 1)
  await errorPage.keyboard.press('Escape')
  await errorPage.waitForFunction(() => !document.querySelector('.dsh-git-editor-menu'))
  check.equal(await errorPage.evaluate(() => document.activeElement === document.querySelector('.dsh-git-open-editor')), true)
  await errorPage.click('.dsh-git-open-editor')
  await errorPage.waitForSelector('.dsh-git-editor-menu [role="alert"]')
  check.equal(await errorPage.evaluate(() => window.__gitData.editorProbeCalls), 2, 'failed probes retry on a later opening')
  check.equal(await errorPage.$eval('.dsh-git-editor-menu', node => node.textContent.includes('系统默认应用')), true)
})

// Acceptance item 8: rendered chip and popover badges omit zero counts and show real divergence.
test('Acceptance 8: branch chip and popover render only nonzero divergence and stash badges', { skip: skipReason, timeout: 60000 }, async t => {
  const path = '/repo-branch-chip'
  const data = dataFor([path], { [path]: {
    status: { branch: 'main', ahead: 0, behind: 0, stashCount: 0, dirtyFiles: 0 },
    branches: { current: 'main', branches: [{ name: 'main', current: true }, { name: 'feature/next', current: false }], dirtyFiles: 0 },
  } })
  const { page, errors } = await openFixture({ data, mounts: [{ kind: 'chip', path, sessionId: 'branch-chip-session', id: 'fixture' }] })
  t.after(() => page.close())
  await page.waitForSelector('.dsh-git-chip')
  const zeroChip = await page.$eval('.dsh-git-chip', node => ({
    ahead: node.querySelectorAll('.dsh-git-ahead').length,
    behind: node.querySelectorAll('.dsh-git-behind').length,
    badges: [...node.querySelectorAll('.dsh-git-badge')].map(item => item.textContent.trim()),
  }))
  check.equal(zeroChip.ahead, 0)
  check.equal(zeroChip.behind, 0)
  check.equal(zeroChip.badges.some(value => value.startsWith('储藏')), false)
  await page.click('.dsh-git-chip')
  await page.waitForSelector('.dsh-git-popover')
  const zeroPopover = await page.$eval('.dsh-git-popover', node => ({
    text: node.textContent,
    diverged: !!node.querySelector('.dsh-git-diverged'),
    ahead: node.querySelectorAll('.dsh-git-ahead').length,
    behind: node.querySelectorAll('.dsh-git-behind').length,
    stash: [...node.querySelectorAll('.dsh-git-badge')].some(item => item.textContent.trim() === '储藏 0'),
  }))
  check.doesNotMatch(zeroPopover.text, /领先|落后/)
  check.equal(zeroPopover.diverged, false, '与上游一致时整行都不渲染')
  check.equal(zeroPopover.ahead, 0)
  check.equal(zeroPopover.behind, 0)
  check.equal(zeroPopover.stash, false)

  await page.click('.dsh-git-popover-backdrop')
  await page.evaluate(() => {
    const repo = window.__gitData.repos['/repo-branch-chip']
    repo.status = { ...repo.status, head: 'head-diverged', revision: 'revision-diverged', ahead: 2, behind: 1, stashCount: 3 }
  })
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.waitForFunction(() => document.querySelector('.dsh-git-ahead')?.textContent === '2' && document.querySelector('.dsh-git-behind')?.textContent === '1')
  const divergedChip = await page.$eval('.dsh-git-chip', node => ({
    branch: node.querySelector('.dsh-git-chip-branch')?.textContent,
    ahead: node.querySelector('.dsh-git-ahead')?.textContent,
    behind: node.querySelector('.dsh-git-behind')?.textContent,
    arrowIcons: [...node.querySelectorAll('.dsh-git-ahead svg, .dsh-git-behind svg')].map(icon => icon.getAttribute('viewBox')),
    stash: [...node.querySelectorAll('.dsh-git-badge')].find(item => item.textContent.trim() === '储藏 3')?.textContent.trim(),
  }))
  check.equal(divergedChip.branch, 'main')
  check.equal(divergedChip.ahead, '2')
  check.equal(divergedChip.behind, '1')
  // 计数必须画成图标箭头：正文里的 ↑/↓ 字形紧跟分支名会被读成「main 13」。
  check.deepEqual(divergedChip.arrowIcons, ['0 0 24 24', '0 0 24 24'])
  check.doesNotMatch(`${divergedChip.branch}${divergedChip.ahead}${divergedChip.behind}`, /[↑↓]/, 'the chip never glues a text arrow glyph onto the branch name')
  check.equal(divergedChip.stash, '储藏 3')
  await page.click('.dsh-git-chip')
  await page.waitForSelector('.dsh-git-popover')
  const divergedPopover = await page.$eval('.dsh-git-popover', node => ({
    text: node.textContent,
    stash: [...node.querySelectorAll('.dsh-git-badge')].find(item => item.textContent.trim() === '储藏 3')?.textContent.trim(),
    ahead: node.querySelector('.dsh-git-diverged .dsh-git-ahead')?.textContent.trim(),
    behind: node.querySelector('.dsh-git-diverged .dsh-git-behind')?.textContent.trim(),
    aheadIcon: !!node.querySelector('.dsh-git-diverged .dsh-git-ahead svg'),
    behindIcon: !!node.querySelector('.dsh-git-diverged .dsh-git-behind svg'),
  }))
  check.equal(divergedPopover.ahead, '领先 2 个提交')
  check.equal(divergedPopover.behind, '落后 1 个提交')
  check.equal(divergedPopover.aheadIcon, true, '领先那一侧画的是图标箭头')
  check.equal(divergedPopover.behindIcon, true, '落后那一侧画的是图标箭头')
  check.doesNotMatch(divergedPopover.text, /[↑↓]/, '这一行也不再用正文 ↑/↓ 字形')
  check.equal(divergedPopover.stash, '储藏 3')

  // The reported defect: a branch that only leads its upstream still printed "落后 0 个提交".
  await page.click('.dsh-git-popover-backdrop')
  await page.evaluate(() => {
    const repo = window.__gitData.repos['/repo-branch-chip']
    repo.status = { ...repo.status, head: 'head-ahead-only', revision: 'revision-ahead-only', ahead: 3, behind: 0, stashCount: 0 }
  })
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.waitForFunction(() => document.querySelector('.dsh-git-ahead')?.textContent === '3' && !document.querySelector('.dsh-git-behind'))
  const aheadOnlyChip = await page.$eval('.dsh-git-chip', node => ({
    ahead: node.querySelector('.dsh-git-ahead')?.textContent,
    arrow: !!node.querySelector('.dsh-git-ahead svg'),
    behind: node.querySelectorAll('.dsh-git-behind').length,
  }))
  check.equal(aheadOnlyChip.ahead, '3')
  check.equal(aheadOnlyChip.arrow, true)
  check.equal(aheadOnlyChip.behind, 0)
  await page.click('.dsh-git-chip')
  await page.waitForSelector('.dsh-git-popover')
  const aheadOnlyPopover = await page.$eval('.dsh-git-popover', node => ({
    text: node.textContent,
    ahead: node.querySelector('.dsh-git-diverged .dsh-git-ahead')?.textContent.trim(),
    pills: node.querySelectorAll('.dsh-git-diverged > span').length,
  }))
  check.equal(aheadOnlyPopover.ahead, '领先 3 个提交')
  check.equal(aheadOnlyPopover.pills, 1, '只有领先那一侧，不打印空的落后')
  check.doesNotMatch(aheadOnlyPopover.text, /落后/)

  await page.click('.dsh-git-popover-backdrop')
  await page.evaluate(() => {
    const repo = window.__gitData.repos['/repo-branch-chip']
    repo.status = { ...repo.status, head: 'head-level', revision: 'revision-level', ahead: 0, behind: 0, stashCount: 0 }
  })
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.waitForFunction(() => !document.querySelector('.dsh-git-ahead') && !document.querySelector('.dsh-git-behind'))
  check.equal(await page.$eval('.dsh-git-chip', node => [...node.querySelectorAll('.dsh-git-badge')].some(item => item.textContent.trim().startsWith('储藏'))), false)
  await page.click('.dsh-git-chip')
  await page.waitForSelector('.dsh-git-popover')
  check.equal(await page.$eval('.dsh-git-popover', node => !!node.querySelector('.dsh-git-diverged')), false, '回到与上游一致时这一行整行消失')
  check.doesNotMatch(await page.$eval('.dsh-git-popover', node => node.textContent), /领先|落后/)
  check.equal(await page.$eval('.dsh-git-popover', node => [...node.querySelectorAll('.dsh-git-badge')].some(item => item.textContent.trim().startsWith('储藏'))), false)
  check.deepEqual(errors, [])
})

// The plugin's base button background transition is not suppressed by its reduced-motion override.
// Wait a bounded 300ms so screenshots and contrast reads observe the settled theme, not the from-value.
async function settleVisuals(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 300)))))
}

async function setTheme(page, mode) {
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: mode }])
  await settleVisuals(page)
}

async function readThemeControlStyles(page) {
  await settleVisuals(page)
  const controls = await page.evaluate(() => {
    const nodes = [
      ['更多操作', document.querySelector('.dsh-git-file-menu summary')],
      ['在编辑器中打开', document.querySelector('.dsh-git-open-editor')],
      ['工作区 → HEAD', document.querySelector('.dsh-git-compare-trigger')],
      ['撤销提交', [...document.querySelectorAll('.dsh-git-commit-box button')].find(button => button.textContent.includes('撤销提交'))],
    ]
    return nodes.map(([label, node]) => {
      if (!node) return { label, missing: true }
      const style = getComputedStyle(node)
      return {
        label,
        backgroundColor: style.backgroundColor,
        color: style.color,
        bgLayer1: style.getPropertyValue('--dsw-alias-bg-layer-1').trim(),
        bgBase: style.getPropertyValue('--dsw-alias-bg-base').trim(),
        labelPrimary: style.getPropertyValue('--dsw-alias-label-primary').trim(),
      }
    })
  })
  return controls.map(control => ({ ...control, contrast: contrastRatio(control.color, control.backgroundColor) }))
}

function luminance(rgb) {
  const channels = rgb.match(/[\d.]+/g)?.slice(0, 3).map(Number)
  if (!channels || channels.length !== 3) return NaN
  const linear = channels.map(channel => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}

function contrastRatio(foreground, background) {
  const first = luminance(foreground)
  const second = luminance(background)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

function assertReadableControls(mode, controls, light) {
  check.equal(controls.length, 4)
  for (const control of controls) {
    check.equal(control.missing, undefined, `${mode}: ${control.label} is present`)
    check.equal(control.color, light ? 'rgb(32, 32, 32)' : 'rgb(237, 237, 237)', `${mode}: ${control.label} foreground`)
    check.ok(control.contrast >= 4.5, `${mode}: ${control.label} contrast ${control.contrast.toFixed(2)}:1 (${control.color} on ${control.backgroundColor})`)
  }
  console.log(`${mode.toUpperCase()}_COMPUTED_STYLE_EVIDENCE=${JSON.stringify(controls)}`)
}

async function captureScreenshot(page, path, options = {}) {
  try {
    mkdirSync(resolve(path, '..'), { recursive: true })
    await settleVisuals(page)
    await page.screenshot({ path, fullPage: false, ...options })
    return true
  } catch (error) {
    screenshotFailures.push(`${path}: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

// Acceptance items 7/14: screenshots are optional visual-review evidence, never test truth.
test('Acceptance 7 and 14: capture light, dark, narrow-history, editor, and worktree screenshots', { skip: skipReason, timeout: 60000 }, async t => {
  const temp = process.env.TEMP || process.env.TMP || process.env.TMPDIR || '.'
  const directory = resolve(temp, 'acc')
  mkdirSync(directory, { recursive: true })
  const paths = {
    light: join(directory, 'changes-light.png'),
    dark: join(directory, 'changes-dark.png'),
    history: join(directory, 'history-narrow.png'),
    editor: join(directory, 'editor-menu.png'),
    worktrees: join(directory, 'worktrees-guarded.png'),
  }
  screenshotPaths.push(paths.editor)
  const repoPath = '/repo-screenshots'
  const data = dataFor([repoPath], { [repoPath]: { file: 'src/screenshot.ts', patch: 'SCREENSHOT_PATCH' } })
  const { page } = await openFixture({ data, mounts: [workbenchMount(repoPath, 'screenshot-session')] })
  t.after(() => page.close())
  await page.waitForFunction(() => document.querySelector('.dsh-git-commit-box') && document.querySelector('.dsh-git-diff-lines')?.textContent.includes('SCREENSHOT_PATCH'))
  await setTheme(page, 'light')
  const lightControls = await readThemeControlStyles(page)
  assertReadableControls('light', lightControls, true)
  for (const control of lightControls) {
    check.equal(control.bgLayer1, '#f5f5f5')
    check.equal(control.bgBase, '#fff')
    check.equal(control.labelPrimary, '#202020')
    check.equal(control.backgroundColor, control.label === '工作区 → HEAD' ? 'rgb(255, 255, 255)' : 'rgb(245, 245, 245)')
  }
  await captureScreenshot(page, paths.light)

  await setTheme(page, 'dark')
  const darkControls = await readThemeControlStyles(page)
  assertReadableControls('dark', darkControls, false)
  for (const control of darkControls) {
    check.equal(control.bgLayer1, '#232323')
    check.equal(control.bgBase, '#181818')
    check.equal(control.labelPrimary, '#ededed')
    check.equal(control.backgroundColor, control.label === '工作区 → HEAD' ? 'rgb(24, 24, 24)' : 'rgb(35, 35, 35)')
  }
  // Item 7: the item remains readable in both modes after the background transitions settle.
  await captureScreenshot(page, paths.dark)

  const historyPath = '/repo-history-shot'
  const historyData = dataFor([historyPath], { [historyPath]: { file: 'src/history-shot.ts', patch: 'HISTORY_SCREENSHOT_PATCH' } })
  const historyFixture = await openFixture({ data: historyData, mounts: [workbenchMount(historyPath, 'history-shot-session')], width: 430, height: 900 })
  t.after(() => historyFixture.page.close())
  await historyFixture.page.waitForFunction(() => document.querySelector('.dsh-git-diff-lines')?.textContent.includes('HISTORY_SCREENSHOT_PATCH'))
  await historyFixture.page.click('.dsh-git-file-menu summary')
  await historyFixture.page.click('.dsh-git-file-menu-items button[title="查看这个文件的历史与逐行责任"]')
  await historyFixture.page.waitForSelector('.dsh-git-changes-body > .dsh-git-panel-form .dsh-git-scroll-list')
  await captureScreenshot(historyFixture.page, paths.history)

  const editorPath = '/repo-editor-shot'
  const editorData = dataFor([editorPath], { [editorPath]: { file: 'src/editor-shot.ts', patch: 'EDITOR_SCREENSHOT_PATCH' } })
  editorData.editorProbe = { editors: [
    { label: 'Visual Studio Code', command: 'code', icon: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22%3E%3Crect width=%2216%22 height=%2216%22 fill=%22%23007acc%22/%3E%3C/svg%3E' },
    { label: 'IntelliJ IDEA', command: 'idea' },
  ] }
  const editorFixture = await openFixture({ data: editorData, mounts: [workbenchMount(editorPath, 'editor-shot-session')] })
  t.after(() => editorFixture.page.close())
  await editorFixture.page.waitForSelector('.dsh-git-open-editor')
  await editorFixture.page.click('.dsh-git-open-editor')
  await editorFixture.page.waitForFunction(() => document.querySelector('.dsh-git-editor-menu')?.textContent.includes('系统默认应用'))
  const editorBox = await editorFixture.page.$eval('.dsh-git-editor-menu', node => {
    const rect = node.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  })
  const clip = {
    x: Math.max(0, editorBox.x - 12), y: Math.max(0, editorBox.y - 12),
    width: Math.min(1440 - Math.max(0, editorBox.x - 12), editorBox.width + 24),
    height: Math.min(900 - Math.max(0, editorBox.y - 12), editorBox.height + 24),
  }
  await captureScreenshot(editorFixture.page, paths.editor, { clip })

  const worktreePath = '/repo-worktree-shot'
  const worktreeData = dataFor([worktreePath], { [worktreePath]: { worktrees: [
    { path: '/repo-worktree-shot/locked', branch: 'locked-review', isCurrent: false, dirtyFiles: 0, locked: true, detached: false },
    { path: '/repo-worktree-shot/dirty', branch: 'dirty-review', isCurrent: false, dirtyFiles: 2, locked: false, detached: false },
  ] } })
  const worktreeFixture = await openFixture({ data: worktreeData, mounts: [workbenchMount(worktreePath, 'worktree-shot-session')] })
  t.after(() => worktreeFixture.page.close())
  await clickText(worktreeFixture.page, '.dsh-git-view-pages', '工作树')
  await worktreeFixture.page.waitForFunction(() => document.querySelectorAll('.dsh-git-worktree-row').length === 2)
  await captureScreenshot(worktreeFixture.page, paths.worktrees)

  for (const path of Object.values(paths)) if (!screenshotPaths.includes(path)) screenshotPaths.push(path)
  console.log(`ACCEPTANCE_UI_ASSERTIONS=${assertionCount}`)
  console.log(`ACCEPTANCE_UI_SCREENSHOTS=${Object.values(paths).join(' | ')}`)
  if (screenshotFailures.length) console.log(`ACCEPTANCE_UI_SCREENSHOT_FAILURES=${screenshotFailures.join(' | ')}`)
})

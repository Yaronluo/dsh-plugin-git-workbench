import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
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

// Real browser layout and wheel events against real components, with only Git I/O mocked.
// Reuse installed host CSS so native flex ancestors, not a hand-waved 100%-height box,
// participate in the regression. This is an isolated fixture, NOT the logged-in GUI.
test('Chromium: large change lists/diffs scroll, page footer stays reachable, and navigation survives', { skip: !available && 'Install DSH and Chrome, or set DSH_PUPPETEER_MODULE / DSH_BROWSER_PATH', timeout: 60000 }, async t => {
  const { default: puppeteer } = await import(pathToFileURL(puppeteerModule).href)
  const { sheetText } = await loadTs('src/client/styles.ts')
  const source = readFileSync(hostModule, 'utf8')
  const match = source.match(/const css\$4 = ("(?:[^"\\]|\\.)*");/)
  assert.ok(match, 'installed host ConversationRoot CSS must be available')
  const hostCss = JSON.parse(match[1])
  const hostClasses = source.match(/var ConversationRoot_module_css_default = (\{[\s\S]*?\});/)
  assert.ok(hostClasses, 'installed host class map must be available')
  const className = key => {
    const found = hostClasses[1].match(new RegExp('"' + key + '": "([^" ]+)"'))
    assert.ok(found, `host ${key} CSS class is available`)
    return found[1]
  }
  const bundled = await build({
    stdin: { resolveDir: resolve('.'), loader: 'tsx', contents: `
      import React from 'react'; import {createRoot} from 'react-dom/client';
      import {GitWorkbenchPage} from './src/client/panels/GitWorkbenchPage.tsx';
      import {installGitSidechat,createGitSidechatOpener} from './src/client/sidechat-integration.tsx';
      import {pasteSidechatDraft} from './src/client/sidechat-draft.ts';
      window.__pasteGitDraft=(draft,signal)=>pasteSidechatDraft(document.querySelector('.dsh-git-sidechat-root'),draft,signal);
      window.__sideCalls=[];window.__sideSends=0;
      function RealControlledComposer(){
        const [draft,setDraft]=React.useState('已有草稿');const [ready,setReady]=React.useState(false);const [tick,setTick]=React.useState(0);
        React.useEffect(()=>{const timer=setTimeout(()=>setReady(true),30);return()=>clearTimeout(timer)},[]);
        window.__sideDraft=draft;
        return ready?<div><textarea value={draft} onChange={e=>setDraft(e.target.value)}/><button id="rerender-sidechat" onClick={()=>setTick(tick+1)}>rerender</button><button onClick={()=>window.__sideSends++}>发送</button></div>:<p>creating</p>;
      }
      const descriptors=new Map([['sidechat',{component:RealControlledComposer}]]);
      let sideRoot;
      const sidebar={getTab:id=>descriptors.get(id),subscribe:()=>()=>{},isTabEnabled:()=>true,
        registerTab:d=>{descriptors.set(d.id,d);return()=>descriptors.delete(d.id)},
        openTab(seed,scope){window.__sideCalls.push({seed,scope});let seat=document.getElementById('side-fixture');if(!seat){seat=document.createElement('aside');seat.id='side-fixture';seat.style='position:fixed;right:0;top:76px;bottom:0;width:360px;background:white;z-index:100';document.body.appendChild(seat);sideRoot=createRoot(seat)}const Comp=descriptors.get(seed.type).component;sideRoot.render(<React.StrictMode><Comp tab={{...seed}} scope={scope} visible={true}/></React.StrictMode>)}
      };
      installGitSidechat(sidebar);
      const onOpenGitSidechat=createGitSidechatOpener({get:()=>sidebar});
      window.__openGitSidechat=onOpenGitSidechat;
      createRoot(document.getElementById('fixture')).render(<GitWorkbenchPage cwd="/repo" sessionId="browser-test" onOpenGitSidechat={onOpenGitSidechat}
        useSessions={select=>select({byId:{'browser-test':{id:'browser-test',cwd:'/repo'}}})}
        useWorkspaces={select=>select({items:[]})} openView={()=>{}}/>);
    ` },
    bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'git-fixture', setup(api) {
      api.onResolve({ filter: /(?:^|\/)api\.js$/ }, () => ({ path: 'api', namespace: 'fixture' }))
      api.onResolve({ filter: /use-git-status\.js$/ }, () => ({ path: 'status', namespace: 'fixture' }))
      api.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents: args.path === 'status'
        ? `export function useGitStatus(){return {status:window.__gitData.status,isGit:true,loading:false,error:null,reload(){}}}`
        : `export const errorMessage=e=>e?.message||String(e); export const blobUrl=()=>''; export const getEndpointUrl=p=>p;
          export const gitApi=new Proxy({}, {get:(_,name)=>(...args)=> {
            const d=window.__gitData;
            if(name==='getDiff'&&args[4]?.mode==='staged')return Promise.resolve({...d.diff,files:[{...d.diff.files[0],rawPatch:'STAGED_PATCH_SENTINEL'}]});
            if(name==='getDiff'||name==='requestDiff')return Promise.resolve(d.diff);
            if(name==='getLog')return Promise.resolve(d.commits);
            if(name==='getCommitDetail')return Promise.resolve(d.detail);
            if(name==='getStashes')return Promise.resolve(d.stashes);
            if(name==='getWorktreesWithStatus'||name==='getWorktrees')return Promise.resolve(d.worktrees);
            if(name==='getReflog')return Promise.resolve([]);
            return Promise.resolve({ok:true});
          }});` }))
    } }],
  })
  const browser = await puppeteer.launch({ executablePath: browserPath, headless: true, args: ['--no-first-run', '--disable-background-networking'] })
  t.after(() => browser.close())
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setContent(`<style>html,body{height:100%;margin:0}#native{height:100%;display:flex;flex-direction:column}#fixture{display:contents}:root{--dsw-font-family:Arial,sans-serif;--ds-font-family-code:Consolas,monospace;--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#f1f3f5;--dsw-alias-label-primary:#18212f;--dsw-alias-label-secondary:#667085;--dsw-alias-border-l1:#e6e8ec;--dsw-alias-border-l2:#d0d5dd;--dsw-alias-brand-primary:#5865f2;--dsw-alias-state-success-primary:#16854b;--dsw-alias-state-error-primary:#c83442;--dsw-alias-state-warn-primary:#ad7600}${hostCss}${sheetText()}</style>
    <main id="native" class="${className('root')}"><header style="height:76px;flex:none;border-bottom:1px solid #eee">对话　轨迹　上下文　编队　Git</header>
    <div data-conversation-content class="${className('body')}"><div data-conversation-scroll class="${className('scrollBody')}"><div class="${className('viewArea')}"><div id="fixture"></div></div><div data-composer-seat class="${className('composerSeat')}">原聊天输入框</div></div></div></main>`)
  await page.evaluate(() => {
    const files=Array.from({length:80},(_,i)=>({path:`src/folder-${i}/file-${i}.ts`,status:'modified',insertions:250,deletions:1,binary:false,rawPatch:'',hunks:[{header:'@@ -1 +1,250 @@',oldStart:1,newStart:1,oldLines:1,newLines:250,lines:Array.from({length:250},(_,j)=>({type:'add',newNum:j+1,content:`const line${j} = 'example change';`}))}]}))
    window.__gitData={status:{isGit:true,branch:'master',head:'abc',revision:'one',root:'/repo',dirtyFiles:80,entries:[],conflicts:0},diff:{base:'HEAD',target:'working',files,totalInsertions:20000,totalDeletions:80},commits:[{hash:'abcdef123456',shortHash:'abcdef1',subject:'Test commit',author:'Example',date:'2026-10-16',parents:[],refs:[]}],detail:{hash:'abcdef123456',shortHash:'abcdef1',subject:'Test commit',body:'Details loaded',author:'Example',authorEmail:'a@example.test',committer:'Example',date:'2026-10-16',commitDate:'2026-10-16',parents:[],files:[],totalInsertions:0,totalDeletions:0},stashes:[],worktrees:[]}
  })
  await page.addScriptTag({ content: bundled.outputFiles[0].text })
  await page.waitForSelector('.dsh-git-file-row')
  async function wheel(selector) {
    const element = await page.$(selector)
    await element.hover()
    await page.mouse.wheel({ deltaY: 480 })
    await page.waitForFunction(sel => document.querySelector(sel).scrollTop > 0, { timeout: 3000 }, selector)
  }
  await wheel('.dsh-git-file-list')
  await wheel('.dsh-git-diff-lines')
  const layout = await page.evaluate(() => {
    const viewport=document.querySelector('.dsh-git-view-content'), pane=document.querySelector('.dsh-git-changes-body'), footer=document.querySelector('.dsh-git-commit-box')
    return {viewportBottom:viewport.getBoundingClientRect().bottom,paneHeight:pane.clientHeight,footerBottom:footer.getBoundingClientRect().bottom,overflow:getComputedStyle(viewport).overflowY,scrollHeight:viewport.scrollHeight,clientHeight:viewport.clientHeight}
  })
  assert.ok(layout.viewportBottom <= 901, JSON.stringify(layout))
  assert.ok(layout.paneHeight >= 280, JSON.stringify(layout))
  assert.match(layout.overflow, /auto|scroll/, 'whole page needs a vertical scroll owner')
  await page.$eval('.dsh-git-view-content', node => { node.scrollTop=node.scrollHeight })
  assert.ok(await page.$eval('.dsh-git-commit-box', node => node.getBoundingClientRect().bottom <= innerHeight+1), 'commit form must be reachable')
  await page.$eval('.dsh-git-view-content', node => { node.scrollTop=0 })
  if (process.env.DSH_WORKBENCH_SCREENSHOT_PATH) await page.screenshot({ path: process.env.DSH_WORKBENCH_SCREENSHOT_PATH, fullPage: false })
  // Exercise actual AI buttons through the integration and a controlled React composer.
  // StrictMode + delayed mounting reproduce the sidebar's asynchronous tab creation.
  const draftActions=['注入 Git 上下文','AI 审查改动','AI 写信息','解释改动'];
  for(let index=0;index<draftActions.length;index++) {
    await page.evaluate(label=>{const menu=document.querySelector('.dsh-git-file-menu');if(label==='解释改动')menu.open=true;[...document.querySelectorAll('.dsh-git-workbench button')].find(node=>node.textContent.trim()===label).click()},draftActions[index]);
    await page.waitForFunction(count=>window.__sideCalls.length===count,{timeout:5000},index+1);
    await page.waitForFunction(label=>document.querySelector('.dsh-git-action-notice')?.textContent.includes('「'+label+'」提示词，确认后再发送'),{timeout:5000},['Git 上下文','审查改动','提交信息','解释这个文件'][index]);
  }
  const afterDoubleClicks=await page.evaluate(async(labels)=>{
    for(const label of labels){const button=[...document.querySelectorAll('.dsh-git-workbench button')].find(node=>node.textContent.trim()===label);button.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:2}))}
    await new Promise(resolve=>requestAnimationFrame(resolve));return window.__sideCalls.length;
  },draftActions);
  assert.equal(afterDoubleClicks,4,'second clicks of a pointer double-click must not append more prompts');
  await page.click('#rerender-sidechat');
  const drafted=await page.evaluate(()=>({value:document.querySelector('#side-fixture textarea').value,state:window.__sideDraft,calls:window.__sideCalls,sends:window.__sideSends}));
  assert.equal(drafted.value,drafted.state,'controlled React state, not only the DOM, must accept the prompt');
  assert.ok(drafted.value.startsWith('已有草稿\n\n'));
  assert.equal(drafted.sends,0,'opening a side conversation must never auto-send');
  assert.equal((drafted.value.match(/仓库目录：\/repo/g)||[]).length,3,'StrictMode must not paste each prompt twice');
  assert.match(drafted.value,/STAGED_PATCH_SENTINEL/);
  for(const call of drafted.calls){assert.equal(call.seed.target,'right');assert.equal(call.scope.sessionId,'browser-test');assert.equal(call.scope.cwd,'/repo');assert.deepEqual(call.seed.meta,{autoCreate:true})}
  const windowsDraft=await page.evaluate(async()=>{await window.__openGitSidechat('browser-test','/repo','Windows patch\r\n+line one\r\n+line two\r');return window.__sideDraft});
  assert.ok(windowsDraft.includes('Windows patch\n+line one\n+line two\n'),'textarea newline normalization must not report a valid paste as failure');
  const replayedDraft=await page.evaluate(async()=>{
    const request={id:'aborted-effect',text:'Replay marker'};
    const first=new AbortController();const canceled=window.__pasteGitDraft(request,first.signal).catch(()=>{});first.abort();await canceled;
    const input=document.querySelector('#side-fixture textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,input.value+' (reader edit)');
    input.dispatchEvent(new Event('input',{bubbles:true}));
    await window.__pasteGitDraft(request,new AbortController().signal);
    return input.value;
  });
  assert.equal((replayedDraft.match(/Replay marker/g)||[]).length,1,'effect replay must not append again after a reader edit');
  assert.ok(replayedDraft.endsWith(' (reader edit)'));
  await page.$eval('#side-fixture',node=>{node.style.display='none'});
  await page.evaluate(() => [...document.querySelectorAll('.dsh-git-view-tab')].find(node=>node.textContent==='提交记录').click())
  await page.waitForSelector('.dsh-git-graph-row')
  await page.click('.dsh-git-graph-row')
  await page.waitForFunction(() => document.body.textContent.includes('Details loaded'), {timeout:5000})
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('.dsh-git-workbench button')].some(node=>/返回/.test(node.textContent))),false)
  await page.click('.dsh-git-tab-strip button:first-child')
  await page.waitForSelector('.dsh-git-graph-row', { visible: true })
  assert.deepEqual(errors, [])
  // A bad detail render must stay inside the local boundary, not retire the native view.
  await page.evaluate(() => { window.__gitData.detail.parents=null })
  await page.click('.dsh-git-graph-row')
  await page.waitForFunction(() => document.body.textContent.includes('无法显示提交详情'))
  assert.ok(await page.$eval('.dsh-git-tab-strip button:first-child', node=>node.getBoundingClientRect().height>0))
  await page.evaluate(() => { window.__gitData.detail.parents=[] })
  await page.click('.dsh-git-empty-state button')
  await page.waitForFunction(() => document.body.textContent.includes('Details loaded'))
  await page.click('.dsh-git-tab-strip button:first-child')
  await page.waitForSelector('.dsh-git-graph-row', { visible: true })
  assert.ok(errors.every(message=>message.includes('join')), JSON.stringify(errors))
  errors.length=0
  await page.evaluate(() => [...document.querySelectorAll('.dsh-git-view-tab')].find(node=>node.textContent==='储藏').click())
  await page.waitForFunction(() => document.body.textContent.includes('没有储藏'))
  assert.equal(await page.$eval('.dsh-git-page-header', node=>getComputedStyle(node).display), 'flex')
  if (process.env.DSH_WORKBENCH_SCREENSHOT_PATH) await page.screenshot({path:process.env.DSH_WORKBENCH_SCREENSHOT_PATH.replace(/\.png$/, '-stashes.png')})
  await page.evaluate(() => { window.__gitData.worktrees=Array.from({length:30},(_,i)=>({path:`/repo/worktrees/feature-${i}`,branch:`feature-${i}`,isCurrent:i===0,dirtyFiles:i%3,locked:false,detached:false})) })
  await page.evaluate(() => [...document.querySelectorAll('.dsh-git-view-tab')].find(node=>node.textContent==='工作树').click())
  await page.waitForFunction(() => document.querySelectorAll('.dsh-git-worktree-row').length===30)
  await wheel('.dsh-git-view-content')
  await page.$eval('.dsh-git-view-content', node=>{node.scrollTop=0})
  if (process.env.DSH_WORKBENCH_SCREENSHOT_PATH) await page.screenshot({path:process.env.DSH_WORKBENCH_SCREENSHOT_PATH.replace(/\.png$/, '-worktrees.png')})
  // Compact windows must keep both review panes and the commit controls reachable.
  await page.setViewport({width:560,height:640})
  await page.evaluate(() => [...document.querySelectorAll('.dsh-git-view-tab')].find(node=>node.textContent==='变更').click())
  await page.waitForSelector('.dsh-git-file-row')
  await page.$eval('.dsh-git-view-content', node=>{node.scrollTop=node.scrollHeight})
  assert.ok(await page.$eval('.dsh-git-commit-box', node=>node.getBoundingClientRect().bottom<=innerHeight+1))
  assert.deepEqual(errors, [])
})

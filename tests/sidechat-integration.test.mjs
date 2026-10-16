import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'
import { loadTs } from './helpers/load-ts.mjs'
registerHooks({load(url,context,next){if(url.endsWith('/sidechat-integration.tsx'))return {format:'module',shortCircuit:true,source:transformSync(readFileSync(new URL(url),'utf8'),{loader:'tsx',format:'esm'}).code};return next(url,context)}})
const { installGitSidechat,createGitSidechatOpener,GIT_SIDECHAT_TYPE }=await loadTs('src/client/sidechat-integration.tsx')

function fixture(){
 const descriptors=new Map([['sidechat',{component:()=>null,onClose(){closed++}}]])
 const calls=[];let closed=0;let open
 const sidebar={getTab:id=>descriptors.get(id),subscribe:()=>()=>{},isTabEnabled:()=>true,registerTab:d=>{descriptors.set(d.id,d);return()=>descriptors.delete(d.id)},openTab(seed,scope){calls.push({seed,scope})}}
 const dispose=installGitSidechat(sidebar,fn=>{open=fn})
 // Deliberately return a distinct proxy object, as different Cordis scopes may.
 const nativeCalls=[];let draft='';let pluginPresent=true
 const conversation={input:{for:ctx=>{assert.equal(ctx.sessionId,'new-1');return {state:{getSnapshot:()=>({draft})},setDraft:text=>{draft=text;nativeCalls.push(['draft',text])}}}}}
 const scope={get:name=>name==='betterSidebar'?(pluginPresent?new Proxy(sidebar,{}):undefined):name==='conversation'?conversation:undefined,
   sessions:{create:async opts=>{nativeCalls.push(['create',opts]);return 'new-1'},using:async(id,options,run)=>{assert.equal(id,'new-1');assert.deepEqual(options,{source:'plugin'});await run({binding:{ctx:{sessionId:id}}});nativeCalls.push(['released'])}},
   uiWorkspace:{openSession:async id=>{nativeCalls.push(['open',id])}}}
 const opener=createGitSidechatOpener(scope,()=>open)
 return {sidebar,descriptors,calls,dispose,opener,nativeCalls,removePlugin(){pluginPresent=false},get draft(){return draft},get closed(){return closed}}
}

test('sidechat tab is hidden, reuses the actual sidebar conversation, and isolates session ownership',async t=>{
 const f=fixture();t.after(f.dispose)
 const descriptor=f.descriptors.get(GIT_SIDECHAT_TYPE)
 assert.equal(descriptor.hidden,true);assert.equal(descriptor.single,true)
 const pending=f.opener('parent-1','/repo','sensitive prompt')
 const rejected=assert.rejects(pending,/已关闭/)
 assert.equal(f.calls.length,1)
 assert.deepEqual(f.calls[0].scope,{sessionId:'parent-1',cwd:'/repo'})
 assert.equal(f.calls[0].seed.target,'right')
 assert.deepEqual(f.calls[0].seed.meta,{autoCreate:true})
 assert.ok(!JSON.stringify(f.calls[0]).includes('sensitive prompt'),'raw patches must not enter persisted tab metadata')
 descriptor.onClose({id:GIT_SIDECHAT_TYPE},{sessionId:'parent-1',cwd:'/repo'})
 await rejected
 assert.equal(f.closed,1,'native sidechat lifecycle cleanup is preserved')
 assert.equal(f.nativeCalls.length,0,'a sidechat failure must not create a duplicate ordinary conversation')
})
test('a disabled sidechat falls back to an ordinary new conversation and fills only its draft',async t=>{
 const f=fixture();t.after(f.dispose)
 await assert.rejects(f.opener(undefined,'/repo','text'),/当前会话/)
 f.sidebar.isTabEnabled=()=>false
 assert.equal(await f.opener('s','/repo','text'),'conversation')
 assert.equal(f.calls.length,0)
 assert.equal(f.draft,'text')
 assert.deepEqual(f.nativeCalls,[['create',{cwd:'/repo'}],['draft','text'],['open','new-1'],['released']])
})
test('an absent sidebar plugin also creates a new conversation in the exact repository',async t=>{
 const f=fixture();t.after(f.dispose);f.removePlugin()
 assert.equal(await f.opener('parent','/another-repo','prompt'),'conversation')
 assert.deepEqual(f.nativeCalls[0],['create',{cwd:'/another-repo'}])
 assert.equal(f.draft,'prompt');assert.equal(f.calls.length,0)
})
test('double clicks share one pending sidechat insertion and failures clear the guard',async t=>{
 const f=fixture();t.after(f.dispose)
 const first=f.opener('s','/repo','prompt')
 const duplicate=f.opener('s','/repo','prompt')
 assert.equal(first,duplicate)
 assert.equal(f.calls.length,1)
 const rejected=assert.rejects(first,/已关闭/)
 f.descriptors.get(GIT_SIDECHAT_TYPE).onClose({id:GIT_SIDECHAT_TYPE},{sessionId:'s'})
 await rejected
 const retry=f.opener('s','/repo','prompt')
 assert.notEqual(retry,first)
 assert.equal(f.calls.length,2)
 const retried=assert.rejects(retry,/已关闭/)
 f.descriptors.get(GIT_SIDECHAT_TYPE).onClose({id:GIT_SIDECHAT_TYPE},{sessionId:'s'})
 await retried
})
test('double clicks create only one fallback conversation while later intentional clicks still work',async t=>{
 const f=fixture();t.after(f.dispose);f.removePlugin()
 const first=f.opener('s','/repo','prompt')
 assert.equal(f.opener('s','/repo','prompt'),first)
 await first
 assert.equal(f.nativeCalls.filter(call=>call[0]==='create').length,1)
 await f.opener('s','/repo','prompt')
 assert.equal(f.nativeCalls.filter(call=>call[0]==='create').length,2)
})
test('unloading the integration cancels queued requests and clears scoped callbacks',async()=>{
 const f=fixture()
 const pending=f.opener('s','/repo','text')
 const rejected=assert.rejects(pending,/已卸载/)
 f.dispose();await rejected
 assert.equal(f.descriptors.has(GIT_SIDECHAT_TYPE),false)
 assert.equal(await f.opener('s','/repo','fallback'),'conversation')
 assert.equal(f.draft,'fallback')
})

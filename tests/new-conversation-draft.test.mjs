import test from 'node:test'
import assert from 'node:assert/strict'
import {loadTs} from './helpers/load-ts.mjs'
const {openNewConversationDraft}=await loadTs('src/client/new-conversation-draft.ts')
function fixture(){
 const calls=[];let draft='已有草稿'
 const input={state:{getSnapshot:()=>({draft})},setDraft:text=>{draft=text;calls.push('draft')}}
 const conversation={input:{for:ctx=>{assert.deepEqual(ctx,{id:'new-session'});return input}}}
 const scope={get:key=>key==='conversation'?conversation:undefined,
 sessions:{create:async opts=>{calls.push(opts);return 'new-session'},using:async(id,options,run)=>{assert.equal(id,'new-session');assert.equal(options.source,'plugin');try{return await run({binding:{ctx:{id}}})}finally{calls.push('release')}},prompt(){throw new Error('must not send')}},
 uiWorkspace:{openSession:id=>{assert.equal(id,'new-session');calls.push('open')}}}
 return {scope,calls,input,get draft(){return draft}}
}
test('new-conversation fallback preserves an existing draft, writes through native input, then retains main view before release',async()=>{
 const f=fixture();await openNewConversationDraft(f.scope,'/repo','Git prompt')
 assert.equal(f.draft,'已有草稿\n\nGit prompt')
 assert.deepEqual(f.calls,[{cwd:'/repo'},'draft','open','release'])
})
test('missing native input capability fails before creating an empty conversation',async()=>{
 const f=fixture();f.scope.get=()=>undefined
 await assert.rejects(openNewConversationDraft(f.scope,'/repo','text'),/不支持/)
 assert.deepEqual(f.calls,[])
})
test('a refused draft is not reported as success or opened, and the created session is identified',async()=>{
 const f=fixture();f.input.setDraft=()=>{}
 await assert.rejects(openNewConversationDraft(f.scope,'/repo','text'),/new-session 已创建.*未接受提示词/)
 assert.deepEqual(f.calls,[{cwd:'/repo'},'release'])
})
test('navigation failure does not retry creation or erase the prepared draft',async()=>{
 const f=fixture();f.scope.uiWorkspace.openSession=()=>{throw new Error('navigation refused')}
 await assert.rejects(openNewConversationDraft(f.scope,'/repo','text'),/new-session 已创建.*navigation refused/)
 assert.equal(f.calls.filter(call=>typeof call==='object').length,1)
 assert.equal(f.draft,'已有草稿\n\ntext')
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './helpers/load-ts.mjs'
const bridge = await loadTs('src/client/agent-bridge.ts')

test('context describes repository, branch, tracking and every change section', () => {
  const text = bridge.buildContextText({cwd:'/repo',branch:'feature/lane',upstream:'origin/feature/lane',ahead:2,behind:1,summary:'3 个文件 +12 -2',staged:['src/a.ts'],unstaged:['src/b.ts'],conflicts:['src/d.ts']})
  assert.match(text,/Repository directory:\/repo/)
  assert.match(text,/Current branch:feature\/lane, tracking origin\/feature\/lane, ahead 2 commits, behind 1 commits/)
  assert.match(text,/Staged\(1\):\n {2}- src\/a\.ts/)
  assert.match(text,/Untracked:\(empty\)/)
})
test('commit, review and explain prompts contain actual patches and clear instructions', () => {
  const context={branch:'main',staged:['src/a.ts'],patch:'diff --git a/src/a.ts b/src/a.ts\n+x'}
  assert.match(bridge.buildCommitPrompt(context),/4\. Output only the commit message itself/)
  assert.match(bridge.buildCommitPrompt(context),/```diff\ndiff --git/)
  assert.match(bridge.buildCommitPrompt({}),/\(no patch to display for the index\)/)
  assert.match(bridge.buildReviewPrompt(context),/Please review these changes/)
  assert.match(bridge.buildExplainPrompt({path:'src/b.ts',patch:'patch',statusLabel:'Added'}),/Please explain `src\/b\.ts`\(Added\)/)
})
test('patch truncation and nested fences cannot corrupt the prompt boundary', () => {
  assert.match(bridge.truncatePatch('+x\n'.repeat(4000),500),/the patch is too long and was truncated/)
  assert.match(bridge.fence('```\ninner\n```'),/^````diff\n/)
})
test('delivery opens the owning session side conversation and waits until the draft is accepted', async () => {
  const calls=[]
  let accept
  const scope={cwd:'/repo', onOpenGitSidechat:(...args)=>{calls.push(args);return new Promise(resolve=>{accept=resolve})},sessions:{using(){throw new Error('MUST NOT send to the main agent')}}}
  let done=false
  const pending=bridge.deliverPrompt(scope,'session-1','hello agent').then(result=>{done=true;return result})
  await Promise.resolve()
  assert.equal(done,false)
  assert.deepEqual(calls,[['session-1','/repo','hello agent']])
  accept()
  assert.deepEqual(await pending,{ok:true,mode:'drafted'})
})
test('delivery reports a new-conversation draft distinctly from a sidechat draft', async () => {
  assert.deepEqual(await bridge.deliverPrompt({cwd:'/repo',onOpenGitSidechat:async()=> 'conversation'},'parent','prompt'),{ok:true,mode:'new-conversation'})
})
test('delivery failures are explicit and never silently copied or sent', async () => {
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator')
  let copies=0
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText(){copies++}}}})
  try {
    assert.equal((await bridge.deliverPrompt({},undefined,'text')).ok,false)
    assert.equal((await bridge.deliverPrompt({},'session-1','text')).ok,false)
    assert.deepEqual(await bridge.deliverPrompt({cwd:'/repo',onOpenGitSidechat:async()=>{throw new Error('侧边对话已停用')}},'session-1','text'),{ok:false,error:'侧边对话已停用'})
    assert.equal(copies,0)
  } finally {if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator}
})

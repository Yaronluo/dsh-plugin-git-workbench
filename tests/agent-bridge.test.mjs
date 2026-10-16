import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './helpers/load-ts.mjs'
const bridge = await loadTs('src/client/agent-bridge.ts')

test('context describes repository, branch, tracking and every change section', () => {
  const text = bridge.buildContextText({cwd:'/repo',branch:'feature/lane',upstream:'origin/feature/lane',ahead:2,behind:1,summary:'3 个文件 +12 -2',staged:['src/a.ts'],unstaged:['src/b.ts'],conflicts:['src/d.ts']})
  assert.match(text,/仓库目录：\/repo/)
  assert.match(text,/当前分支：feature\/lane，跟踪 origin\/feature\/lane，领先 2 个提交，落后 1 个提交/)
  assert.match(text,/已暂存（1）：\n {2}- src\/a\.ts/)
  assert.match(text,/未跟踪：（空）/)
})
test('commit, review and explain prompts contain actual patches and clear instructions', () => {
  const context={branch:'main',staged:['src/a.ts'],patch:'diff --git a/src/a.ts b/src/a.ts\n+x'}
  assert.match(bridge.buildCommitPrompt(context),/只输出提交信息本身/)
  assert.match(bridge.buildCommitPrompt(context),/```diff\ndiff --git/)
  assert.match(bridge.buildCommitPrompt({}),/暂存区没有可展示的补丁/)
  assert.match(bridge.buildReviewPrompt(context),/请审查这些改动/)
  assert.match(bridge.buildExplainPrompt({path:'src/b.ts',patch:'patch',statusLabel:'新增'}),/请解释 `src\/b\.ts`（新增）/)
})
test('patch truncation and nested fences cannot corrupt the prompt boundary', () => {
  assert.match(bridge.truncatePatch('+x\n'.repeat(4000),500),/补丁过长，已截断/)
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

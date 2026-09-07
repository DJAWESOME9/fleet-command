import test from 'node:test';
import assert from 'node:assert/strict';
import {Multiplayer} from '../src/multiplayer.js';

function client(t) {
  const previous=globalThis.sessionStorage;
  globalThis.sessionStorage={getItem:()=>null,setItem(){},removeItem(){}};
  t.after(()=>{globalThis.sessionStorage=previous;});
  const errors=[];
  const c=new Multiplayer(()=>{},message=>errors.push(message));
  c.session={code:'ABCDEF12',token:'a'.repeat(48)};c.connected=true;c.state={version:1};
  return {c,errors};
}
test('late poll cannot roll back a successfully submitted action',async t=>{
  const {c}=client(t);let resolvePoll;
  c.request=async(path,body)=>body?{version:2}:new Promise(resolve=>{resolvePoll=resolve;});
  const poll=c.poll();await c.command('action',{action:{kind:'fire'}});
  assert.equal(c.state.version,2);
  resolvePoll({version:1});await poll;
  assert.equal(c.state.version,2);
});
test('ambiguous failed order is refreshed without resubmitting it',async t=>{
  const {c,errors}=client(t);let writes=0,reads=0;
  c.request=async(path,body)=>{if(body){writes++;throw Error('Connection interrupted.');}reads++;return{version:2};};
  await c.command('action',{action:{kind:'fire'}});
  assert.equal(writes,1);assert.equal(reads,1);assert.equal(c.state.version,2);
  assert.equal(c.busy,false);assert.match(errors[0],/interrupted/);
});
test('expired room stops reconnect polling and allows local exit',async t=>{
  const {c}=client(t);let calls=0;
  c.request=async()=>{calls++;const e=Error('Room expired.');e.status=404;throw e;};
  await c.poll();await c.poll();
  assert.equal(calls,1);assert.equal(c.unavailable,true);assert.equal(c.connected,false);
  c.leave();assert.equal(c.session,null);assert.equal(c.unavailable,false);
});
test('late response from a departed room is ignored',async t=>{
  const {c}=client(t);let complete;
  c.request=()=>new Promise(resolve=>{complete=resolve;});
  const pending=c.poll();c.leave();complete({version:2});await pending;
  assert.equal(c.session,null);assert.equal(c.state,null);
});

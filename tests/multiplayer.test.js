import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore, perspective} from '../server/rooms.js';
import {createGame} from '../src/engine.js';
import {createServer} from '../server.js';

const config = {size:10,budget:90,mode:'standard'};
function fleet(types=['needle','mako','echo','needle']) {
  const roster=types.map(type=>typeof type==='string'?{type}:type);
  const game=createGame({...config,roster,mines:1});
  const p=game.players[0];
  return {roster,mines:1,ships:p.ships.map(s=>({x:s.x,y:s.y,rotation:s.rotation,planes:s.type==='osprey'?[0]:[]})),minePositions:p.mines};
}
function lobby(options={}) {
  const store=new RoomStore(),host=store.create({...config,...options},'Host'),guest=store.join(host.code,'Guest');
  return {store,host,guest,room:store.get(host.code)};
}
function command(ctx,player,kind,payload={}) {return ctx.store.command(ctx.room,player,{version:ctx.room.version,kind,...payload});}
function battle(types,options={}) {
  const ctx=lobby(options);
  command(ctx,0,'ready',{fleet:fleet(types)});command(ctx,1,'ready',{fleet:fleet(types)});
  return ctx;
}

test('rooms enforce authentication, capacity and private deployment',()=>{
  const ctx=lobby();
  assert.throws(()=>ctx.store.authenticate(ctx.host.code,'wrong'),/Invalid room session/);
  assert.throws(()=>ctx.store.join(ctx.host.code,'Third'),/two commanders/);
  assert.equal(ctx.store.authenticate(ctx.host.code,ctx.guest.token).player,1);
  command(ctx,0,'ready',{fleet:fleet()});
  const view=ctx.store.view(ctx.room,1);
  assert.equal(view.opponent.ready,true);assert.equal(view.deployment,null);assert.equal(view.game,null);
  assert.ok(!JSON.stringify(view).includes(ctx.host.token));
  assert.throws(()=>command(ctx,0,'ready',{fleet:fleet()}),/locked/);
});
test('server rejects bad fleet layouts and ignores forged combat resources',()=>{
  const ctx=lobby(),bad=fleet();bad.ships[0].x=-1;
  const version=ctx.room.version;
  assert.throws(()=>command(ctx,0,'ready',{fleet:bad}),/fit/);
  assert.equal(ctx.room.version,version);assert.equal(ctx.room.seats[0].fleet,null);
  const good=fleet();good.ships[0].hp=999;good.ships[0].repairs=999;
  command(ctx,0,'ready',{fleet:good});
  assert.equal(ctx.room.seats[0].fleet.ships[0].repairs,1);
  assert.equal(ctx.room.seats[0].fleet.ships[0].cells[0].hp,1);
});
test('both clients see themselves as player zero and cannot act out of turn or replay',()=>{
  const ctx=battle(),who=ctx.room.game.turn,version=ctx.room.version;
  assert.equal(ctx.store.view(ctx.room,who).game.turn,0);
  assert.equal(ctx.store.view(ctx.room,1-who).game.turn,1);
  const order={kind:'action',version,action:{shipId:'ship-0',kind:'fire',x:0,y:0}};
  assert.throws(()=>ctx.store.command(ctx.room,1-who,order),/turn/);
  ctx.store.command(ctx.room,who,order);
  const after=structuredClone(ctx.room.game);
  assert.throws(()=>ctx.store.command(ctx.room,who,order),/room changed/);
  assert.deepEqual(ctx.room.game,after);
});
test('opponent views exclude ship identity, positions, supplies, mines, intel and private scan logs',()=>{
  for(const player of [0,1])for(const [type,kind] of [['beacon','radar'],['wraith','hydrophone'],['osprey','scan']]){
    const ctx=battle([type,'needle','needle','needle']);ctx.room.game.turn=player;
    command(ctx,player,'action',{action:{shipId:'ship-0',kind,x:0,y:0}});
    const own=ctx.store.view(ctx.room,player).game,other=ctx.store.view(ctx.room,1-player).game;
    assert.deepEqual(Object.keys(other.players[1]).sort(),['mines','ships','shots']);
    assert.deepEqual(other.players[1].mines,[]);
    assert.ok(other.players[1].ships.every(s=>!s.type&&!s.captain&&!s.repairs&&s.cells.length===0));
    assert.equal(other.log.at(-1),'Your opponent used reconnaissance.');
    if(kind==='radar')assert.equal(own.players[0].intel.length,1);
    else {assert.equal(own.players[0].scans.length,1);assert.match(own.log.at(-1),/intact/);}
  }
});
test('perspective preserves retaliation resume state and winner for either seat',()=>{
  const ctx=battle();const state=ctx.room.game;
  state.resume={turn:1,actionsLeft:3};state.winner=1;
  const reversed=perspective(state,1);
  assert.equal(reversed.resume.turn,0);assert.equal(reversed.winner,0);
  assert.deepEqual(perspective(reversed,1),state);
});
test('reconnect returns authoritative state; either seat can concede and sees the right winner',()=>{
  for(const player of [0,1]){
    const ctx=battle();command(ctx,player,'concede');
    const credential=player?ctx.guest:ctx.host;
    const reconnect=ctx.store.authenticate(credential.code,credential.token);
    const own=ctx.store.view(reconnect.room,reconnect.player).game;
    assert.equal(own.phase,'finished');assert.equal(own.winner,1);
    assert.equal(ctx.store.view(ctx.room,1-player).game.winner,0);
    assert.ok(own.players[1].ships.every(s=>s.cells.length>0));
  }
});
test('two human seats can finish standard and salvo games with retaliation',()=>{
  for(const mode of ['standard','salvo']){
    const ctx=battle([{type:'needle',captain:'voss'},'needle','needle','needle'],{mode});
    let count=0;
    while(ctx.room.game.phase==='battle'&&count++<200){
      const g=ctx.room.game,who=g.turn,p=g.players[who],enemy=g.players[1-who];
      const ship=p.ships.find(s=>p.bonus||(!s.sunk&&(mode!=='salvo'||!p.used.includes(s.id))));
      const target=enemy.ships.flatMap(s=>s.cells).find(c=>c.hp>0)||{x:0,y:0};
      command(ctx,who,'action',{action:{shipId:ship.id,kind:'fire',x:target.x,y:target.y}});
    }
    assert.equal(ctx.room.game.phase,'finished');assert.ok(count<200);
  }
});
test('HTTP API supports join, authenticated reload, JSON errors and public asset allowlist',async t=>{
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const post=(path,body,headers={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  const created=await post('/api/rooms',{config,name:'Captain'});assert.equal(created.status,201);
  const host=await created.json();
  const guest=await (await post(`/api/rooms/${host.code}/join`,{name:'Friend'})).json();assert.ok(guest.token);
  const read=await fetch(`${base}/api/rooms/${host.code}`,{headers:{Authorization:`Bearer ${host.token}`}});
  assert.equal(read.headers.get('cache-control'),'no-store');assert.equal((await read.json()).opponent.name,'Friend');
  assert.equal((await fetch(`${base}/api/rooms/${host.code}`)).status,401);
  assert.equal((await post('/api/rooms',{}, {Origin:'https://unrelated.example'})).status,403);
  for(const path of ['/server.js','/server/rooms.js','/.git/config','/tests/engine.test.js'])assert.equal((await fetch(base+path)).status,404);
  assert.equal((await fetch(base+'/src/multiplayer.js')).status,200);
});

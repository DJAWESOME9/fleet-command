import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame as createRealGame,minimumShips,startBattle,act,botStep,fleetCost,movePlacement,getView} from '../src/engine.js';
// Isolated combat fixtures trim a legally purchased fleet after creation.
// Production fleet validation is exercised directly in the tests below.
function createGame(options={}){
 const original=options.roster||[];
 const roster=[...original];
 const filler=['needle','mako','echo'];let fi=0;while(roster.length<minimumShips(options.size||12)){const type=filler[fi++%filler.length];if(roster.filter(r=>r.type===type).length<2)roster.push({type});}
 const g=createRealGame({...options,roster});
 g.players[0].ships=g.players[0].ships.slice(0,original.length);
 g.players[0].cost=fleetCost(original,options.mines||0);
 return g;
}
function game(roster=[{type:'bulwark'}],opts={}){const g=createGame({roster,...opts});startBattle(g);g.turn=0;g.actionsLeft=g.mode==='salvo'?roster.length:1;return g;}
function place(s,x,y){const dx=x-s.x,dy=y-s.y;s.cells.forEach(c=>{c.x+=dx;c.y+=dy;});s.x=x;s.y=y;}
function targetShip(g,type='needle',captain=null){const other=createGame({roster:[{type,captain}]});g.players[1]=other.players[0];return g.players[1].ships[0];}
function fire(g,c){return act(g,{shipId:g.players[0].ships[0].id,kind:'fire',x:c.x,y:c.y});}
function variedRoster(count){const types=['needle','mako','echo'];return Array.from({length:count},(_,i)=>({type:types[i%types.length]}));}
test('costs include escalating mines and captains',()=>assert.equal(fleetCost([{type:'needle',captain:'ward'}],3),16));
test('reject budget and duplicate captains',()=>{assert.throws(()=>createGame({budget:4,roster:[{type:'mako'}]}));assert.throws(()=>createGame({roster:[{type:'needle',captain:'ward'},{type:'needle',captain:'ward'}]}));});
test('lower cost fleet opens',()=>{const g=createGame({roster:[{type:'needle'}]});startBattle(g);assert.equal(g.turn,0);});
test('armor needs repeated shots and repeat hit grants turn',()=>{const g=game(undefined,{repeatOnHit:true});const s=targetShip(g,'bulwark');const c={...s.cells[1]};fire(g,c);assert.equal(g.turn,0);assert.equal(g.players[1].ships[0].cells[1].hp,1);fire(g,c);assert.equal(g.players[1].ships[0].cells[1].hp,0);});
test('invalid action is atomic',()=>{const g=game();const before=structuredClone(g);assert.throws(()=>fire(g,{x:-1,y:0}));assert.deepEqual(g,before);});
test('salvo gives one action per living ship',()=>{const g=game([{type:'needle'},{type:'mako'}],{mode:'salvo'});fire(g,{x:0,y:0});assert.equal(g.actionsLeft,1);assert.equal(g.turn,0);assert.throws(()=>fire(g,{x:1,y:0}),/already acted/);act(g,{shipId:'ship-1',kind:'fire',x:1,y:0});assert.equal(g.turn,1);});
test('movement carries damage and blocks overlap',()=>{const g=createGame({roster:[{type:'bulwark'}]});movePlacement(g,'ship-0',2,2,0);startBattle(g);g.turn=0;const s=g.players[0].ships[0];s.cells[1].hp=1;act(g,{shipId:s.id,kind:'forward'});assert.equal(g.players[0].ships[0].cells[1].x,4);assert.equal(g.players[0].ships[0].cells[1].hp,1);});
test('radar cannot find subs, sonar cannot find surfaces or mines',()=>{for(const [type,enemyType,kind]of [['beacon','wraith','radar'],['echo','needle','sonar']]){const g=game([{type}]);targetShip(g,enemyType);if(kind==='sonar')g.players[1].mines=[{x:0,y:0}];act(g,{shipId:'ship-0',kind});assert.equal(g.players[0].intel.length,0);}});
test('radar can find a mine',()=>{const g=game([{type:'beacon'}]);targetShip(g,'wraith');g.players[1].mines=[{x:0,y:0}];act(g,{shipId:'ship-0',kind:'radar'});assert.deepEqual(g.players[0].intel,[{x:0,y:0,kind:'radar'}]);});
test('repair finite, restores destroyed section on living hull',()=>{const g=game([{type:'needle'}]);g.players[0].ships[0].cells[0].hp=0;let c=g.players[0].ships[0].cells[0];act(g,{shipId:'ship-0',kind:'repair',x:c.x,y:c.y});assert.equal(g.players[0].ships[0].repairs,0);assert.equal(g.players[0].ships[0].cells[0].hp,1);g.turn=0;g.players[0].ships[0].cells[0].hp=0;assert.throws(()=>act(g,{shipId:'ship-0',kind:'repair',x:c.x,y:c.y}),/No repairs/);});
test('Voss retaliates before final victory',()=>{const g=game();const e=targetShip(g,'needle','voss');e.cells[0].hp=0;fire(g,e.cells[1]);assert.equal(g.phase,'battle');assert.equal(g.turn,1);assert.equal(g.players[1].bonus,3);for(let i=0;i<3;i++)act(g,{shipId:'ship-0',kind:'fire',x:11,y:i});assert.equal(g.phase,'finished');assert.equal(g.winner,0);});
test('Pike bonus requires adjacent cell and does not chain',()=>{const g=game([{type:'needle',captain:'pike'}]);const e=targetShip(g,'bulwark');const c={...e.cells[1]};fire(g,c);assert.equal(g.players[0].bonus,1);assert.throws(()=>fire(g,c),/adjacent/);const next=[{x:c.x+1,y:c.y},{x:c.x-1,y:c.y}].find(c=>c.x>=0&&c.x<g.size);fire(g,next);assert.equal(g.players[0].bonus,0);assert.equal(g.turn,1);});
test('view hides enemy deployment and mines',()=>{const g=game();const v=getView(g);assert.deepEqual(v.players[1].mines,[]);assert.ok(v.players[1].ships.every(s=>!s.type&&s.cells.length===0));});
test('bot plays legal full matches across modes and difficulties',()=>{for(const mode of ['standard','salvo'])for(const difficulty of ['easy','normal','hard','expert']){const g=game([{type:'needle',captain:'voss'},{type:'mako'}],{mode,difficulty});let steps=0;while(g.phase==='battle'&&steps++<6000){if(g.turn===1)botStep(g);else{const p=g.players[0],s=p.ships.find(s=>p.bonus||(!s.sunk&&(mode!=='salvo'||!p.used.includes(s.id))));const x=steps%g.size,y=Math.floor(steps/g.size)%g.size;act(g,{shipId:s.id,kind:'fire',x,y});}}assert.equal(g.phase,'finished',`${mode}/${difficulty}`);}});

test('concede ends battle during either turn and clears pending retaliation',async()=>{const {concede}=await import('../src/engine.js');for(const turn of [0,1]){const g=game();g.turn=turn;g.players[0].bonus=3;g.resume={turn:1,actionsLeft:1};concede(g);assert.equal(g.phase,'finished');assert.equal(g.winner,1);assert.equal(g.reason,'concession');assert.equal(g.players[0].bonus,0);assert.equal(g.resume,null);assert.ok(getView(g).players[1].ships.every(s=>s.cells.length>0));const before=structuredClone(g);botStep(g);assert.deepEqual(g,before);assert.throws(()=>fire(g,{x:0,y:0}));}});
test('concede rejects deployment',async()=>{const {concede}=await import('../src/engine.js');const g=createGame({roster:[{type:'needle'}]});assert.throws(()=>concede(g));assert.equal(g.phase,'deployment');});

test('movement preview matches legality without consuming an action',async()=>{const {legalMoves}=await import('../src/engine.js');const g=createGame({roster:[{type:'needle'}]});movePlacement(g,'ship-0',0,0,0);startBattle(g);g.turn=0;const before=structuredClone(g);assert.deepEqual(legalMoves(g,'ship-0'),{forward:true,backward:false});assert.deepEqual(g,before);g.turn=1;assert.deepEqual(legalMoves(g,'ship-0'),{forward:false,backward:false});g.turn=0;g.players[0].bonus=1;assert.deepEqual(legalMoves(g,'ship-0'),{forward:false,backward:false});});

test('movement previews follow every facing and block mines',async()=>{const {legalMoves}=await import('../src/engine.js');for(let r=0;r<4;r++){const g=createGame({roster:[{type:'needle'}]});movePlacement(g,'ship-0',4,4,r);startBattle(g);g.turn=0;assert.deepEqual(legalMoves(g,'ship-0'),{forward:true,backward:true});const s=g.players[0].ships[0];const [dx,dy]=[[1,0],[0,1],[-1,0],[0,-1]][r];const next=s.cells.map(c=>({x:c.x+dx,y:c.y+dy})).find(c=>!s.cells.some(o=>o.x===c.x&&o.y===c.y));g.players[0].mines.push(next);assert.equal(legalMoves(g,'ship-0').forward,false);assert.throws(()=>act(g,{shipId:'ship-0',kind:'forward'}),/blocked/);}});


test('map sizes enforce minimum ships, ignoring captains and mines',()=>{
 for(const [size,count] of [[10,4],[12,5],[16,7],[20,9]]){
  assert.equal(minimumShips(size),count);
  const roster=variedRoster(count-1);
  roster[0].captain='ward';
  assert.throws(()=>createRealGame({size,budget:90,roster,mines:3}),/requires at least/);
  const valid=createRealGame({size,budget:90,roster:[...roster,{type:'needle'}],mines:3});
  assert.equal(valid.players[0].ships.length,count);
  assert.ok(valid.players[1].ships.length>=count);
 }
});
test('bot reserves enough budget for minimum hull count',()=>{
 for(const [size,budget] of [[10,30],[12,30],[16,30],[20,45]]){
  const roster=Array.from({length:minimumShips(size)},()=>({type:'needle'}));
  for(let i=0;i<15;i++){
   const g=createRealGame({size,budget,roster});
   assert.ok(g.players[1].ships.length>=minimumShips(size));
   assert.ok(g.players[1].cost<=budget);
  }
 }
});

test('carrier planes can be placed on hull sections and a hit destroys the plane',async()=>{
 const {togglePlanePlacement}=await import('../src/engine.js');
 const g=createRealGame({size:12,budget:90,roster:[{type:'osprey'},...Array.from({length:4},()=>({type:'needle'}))]});
 const carrier=g.players[0].ships.find(s=>s.type==='osprey');
 assert.deepEqual(carrier.planes,[]);togglePlanePlacement(g,carrier.id,0);assert.deepEqual(carrier.planes,[0]);assert.equal(carrier.uses,1);
 startBattle(g);g.turn=1;const enemy=g.players[0];const cell=carrier.cells[0];
 // Replace the bot's turn with a controlled shot at the carrier's plane square.
 act(g,{shipId:g.players[1].ships[0].id,kind:'fire',x:cell.x,y:cell.y});
 const updated=g.players[0].ships.find(s=>s.id===carrier.id);assert.deepEqual(updated.planes,[]);assert.equal(updated.uses,0);assert.ok(g.log.some(l=>l.includes('reconnaissance plane was destroyed')));
});

test('plane placement is limited to carriers and deployment',async()=>{const {togglePlanePlacement}=await import('../src/engine.js');const g=createRealGame({roster:[{type:'osprey'},...Array.from({length:4},()=>({type:'needle'}))]});assert.throws(()=>togglePlanePlacement(g,'ship-1',0),/carrier/);togglePlanePlacement(g,'ship-0',0);assert.throws(()=>{startBattle(g);togglePlanePlacement(g,'ship-0',1)},/deployment/);});

test('launching a reconnaissance plane removes it from the carrier deck',async()=>{const {togglePlanePlacement}=await import('../src/engine.js');const g=createRealGame({roster:[{type:'osprey'},...Array.from({length:4},()=>({type:'needle'}))]});togglePlanePlacement(g,'ship-0',0);startBattle(g);g.turn=0;const s=g.players[0].ships[0];act(g,{shipId:s.id,kind:'scan',x:0,y:0});assert.deepEqual(g.players[0].ships[0].planes,[]);assert.equal(g.players[0].ships[0].uses,0);});

test('specialized hull copy limits are enforced',()=>{const roster=[{type:'beacon'},{type:'beacon'},{type:'needle'},{type:'needle'},{type:'needle'}];assert.throws(()=>createRealGame({budget:90,roster}),/Beacon Radar Cutter is limited to 1/);});

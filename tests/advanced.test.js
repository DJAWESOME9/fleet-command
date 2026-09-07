import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startBattle,act,movePlacement,togglePlanePlacement} from '../src/engine.js';
function fixture(type,captain=null){const g=createGame({size:20,budget:200,roster:[{type,captain},...Array.from({length:8},()=>({type:'needle'}))]});return g;}
function ready(g){startBattle(g);g.turn=0;g.actionsLeft=1;return g;}
test('Atlas planes occupy distinct cells and Park expands a scan without adding flights',()=>{
 const g=fixture('atlas','park'),s=g.players[0].ships[0];for(let i=0;i<3;i++)togglePlanePlacement(g,s.id,i);
 ready(g);act(g,{shipId:s.id,kind:'wideScan',x:0,y:0});const updated=g.players[0].ships[0];assert.equal(updated.uses,2);assert.equal(updated.planes.length,2);assert.equal(updated.captainUses,0);assert.equal(g.players[0].scans[0].size,5);
 g.turn=0;assert.throws(()=>act(g,{shipId:s.id,kind:'wideScan',x:0,y:0}),/exhausted/);
});
test('Mercer support repairs consume support supply and remain silent',()=>{
 const g=ready(fixture('lantern','mercer')),target=g.players[0].ships[1];target.cells[0].hp=0;const count=g.log.length;
 act(g,{shipId:'ship-0',kind:'fieldRepair',x:target.cells[0].x,y:target.cells[0].y});assert.equal(g.players[0].ships[1].cells[0].hp,1);assert.equal(g.players[0].ships[0].uses,1);assert.equal(g.log.length,count);
});
test('Flint deals two damage to one armored cell and Graves uses independent radar supply',()=>{
 const g=ready(fixture('needle','flint')),e=g.players[1].ships[0];e.cells[0].hp=3;e.cells[0].max=3;
 act(g,{shipId:'ship-0',kind:'piercing',x:e.cells[0].x,y:e.cells[0].y});assert.equal(g.players[1].ships[0].cells[0].hp,1);
 const r=ready(fixture('needle','graves'));act(r,{shipId:'ship-0',kind:'captainRadar'});assert.equal(r.players[0].intel.length,1);assert.equal(r.players[0].ships[0].uses,0);
});
test('broadside attacks a column and saturation attacks four squares',()=>{
 for(const [type,kind,n] of [['bastion','broadside',3],['breakwater','saturation',4]]){const g=ready(fixture(type));act(g,{shipId:'ship-0',kind,x:0,y:0,vertical:true});assert.equal(Object.keys(g.players[0].shots).length,n);if(kind==='broadside')assert.ok(g.players[0].shots['0,2']);}
});
test('gap restriction applies to placement of both the large hull and its neighbor',()=>{
 const g=fixture('atlas'),s=g.players[0].ships[0];const adjacent=s.cells.flatMap(c=>[{x:c.x+1,y:c.y+1},{x:c.x-1,y:c.y-1}]).find(c=>c.x>=0&&c.y>=0&&c.x<19&&c.y<20);
 assert.throws(()=>movePlacement(g,'ship-1',adjacent.x,adjacent.y,0));
 assert.throws(()=>fixture('needle','park'),/carrier/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestFleet} from '../src/fleet-suggestion.js';
import {SHIPS,CAPTAINS} from '../src/catalog.js';
import {createGame,minimumShips,maxShips,fleetCost} from '../src/engine.js';

test('suggestions are legal across boards, budgets and unlock levels',()=>{
 for(const size of [10,12,16,20])for(const budget of [30,45,60,90,150,200])for(const level of [1,2,3,4,5,6,7]){
  if(budget<minimumShips(size)*4)continue;
  const roster=suggestFleet({size,budget,level});
  assert.ok(roster.length>=minimumShips(size)&&roster.length<=maxShips(size));
  assert.ok(fleetCost(roster)<=budget);
  for(const r of roster){assert.ok(SHIPS.find(s=>s.id===r.type).minLevel<=level);if(r.captain)assert.ok(CAPTAINS.find(c=>c.id===r.captain).minLevel<=level);}
  assert.doesNotThrow(()=>createGame({size,budget,roster}));
 }
});
test('suggestions include unlocked captains when affordable and reserve minimum ships',()=>{
 assert.equal(suggestFleet({size:10,budget:16,level:4}).filter(r=>r.captain).length,0);
 assert.ok(suggestFleet({size:12,budget:45,level:1}).some(r=>r.captain));
 assert.throws(()=>suggestFleet({size:20,budget:30,level:1}),/minimum/);
});
test('comfortable budgets favor mixed hulls instead of extra patrol boats',()=>{
 for(const level of [1,2,3,4,5,6,7]){
  const roster=suggestFleet({size:12,budget:45,level});
  assert.equal(roster.length,5);
  assert.ok(roster.filter(r=>r.type==='needle').length<=1);
  assert.ok(new Set(roster.map(r=>r.type)).size>=2);
 }
});

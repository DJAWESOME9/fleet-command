import {SHIPS, CAPTAINS} from './catalog.js';
import {minimumShips, maxShips, fleetCost} from './engine.js';

export function suggestFleet({size, budget, level=1}) {
 const available=SHIPS.filter(s=>(s.minLevel||1)<=level).sort((a,b)=>a.cost-b.cost);
 const roster=[];
 const count=id=>roster.filter(r=>r.type===id).length;
 // Secure the minimum fleet before spending on commanders or upgrades.
 for(let i=0;i<minimumShips(size);i++) {
  const ship=available.find(s=>count(s.id)<(s.maxCopies??Infinity));
  if(!ship||fleetCost(roster)+ship.cost>budget)throw Error('Budget cannot cover the minimum unlocked fleet.');
  roster.push({type:ship.id,captain:null});
 }
 // Replace inexpensive placeholders with a balanced mix before buying captains.
 // Keep one patrol boat where possible; tight budgets may require more.
 while(count('needle')>1) {
  const ship=available.filter(s=>s.id!=='needle'&&count(s.id)<(s.maxCopies??Infinity)&&fleetCost(roster)+s.cost-available.find(s=>s.id==='needle').cost<=budget)
   .sort((a,b)=>count(a.id)-count(b.id)||a.cost-b.cost)[0];
  if(!ship)break;
  roster.find(r=>r.type==='needle').type=ship.id;
 }
 for(const captain of CAPTAINS.filter(c=>(c.minLevel||1)<=level).sort((a,b)=>a.cost-b.cost)) {
  const ship=roster.find(r=>!r.captain);
  if(ship&&fleetCost(roster)+captain.cost<=budget)ship.captain=captain.id;
 }
 // Prefer a variety of unlocked hulls, then spend remaining points on upgrades.
 for(let pass=0;pass<2;pass++)for(const ship of [...available].reverse()) {
  if(count(ship.id)>=(pass===0?1:(ship.maxCopies??Infinity)))continue;
  const target=[...roster].sort((a,b)=>available.find(s=>s.id===a.type).cost-available.find(s=>s.id===b.type).cost)
   .find(r=>available.find(s=>s.id===r.type).cost<ship.cost);
  if(target&&fleetCost(roster)+ship.cost-available.find(s=>s.id===target.type).cost<=budget)target.type=ship.id;
 }
 // Larger budgets can support more specialist hulls, without padding with patrol boats.
 while(roster.length<maxShips(size)) {
  const ship=available.filter(s=>s.id!=='needle'&&count(s.id)<(s.maxCopies??Infinity)&&fleetCost(roster)+s.cost<=budget)
   .sort((a,b)=>count(a.id)-count(b.id)||b.cost-a.cost)[0];
  if(!ship)break;
  roster.push({type:ship.id,captain:null});
 }
 // Newly added ships can take captains that had no available berth earlier.
 for(const captain of CAPTAINS.filter(c=>(c.minLevel||1)<=level)) {
  if(roster.some(r=>r.captain===captain.id)||fleetCost(roster)+captain.cost>budget)continue;
  const ship=roster.find(r=>!r.captain);
  if(ship)ship.captain=captain.id;
 }
 return roster;
}

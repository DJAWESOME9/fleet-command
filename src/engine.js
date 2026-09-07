import {SHIPS,CAPTAINS} from './catalog.js';
const def=id=>SHIPS.find(s=>s.id===id);
const key=(x,y)=>`${x},${y}`;
const alive=s=>s.cells.some(c=>c.hp>0);
const pick=a=>a[Math.floor(Math.random()*a.length)];
export const minimumShips=size=>({10:4,12:5,16:7,20:9})[size]??5;
export const maxShips=size=>({10:6,12:8,16:10,20:12})[size]??8;
export const salvoActionCap=size=>({10:4,12:5,16:6,20:7})[size]??5;
export const mineCost=mines=>[0,1,3,6,10,15][mines]??Infinity;
export function fleetCost(roster,mines=0){return roster.reduce((n,s)=>n+(def(s.type)?.cost||0)+(CAPTAINS.find(c=>c.id===s.captain)?.cost||0),0)+mineCost(mines);}
function cellsAt(ship,x,y,rotation){const raw=def(ship.type).cells.map(([a,b])=>{for(let i=0;i<rotation;i++)[a,b]=[-b,a];return[a,b];});const mx=Math.min(...raw.map(c=>c[0])),my=Math.min(...raw.map(c=>c[1]));return raw.map(([a,b],i)=>({...ship.cells[i],x:x+a-mx,y:y+b-my}));}
function valid(state,p,ship,cells){return cells.every(c=>c.x>=0&&c.y>=0&&c.x<state.size&&c.y<state.size&&!p.mines.some(m=>m.x===c.x&&m.y===c.y)&&!p.ships.some(s=>s.id!==ship.id&&s.cells.some(d=>(def(ship.type).gap||def(s.type).gap)?Math.max(Math.abs(d.x-c.x),Math.abs(d.y-c.y))<=1:d.x===c.x&&d.y===c.y)));}
function makePlayer(roster,mines){return {cost:fleetCost(roster,mines),ships:roster.map((r,i)=>{const d=def(r.type);return{id:`ship-${i}`,type:r.type,captain:r.captain||null,x:0,y:0,rotation:0,cells:d.cells.map((_,j)=>{const hp=(d.armor?.[j]||1)+(r.captain==='ward'&&j===0?1:0);return{x:0,y:0,hp,max:hp};}),repairs:(d.cells.length<=3?1:2)+(r.captain==='rook'?1:0),uses:d.uses,planes:[],sunk:false,captainUses:r.captain==='ortiz'?2:1};}),mines:Array.from({length:mines},()=>({x:-1,y:-1})),shots:{},intel:[],used:[],bonus:0,bonusTarget:null};}
export function createGame({size=12,budget=45,mode='standard',repeatOnHit=false,difficulty='normal',roster,mines=0}={}){
 if(![10,12,16,20].includes(+size)||!Number.isInteger(+budget)||budget<4||budget>200)throw Error('Choose a supported board and a budget from 4 to 200.');
 if(!['standard','salvo'].includes(mode)||!['easy','normal','hard','expert'].includes(difficulty))throw Error('Invalid game settings.');
 if(!roster?.length||!Number.isInteger(mines)||mines<0||mines>5)throw Error('Add at least one ship; maximum five mines.');
 if(roster.some(s=>!def(s.type)||(s.captain&&!CAPTAINS.some(c=>c.id===s.captain))))throw Error('Unknown ship or captain.');
 if(roster.some(r=>r.captain==='park'&&!def(r.type).planeCount))throw Error('Jun Park requires a carrier.');
 for(const d of SHIPS){const count=roster.filter(s=>s.type===d.id).length;if(count>(d.maxCopies??Infinity))throw Error(`${d.name} is limited to ${d.maxCopies} per fleet.`);}
 const caps=roster.map(s=>s.captain).filter(Boolean);if(new Set(caps).size!==caps.length)throw Error('Each captain can command only one ship.');
 if(fleetCost(roster,mines)>budget)throw Error('Fleet exceeds the point budget.');
 if(roster.length<minimumShips(size))throw Error(`${size}×${size} requires at least ${minimumShips(size)} ships. Captains and mines do not count.`);
 if(roster.length>maxShips(size))throw Error(`${size}×${size} allows at most ${maxShips(size)} ships.`);
 const botRoster=[];let remaining=budget;const preferred=['bulwark','mako','beacon','wraith','osprey','echo','trident','needle'];
 while(remaining>=4&&botRoster.length<maxShips(size)){const reserve=Math.max(0,minimumShips(size)-botRoster.length-1)*4;const choices=preferred.filter(t=>def(t).cost<=remaining-reserve&&botRoster.filter(r=>r.type===t).length<(def(t).maxCopies??Infinity));if(!choices.length)break;const type=pick(choices);botRoster.push({type});remaining-=def(type).cost;}
 const state={size:+size,budget:+budget,mode,repeatOnHit:mode==='standard'&&!!repeatOnHit,difficulty,phase:'deployment',turn:0,actionsLeft:0,winner:null,log:[],players:[makePlayer(roster,mines),makePlayer(botRoster,0)],resume:null,round:1};
 autoDeploy(state,0);state.players[0].ships.forEach(s=>{s.planes=[];});autoDeploy(state,1);return state;
}
export function autoDeploy(state,player=0){
 if(state.phase!=='deployment')throw Error('Deployment has ended.');
 const p=state.players[player],saved=structuredClone(p);
 for(let attempt=0;attempt<60;attempt++){
 p.ships.forEach(s=>s.cells.forEach(c=>{c.x=-100;c.y=-100;}));p.mines.forEach(m=>{m.x=-100;m.y=-100;});let ok=true;
 for(const s of p.ships){let placed=false;for(let i=0;i<1200;i++){const x=Math.floor(Math.random()*state.size),y=Math.floor(Math.random()*state.size),r=Math.floor(Math.random()*4),cs=cellsAt(s,x,y,r);if(valid(state,p,s,cs)){Object.assign(s,{x,y,rotation:r,cells:cs});placed=true;break;}}if(!placed){ok=false;break;}}
 if(!ok)continue;for(const s of p.ships){const count=def(s.type).planeCount||0;s.planes=Array.from({length:s.cells.length},(_,i)=>i).sort(()=>Math.random()-.5).slice(0,count);}for(const m of p.mines){const available=[];for(let y=0;y<state.size;y++)for(let x=0;x<state.size;x++)if(!p.ships.some(s=>s.cells.some(c=>c.x===x&&c.y===y))&&!p.mines.some(n=>n.x===x&&n.y===y))available.push({x,y});if(!available.length){ok=false;break;}Object.assign(m,pick(available));}if(ok)return state;
 }state.players[player]=saved;throw Error('Fleet cannot fit. Remove a ship and try again.');
}
export function movePlacement(state,shipId,x,y,rotation){if(state.phase!=='deployment')throw Error('Deployment has ended.');if(!Number.isInteger(x)||!Number.isInteger(y)||![0,1,2,3].includes(rotation))throw Error('Invalid placement.');const p=state.players[0],s=p.ships.find(s=>s.id===shipId);if(!s)throw Error('Select a ship.');const cs=cellsAt(s,x,y,rotation);if(!valid(state,p,s,cs))throw Error('Ship must fit on the board without overlapping ships or mines.');Object.assign(s,{x,y,rotation,cells:cs});return state;}
export function moveMinePlacement(state,mineIndex,x,y){if(state.phase!=='deployment')throw Error('Deployment has ended.');const p=state.players[0],m=p.mines[mineIndex];if(!m)throw Error('Select a mine.');if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=state.size||y>=state.size)throw Error('Mine must stay on the board.');if(p.mines.some((n,i)=>i!==mineIndex&&n.x===x&&n.y===y)||p.ships.some(s=>s.cells.some(c=>c.x===x&&c.y===y)))throw Error('Mine cannot overlap a ship or another mine.');Object.assign(m,{x,y});return state;}
export function togglePlanePlacement(state,shipId,cellIndex){if(state.phase!=='deployment')throw Error('Planes can only be placed during deployment.');const p=state.players[0],s=p.ships.find(s=>s.id===shipId),d=s&&def(s.type);if(!s||!d?.planeCount)throw Error('Select a carrier to place a plane.');if(!Number.isInteger(cellIndex)||cellIndex<0||cellIndex>=s.cells.length)throw Error('Select a carrier section.');s.planes??=[];const at=s.planes.indexOf(cellIndex);if(at>=0){s.planes.splice(at,1);return state;}if(s.planes.length>=d.planeCount)throw Error('All plane slots on this carrier are occupied.');s.planes.push(cellIndex);return state;}
function beginTurn(state,who){state.turn=who;const p=state.players[who];p.used=[];state.actionsLeft=state.mode==='salvo'?Math.min(p.ships.filter(alive).length,salvoActionCap(state.size)):1;state.round++;}
export function startBattle(state){if(state.phase!=='deployment')throw Error('Battle already started.');for(const p of state.players)for(const s of p.ships)if(!valid(state,p,s,s.cells))throw Error('Invalid deployment.');state.phase='battle';const [a,b]=state.players;const first=a.cost===b.cost?Math.round(Math.random()):a.cost<b.cost?0:1;beginTurn(state,first);state.log.push(`${first===0?'You':'The bot'} take the first turn. Fleet costs: ${a.cost} / ${b.cost}${a.cost===b.cost?' · tie broken randomly':''}.`);return state;}
function say(state,text){state.log.push(text);if(state.log.length>150)state.log.shift();}
function coord(x,y){return `${String.fromCharCode(65+x)}${y+1}`;}
function radarContact(state,who){const p=state.players[who],enemy=state.players[1-who];const eligible=[...enemy.mines,...enemy.ships.filter(s=>alive(s)&&!def(s.type).submarine).flatMap(s=>s.cells.filter(c=>c.hp>0))].filter(c=>!p.shots[key(c.x,c.y)]&&!p.intel.some(i=>i.x===c.x&&i.y===c.y));if(eligible.length){const c=pick(eligible);p.intel.push({x:c.x,y:c.y,kind:'radar'});} }
function hit(state,who,x,y,depth=false,damage=1){const p=state.players[who],enemy=state.players[1-who];const mine=enemy.mines.findIndex(m=>m.x===x&&m.y===y);if(mine>=0&&!depth){enemy.mines.splice(mine,1);p.shots[key(x,y)]={kind:'hit'};say(state,`${who===0?'You':'Bot'} hit ${coord(x,y)}: section still intact.`);return{hit:true};}
 const s=enemy.ships.find(s=>alive(s)&&(!depth||def(s.type).submarine)&&s.cells.some(c=>c.x===x&&c.y===y&&c.hp>0));
 if(!s){if(!depth)p.shots[key(x,y)]={kind:'miss'};say(state,`${who===0?'You':'Bot'} ${depth?'depth charge':'shot'} ${coord(x,y)}: miss.`);return{hit:false};}
 const ci=s.cells.findIndex(c=>c.x===x&&c.y===y&&c.hp>0),c=s.cells[ci];c.hp=Math.max(0,c.hp-damage);p.shots[key(x,y)]={kind:c.hp?'hit':'destroyed'};say(state,`${who===0?'You':'Bot'} hit ${coord(x,y)}: ${c.hp?'section still intact':'section destroyed'}.`);if(s.planes?.includes(ci)&&s.uses>0){s.planes=s.planes.filter(i=>i!==ci);s.uses--;say(state,`${def(s.type).name}'s reconnaissance plane was destroyed.`);}
 if(!alive(s)){s.sunk=true;for(const c of s.cells)p.shots[key(c.x,c.y)]={kind:'sunk'};say(state,`${def(s.type).name} destroyed — all sections lost.`);if(s.captain==='shaw'&&s.captainUses){s.captainUses=0;radarContact(state,1-who);}
 if(s.captain==='voss'&&s.captainUses){s.captainUses=0;enemy.bonus+=3;enemy.bonusTarget=null;say(state,'Voss activates Last Word: three retaliation shots.');}}
 return{hit:true,ship:true};}
function requireTarget(state,x,y,w=1,h=1){if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x+w>state.size||y+h>state.size)throw Error('Choose a target area fully inside the board.');}
function resolve(state,a){
 if(state.phase!=='battle')throw Error('Start a battle first.');const who=state.turn,p=state.players[who],enemy=state.players[1-who],s=p.ships.find(s=>s.id===a.shipId);if(!s)throw Error('Select a ship.');
 const bonus=p.bonus>0;if(!bonus&&!alive(s))throw Error('Sunk ships cannot act.');if(bonus&&a.kind!=='fire')throw Error('Resolve your bonus shots first.');if(!bonus&&state.mode==='salvo'&&p.used.includes(s.id))throw Error('This ship already acted this turn.');
 let result={hit:false},extra=false;
 const captainAbility=CAPTAINS.find(c=>c.id===s.captain)?.ability;
 const special=a.kind===captainAbility;
 if(special&&s.captainUses<=0)throw Error('Captain ability exhausted.');
 const originalKind=a.kind;
 if(special){s.captainUses--;a={...a,kind:({quietRepair:'repair',captainRadar:'radar',wideScan:'scan',piercing:'fire'})[a.kind]};}
 if(a.kind==='fire'){
 requireTarget(state,a.x,a.y);if(bonus&&p.bonusTarget&&Math.abs(a.x-p.bonusTarget.x)+Math.abs(a.y-p.bonusTarget.y)!==1)throw Error('Pike’s bonus shot must be adjacent to the original hit.');
 if(!bonus&&s.captain==='ortiz'&&s.captainUses>0){s.captainUses--;const i=enemy.mines.findIndex(m=>m.x===a.x&&m.y===a.y);if(i>=0){enemy.mines.splice(i,1);p.shots[key(a.x,a.y)]={kind:'miss'};p.bonus++;extra=true;say(state,'Ortiz cleared a mine. Choose a replacement shot.');}else result=hit(state,who,a.x,a.y);}else result=hit(state,who,a.x,a.y,false,originalKind==='piercing'?2:1);
 if(bonus){p.bonus--;p.bonusTarget=null;}
 if(!bonus&&result.ship&&s.captain==='pike'&&s.captainUses>0){s.captainUses--;p.bonus++;p.bonusTarget={x:a.x,y:a.y};say(state,'Pike: choose an adjacent bonus shot.');}
 }else if(['forward','backward'].includes(a.kind)){
 const [dx,dy]=[[1,0],[0,1],[-1,0],[0,-1]][s.rotation],sign=a.kind==='forward'?1:-1;const cs=s.cells.map(c=>({...c,x:c.x+dx*sign,y:c.y+dy*sign}));if(!valid(state,p,s,cs))throw Error('Movement blocked by the board edge, a ship, or a mine.');s.cells=cs;s.x+=dx*sign;s.y+=dy*sign;say(state,`${who===0?'Your':'Enemy'} fleet moved a ship.`);
 }else if(a.kind==='repair'||a.kind==='fieldRepair'){
 requireTarget(state,a.x,a.y);
 const support=a.kind==='fieldRepair';
 if(support&&(def(s.type).ability!=='fieldRepair'||s.uses<=0))throw Error('Field repair unavailable.');
 const target=support?p.ships.find(t=>t.id!==s.id&&alive(t)&&t.cells.some(c=>c.x===a.x&&c.y===a.y)):s;
 const c=target?.cells.find(c=>c.x===a.x&&c.y===a.y);
 if(!c||c.hp>=c.max)throw Error('Select a damaged section of a surviving eligible ship.');
 if(!support&&!special&&!s.repairs)throw Error('No repairs remaining.');
 c.hp++;if(support)s.uses--;else if(!special)s.repairs--;
 if(s.captain!=='mercer')say(state,`${who===0?'Your':'Enemy'} fleet repaired a section.`);

 }else{
 if((!special&&(def(s.type).ability!==a.kind||s.uses<=0))||(a.kind==='scan'&&!(s.planes?.length)))throw Error(a.kind==='scan'?'Place a reconnaissance plane on the carrier first.':'This ability is unavailable.');
 if(['radar','sonar'].includes(a.kind)){
 const eligible=enemy.ships.filter(e=>alive(e)&&(a.kind==='sonar'?!!def(e.type).submarine:!def(e.type).submarine)).flatMap(e=>e.cells.filter(c=>c.hp>0).map(c=>({x:c.x,y:c.y})));if(a.kind==='radar')eligible.push(...enemy.mines);
 const contacts=eligible.filter(c=>!p.shots[key(c.x,c.y)]&&!p.intel.some(i=>i.x===c.x&&i.y===c.y));if(contacts.length){const c=pick(contacts);p.intel.push({...c,kind:a.kind});say(state,`${who===0?'Your':'Enemy'} ${a.kind} revealed a contact${who===0?` at ${coord(c.x,c.y)}`:''}.`);}else say(state,`${who===0?'Your':'Enemy'} ${a.kind}: no new contacts.`);
 }else if(a.kind==='scan'||a.kind==='hydrophone'){
 const scanSize=(def(s.type).scanSize||3)+(originalKind==='wideScan'?1:0);
 if(a.kind==='scan')requireTarget(state,a.x,a.y,scanSize,scanSize);else requireTarget(state,0,a.y);
 const count=enemy.ships.filter(e=>a.kind==='scan'?!def(e.type).submarine:!!def(e.type).submarine).flatMap(e=>e.cells).filter(c=>c.hp>0&&(a.kind==='scan'?c.x>=a.x&&c.x<a.x+scanSize&&c.y>=a.y&&c.y<a.y+scanSize:c.y===a.y)).length;
 // Private scan results are stored per player and filtered out of opponent views.
 p.scans??=[];p.scans.push({kind:a.kind,x:a.x??0,y:a.y,count,size:scanSize});if(a.kind==='scan'&&s.planes?.length)s.planes.shift();say(state,who===0?`${a.kind==='scan'?'Aircraft scan':'Hydrophone'} at ${coord(a.x??0,a.y)}: ${count} intact ${a.kind==='scan'?'surface':'submarine'} sections.`:`Enemy used ${a.kind==='scan'?'aircraft reconnaissance':'hydrophone'}.`);
 }else{const line=['paired','broadside','torpedo'].includes(a.kind),length=a.kind==='paired'?2:3;const w=line?(a.vertical?1:length):a.kind==='depth'?3:2,h=line?(a.vertical?length:1):a.kind==='depth'?3:2;requireTarget(state,a.x,a.y,w,h);for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++)hit(state,who,a.x+dx,a.y+dy,a.kind==='depth');}
 if(!special||a.kind==='scan')s.uses--;
 }
 if(!bonus){p.used.push(s.id);if(!(a.kind==='fire'&&result.hit&&state.repeatOnHit))state.actionsLeft--;}
 if(enemy.bonus>0&&state.resume===null){state.resume={turn:who,actionsLeft:state.actionsLeft};state.turn=1-who;state.actionsLeft=0;return;}
 if(p.bonus>0)return;
 if(state.resume!==null){const resume=state.resume;state.resume=null;state.turn=resume.turn;state.actionsLeft=resume.actionsLeft;if(state.players[state.turn].bonus>0)return;}
 const living=state.players.map(p=>p.ships.some(alive));if(!living[0]||!living[1]){state.phase='finished';state.winner=living[0]&&!living[1]?0:living[1]&&!living[0]?1:-1;say(state,state.winner===0?'Victory. Enemy fleet eliminated.':state.winner===1?'Defeat. Your fleet has been eliminated.':'Mutual destruction. Draw.');return;}
 if(state.actionsLeft<=0)beginTurn(state,1-state.turn);
}
export function act(state,action){const copy=structuredClone(state);resolve(copy,action);Object.assign(state,copy);return state;}
export function legalMoves(state,shipId,player=0){
 const p=state.players[player],s=p?.ships.find(s=>s.id===shipId);
 if(!s||state.phase!=='battle'||state.turn!==player||!alive(s)||p.bonus>0||(state.mode==='salvo'&&p.used.includes(s.id)))return {forward:false,backward:false};
 const [dx,dy]=[[1,0],[0,1],[-1,0],[0,-1]][s.rotation];
 return Object.fromEntries([['forward',1],['backward',-1]].map(([name,sign])=>[name,valid(state,p,s,s.cells.map(c=>({...c,x:c.x+dx*sign,y:c.y+dy*sign})))]));
}
export function concede(state,player=0){
 if(state.phase!=='battle')throw Error('Only an active battle can be conceded.');
 if(player!==0&&player!==1)throw Error('Invalid player.');
 state.phase='finished';state.winner=1-player;state.reason='concession';state.actionsLeft=0;state.resume=null;
 state.players.forEach(p=>{p.bonus=0;p.bonusTarget=null;});
 say(state,player===0?'You conceded. The enemy wins this battle.':'The enemy conceded. Victory.');return state;
}
export function getView(state,player=0){const v=structuredClone(state),enemy=v.players[1-player];if(v.phase!=='finished'){enemy.ships=enemy.ships.map(s=>({id:s.id,sunk:s.sunk,cells:[]}));enemy.mines=[];enemy.intel=[];enemy.scans=[];}return v;}
// Bot planning receives only its own fleet and discoveries, never hidden targets.
export function botStep(state){
 if(state.phase!=='battle'||state.turn!==1)return state;
 const p=getView(state,1).players[1];const ships=p.ships.filter(s=>p.bonus>0||(!s.sunk&&(state.mode!=='salvo'||!p.used.includes(s.id))));if(!ships.length)throw Error('No eligible bot ship.');
 const level=['easy','normal','hard','expert'].indexOf(state.difficulty),s=pick(ships),candidates=[];
 for(let y=0;y<state.size;y++)for(let x=0;x<state.size;x++){
 if(p.bonusTarget&&Math.abs(x-p.bonusTarget.x)+Math.abs(y-p.bonusTarget.y)!==1)continue;
 const shot=p.shots[key(x,y)];let score=Math.random()*(level===0?10:1);
 if(!shot)score+=3;else if(shot.kind==='hit')score+=level?4:0;else score-=2;
 if(level>0){if(p.intel.some(c=>c.x===x&&c.y===y)&&!shot)score+=10;for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])if(['hit','destroyed'].includes(p.shots[key(x+dx,y+dy)]?.kind)&&!shot)score+=2+level;
 if(level>=2&&!shot){score+=(x+y)%2===0?.5:0;for(const scan of p.scans||[])if(scan.kind==='scan'&&x>=scan.x&&x<scan.x+3&&y>=scan.y&&y<scan.y+3)score+=scan.count?1:-2;}}
 candidates.push({x,y,score});}
 candidates.sort((a,b)=>b.score-a.score);const target=candidates[0];
 if(!p.bonus&&level>=1){const damaged=s.cells.find(c=>c.hp<c.max);if(damaged&&s.repairs&&Math.random()<.15*level)return act(state,{shipId:s.id,kind:'repair',...damaged});const ability=def(s.type).ability;if(s.uses&&ability&&Math.random()<.13*level){const a={shipId:s.id,kind:ability,x:target.x,y:target.y};if(['scan','depth'].includes(ability)){a.x=Math.min(a.x,state.size-3);a.y=Math.min(a.y,state.size-3);}if(ability==='paired')a.x=Math.min(a.x,state.size-2);return act(state,a);}}
 return act(state,{shipId:s.id,kind:'fire',x:target.x,y:target.y});
}

export const SHIPS = [
 {id:'needle',name:'Needle Patrol Boat',cost:4,cells:[[0,0],[1,0]],description:'Compact two-cell scout. Multiple may form a screen.',ability:null,uses:0},
 {id:'mako',abilityName:'Depth Charge',name:'Mako Destroyer',cost:7,maxCopies:3,cells:[[0,0],[1,0],[2,0]],description:'One 3×3 depth charge. Damages submarines only.',ability:'depth',uses:1},
 {id:'wraith',abilityName:'Hydrophone',name:'Wraith Submarine',cost:8,maxCopies:1,cells:[[0,0],[1,0],[2,0]],description:'Hidden from radar and aircraft. Hydrophone counts submarine cells in a row.',ability:'hydrophone',uses:1,submarine:true},
 {id:'echo',abilityName:'Sonar Pulse',name:'Echo Sonar Corvette',cost:8,maxCopies:3,cells:[[0,0],[1,0],[0,1]],description:'Two sonar pulses. Reveals a submarine cell; excludes ships and mines.',ability:'sonar',uses:2},
 {id:'beacon',abilityName:'Active Radar',name:'Beacon Radar Cutter',cost:9,maxCopies:1,cells:[[0,0],[1,0],[2,0]],description:'One radar pulse reveals a surface-ship cell or a deceptive mine.',ability:'radar',uses:1},
 {id:'bulwark',name:'Bulwark Cruiser',cost:10,maxCopies:1,cells:[[0,0],[1,0],[2,0],[3,0]],description:'Middle sections have two health each. Two repairs.',ability:null,uses:0,armor:{1:2,2:2}},
 {id:'trident',abilityName:'Paired Fire',name:'Trident Frigate',cost:10,maxCopies:1,cells:[[0,0],[1,0],[2,0],[1,1]],description:'Once per battle, attack two horizontally adjacent cells.',ability:'paired',uses:1},
 {id:'osprey',abilityName:'Reconnaissance Flight',name:'Osprey Seaplane Tender',cost:10,maxCopies:1,cells:[[0,0],[1,0],[2,0],[2,1]],description:'Carries one plane. Place it on a hull section during deployment; a hit destroys the plane and its flight.',ability:'scan',uses:1,scanSize:3,planeCount:1}
];
export const CAPTAINS = [
 {id:'ward',abilityName:'Reinforce',trigger:'Passive',name:'Elias Ward',cost:3,description:'First hull section gains one maximum health.'},
 {id:'rook',abilityName:'Damage Control',trigger:'Passive',name:'Tomas Rook',cost:3,description:'One additional onboard repair.'},
 {id:'pike',abilityName:'Bloodhound',trigger:'On hit',name:'Soren Pike',cost:4,description:'Once: a normal ship hit grants an adjacent bonus shot.'},
 {id:'ortiz',abilityName:'Mine Hunter',trigger:'Before firing',name:'Rafael Ortiz',cost:2,description:'First two normal shots inspect for mines. Clearing a mine allows a replacement shot.'},
 {id:'voss',abilityName:'Last Word',trigger:'On sinking',name:'Mara Voss',cost:4,description:'When sunk, immediately fire three retaliation shots.'}
];

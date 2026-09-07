import {randomBytes} from 'node:crypto';
import {createGame, movePlacement, moveMinePlacement, togglePlanePlacement, startBattle, act, concede, getView} from '../src/engine.js';

const fail = (message, status=400) => { const error=Error(message);error.status=status;throw error; };
const cleanName = name => typeof name === 'string' ? name.trim().slice(0, 24) || 'Commander' : 'Commander';
const token = () => randomBytes(24).toString('hex');
const ttl = 24 * 60 * 60 * 1000;

// Keep the engine's player-zero UI convention at the network boundary.
export function perspective(state, player) {
  const view = structuredClone(state);
  if (player === 1) {
    view.players.reverse();
    view.turn = 1 - view.turn;
    if (view.winner === 0 || view.winner === 1) view.winner = 1 - view.winner;
    if (view.resume) view.resume.turn = 1 - view.resume.turn;
  }
  return view;
}

function deployment(config, payload) {
  const {roster, mines, ships, minePositions} = payload;
  if (!Array.isArray(roster) || roster.length > 12 || !Array.isArray(ships) || ships.length !== roster.length || !Array.isArray(minePositions) || minePositions.length !== mines) fail('Invalid fleet submission.');
  const state = createGame({...config, roster, mines});
  const player = state.players[0];
  player.ships.forEach(s => s.cells.forEach(c => { c.x = -100; c.y = -100; }));
  player.mines.forEach(m => { m.x = -100; m.y = -100; });
  ships.forEach((s, i) => {
    movePlacement(state, `ship-${i}`, s.x, s.y, s.rotation);
    if (!Array.isArray(s.planes) || new Set(s.planes).size !== s.planes.length) fail('Invalid plane placement.');
    for (const cell of s.planes) togglePlanePlacement(state, `ship-${i}`, cell);
  });
  minePositions.forEach((m, i) => moveMinePlacement(state, i, m.x, m.y));
  return player;
}

export class RoomStore {
  rooms = new Map();
  prune() {
    for (const [code, room] of this.rooms) if (Date.now() - room.updated > ttl) this.rooms.delete(code);
  }
  create(config, name) {
    this.prune();
    if (this.rooms.size >= 500) fail('Server is full. Try again later.');
    const settings = {size: config?.size ?? 12, budget: config?.budget ?? 45, mode: config?.mode ?? 'standard', repeatOnHit: config?.repeatOnHit === true, difficulty: 'normal'};
    const count = ({10:4,12:5,16:7,20:9})[settings.size] || 5;
    createGame({...settings, roster: Array.from({length: count}, () => ({type:'needle'}))});
    let code;
    do { code = randomBytes(4).toString('hex').toUpperCase(); } while (this.rooms.has(code));
    const room = {code, config: settings, seats: [this.seat(name), null], game: null, logs: [[], []], version: 0, updated: Date.now()};
    this.rooms.set(code, room);
    return {code, token: room.seats[0].token, ...this.view(room, 0)};
  }
  seat(name) { return {name: cleanName(name), token: token(), fleet: null, seen: Date.now()}; }
  get(code) { this.prune(); return this.rooms.get(code) || fail('Room expired or does not exist.',404); }
  join(code, name) {
    const room = this.get(code);
    if (room.seats[1]) fail('This room already has two commanders.');
    room.seats[1] = this.seat(name);
    room.version++; room.updated = Date.now();
    return {code, token: room.seats[1].token, ...this.view(room, 1)};
  }
  authenticate(code, credential) {
    const room = this.get(code);
    const player = room.seats.findIndex(s => s && s.token === credential);
    if (player < 0) fail('Invalid room session.',401);
    room.seats[player].seen = Date.now(); room.updated = Date.now();
    return {room, player};
  }
  view(room, player) {
    let game = null;
    if (room.game) {
      game = getView(perspective(room.game, player), 0);
      const enemy = game.players[1];
      game.players[1] = {ships: enemy.ships, shots: enemy.shots, mines: game.phase === 'finished' ? enemy.mines : []};
      game.log = room.logs[player];
      game.multiplayer = true;
    }
    return {version: room.version, config: room.config, ready: !!room.seats[player].fleet,
      opponent: room.seats[1-player] ? {name: room.seats[1-player].name, ready: !!room.seats[1-player].fleet, connected: Date.now() - room.seats[1-player].seen < 10000} : null,
      deployment: !game ? room.seats[player].fleet : null, game};
  }
  command(room, player, body) {
    if (!body || body.version !== room.version) fail('The room changed. Wait for the latest update and try again.');
    if (body.kind === 'ready') {
      if (room.game || room.seats[player].fleet) fail('Your fleet is already locked in.');
      const fleet = deployment(room.config, body.fleet || {});
      room.seats[player].fleet = fleet;
      if (room.seats.every(s => s?.fleet)) {
        const state = createGame({...room.config, roster: fleet.ships.map(s => ({type:s.type, captain:s.captain})), mines: fleet.mines.length});
        state.players = room.seats.map(s => structuredClone(s.fleet));
        startBattle(state);
        state.log = [];
        room.game = state;
        room.logs = [0, 1].map(i => [`Both fleets ready. ${state.turn === i ? 'You take' : 'Your opponent takes'} the first turn. Fleet costs: ${state.players[i].cost} / ${state.players[1-i].cost}.`]);
      }
    } else {
      if (!room.game) fail('Both commanders must ready their fleets first.');
      if (body.kind !== 'concede' && body.kind !== 'action') fail('Unknown command.');
      if (body.kind === 'action' && room.game.turn !== player) fail('Wait for your turn.');
      const state = perspective(room.game, player);
      state.log = [];
      if (body.kind === 'concede') concede(state, 0);
      else {
        if (!body.action || typeof body.action !== 'object') fail('Invalid order.');
        act(state, body.action);
      }
      room.logs[player].push(...state.log);
      // Never send the engine's actor-oriented private log to the other seat.
      const order = body.action;
      let publicEvent = body.kind === 'concede' ? 'Your opponent conceded. Victory.' : 'Your opponent completed an order.';
      if (body.kind === 'action' && ['fire','depth','paired'].includes(order.kind)) publicEvent = `Your opponent used ${order.kind === 'fire' ? 'fire' : order.kind === 'depth' ? 'depth charges' : 'paired fire'} at ${String.fromCharCode(65+order.x)}${order.y+1}. Check your waters for damage.`;
      if (body.kind === 'action' && ['scan','radar','sonar','hydrophone'].includes(order.kind)) publicEvent = 'Your opponent used reconnaissance.';
      room.logs[1-player].push(publicEvent);
      if (state.phase === 'finished' && body.kind !== 'concede') room.logs[1-player].push(state.winner === -1 ? 'Mutual destruction. Draw.' : state.winner === 1 ? 'Victory. Enemy fleet eliminated.' : 'Defeat. Your fleet has been eliminated.');
      state.log = [];
      room.game = perspective(state, player);
    }
    room.logs = room.logs.map(log => log.slice(-150));
    room.version++; room.updated = Date.now();
    return this.view(room, player);
  }
}

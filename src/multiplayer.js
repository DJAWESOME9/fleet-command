const storageKey = 'fleet-command-room-v1';

export class Multiplayer {
  session = null;
  state = null;
  busy = false;
  connected = false;
  polling = false;
  unavailable = false;
  onChange;
  onError;
  constructor(onChange, onError) {
    this.onChange = onChange;
    this.onError = onError;
    try { const saved=JSON.parse(sessionStorage.getItem(storageKey)); if(/^[A-F0-9]{8}$/.test(saved?.code)&&/^[a-f0-9]{48}$/.test(saved?.token))this.session=saved; } catch {}
  }
  async request(path, body, credential = this.session?.token) {
    const response = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: {'Content-Type':'application/json', ...(credential ? {Authorization:`Bearer ${credential}`} : {})},
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(8000)
    });
    const data = await response.json().catch(() => { throw Error('Multiplayer needs the Node server. Run npm start and open its address.'); });
    if (!response.ok) {const error=Error(data.error || 'Unable to reach the room.');error.status=response.status;throw error;}
    return data;
  }
  async enter(code, config, name) {
    if (this.busy || this.session) return;
    this.busy = true; this.onChange();
    try {
      const data = await this.request(code ? `/api/rooms/${code}/join` : '/api/rooms', {config, name});
      this.session = {code:data.code, token:data.token};
      sessionStorage.setItem(storageKey, JSON.stringify(this.session));
      this.connected = true; this.unavailable = false; const {code:_,token:__,...state}=data; this.state = state;
    } catch (error) { this.onError(error.message); }
    finally { this.busy = false; this.onChange(); }
  }
  async poll() {
    if (!this.session || this.busy || this.polling || this.unavailable) return;
    const session = this.session;
    this.polling = true;
    try {
      const data = await this.request(`/api/rooms/${session.code}`);
      if (this.session !== session || data.version < (this.state?.version ?? -1)) return;
      const changed = !this.connected || JSON.stringify(data) !== JSON.stringify(this.state);
      if(!this.connected)this.onError('');
      this.connected = true; this.state = data;
      if (changed) this.onChange();
    } catch (error) {
      if (this.session !== session) return;
      this.connected = false; this.unavailable = [401,404].includes(error.status); this.onError(this.unavailable?error.message:`${error.message} Reconnecting…`); this.onChange();
    } finally { this.polling = false; }
  }
  async command(kind, payload = {}) {
    if (this.busy || !this.connected || !this.state) return;
    const session = this.session;
    this.busy = true; this.onChange();
    try {
      const data = await this.request(`/api/rooms/${session.code}/commands`, {kind, version:this.state.version, ...payload});
      if (this.session === session) { this.connected = true; this.state = data; }
    } catch (error) {
      // Do not automatically retry orders: an interrupted response may have committed.
      this.onError(error.message);
    } finally {
      this.busy = false;
      if (this.session === session) { this.onChange(); await this.poll(); }
    }
  }
  leave() {
    this.session = null; this.state = null; this.connected = false; this.unavailable = false;
    sessionStorage.removeItem(storageKey);
    sessionStorage.removeItem('fleet-command-room-draft');
  }
}

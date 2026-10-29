// Apache-2.0. Lab-only, byte-oriented synchronous disk device.
export const SECTOR_SIZE = 16;
export const DISK_PORTS = [0xd0, 0xd1, 0xd2, 0xd3];
const copySectors = sectors => Object.fromEntries(Object.entries(sectors).map(([k,v]) => [k, Uint8Array.from(v)]));
export function validateBase(bytes) {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length % SECTOR_SIZE || bytes.length > 256 * SECTOR_SIZE)
    throw new RangeError('Disk must contain 1–256 complete 16-byte lab sectors');
}
export function validateOverlay(sectors, length) {
  if (!sectors || typeof sectors !== 'object' || Array.isArray(sectors)) throw new TypeError('Invalid overlay');
  for (const [k, v] of Object.entries(sectors)) {
    if (!/^(0|[1-9]\d*)$/.test(k) || Number(k) >= length / SECTOR_SIZE || !(v instanceof Uint8Array) || v.length !== SECTOR_SIZE)
      throw new TypeError('Invalid overlay sector');
  }
}
export class DiskDevice {
  constructor(base, sectors={}) { validateBase(base); validateOverlay(sectors,base.length); this.base=base.slice(); this.committed=copySectors(sectors); this.reset(); }
  reset() { this.selected=0; this.offset=0; this.buffer=new Uint8Array(SECTOR_SIZE); this.staged={}; this.status=0; this.busy=false; }
  read(port) {
    if(port===0xd0) return this.selected;
    if(port===0xd1) return this.offset;
    if(port===0xd3) return this.status;
    if(port===0xd2) { if(this.offset >= SECTOR_SIZE) {this.status=1; return 0;} return this.buffer[this.offset]; }
    throw new RangeError('Unknown disk port');
  }
  write(port,value) {
    if (!Number.isInteger(value) || value < 0 || value > 255) throw new RangeError('Invalid port byte');
    if(port===0xd0) { this.selected=value; return; }
    if(port===0xd1) { this.offset=value; return; }
    if(port===0xd2) { if(this.busy) {this.status=3; return;} if(this.offset>=SECTOR_SIZE) {this.status=1; return;} this.buffer[this.offset]=value; return; }
    if(port!==0xd3) throw new RangeError('Unknown disk port');
    if(value!==1 && value!==2) {this.status=2; return;}
    if(this.selected >= this.base.length/SECTOR_SIZE) {this.status=1; return;}
    if(value===1) {this.buffer=(this.staged[this.selected] || this.committed[this.selected] || this.base.subarray(this.selected*SECTOR_SIZE,(this.selected+1)*SECTOR_SIZE)).slice(); this.status=0; return;}
    if(this.busy) {this.status=3; return;}
    this.staged[this.selected]=this.buffer.slice(); this.status=0;
  }
  snapshot() {return copySectors({...this.committed,...this.staged});}
  exportCommitted() {const out=this.base.slice(); for(const [k,v] of Object.entries(this.committed)) out.set(v,Number(k)*SECTOR_SIZE); return out;}
}
export async function baseIdentity(bytes) {
  validateBase(bytes);
  if (!globalThis.crypto?.subtle) throw new Error('SHA-256 requires a secure browser context');
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return `sha256:${Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('')}:${bytes.length}`;
}
function validateRecord(record, length) {
  if (record !== null && (typeof record !== 'object' || Array.isArray(record) || record.schema!==1 || record.sectorSize!==SECTOR_SIZE || record.length!==length || !Number.isSafeInteger(record.revision) || record.revision<1)) throw new Error('Invalid stored disk metadata');
  if (record !== null) validateOverlay(record.sectors,length);
}
export class DiskSession {
  static async open(base,store) {
    validateBase(base); const immutableBase=base.slice();
    const identity=await baseIdentity(immutableBase); const record=await store.load(identity);
    validateRecord(record,immutableBase.length);
    return new DiskSession(identity,new DiskDevice(immutableBase,record?.sectors || {}),record?.revision || 0,store);
  }
  constructor(identity,device,revision,store) {this.identity=identity;this.device=device;this.revision=revision;this.store=store;this.generation=0;this.pending=null;this.resetting=false;this.status=revision ? 'Committed overlay loaded' : 'No committed overlay';}
  async reset() {
    const gen=++this.generation, pending=this.pending;
    this.resetting=true; this.device.reset(); this.device.busy=true; this.status='Resetting disk…';
    pending?.controller.abort();
    if(pending) await pending.promise.catch(()=>{});
    // A transaction may have completed immediately before its abort. Read the
    // authoritative committed snapshot before resuming the reset machine.
    try {
      const record=await this.store.load(this.identity);
      validateRecord(record,this.device.base.length);
      if(gen!==this.generation) return false;
      this.device.committed=copySectors(record?.sectors || {});this.revision=record?.revision || 0;
      this.device.reset();this.pending=null;this.resetting=false;this.status='Reset; committed overlay restored';return true;
    } catch(error) {
      if(gen===this.generation) {this.status=`Reset failed: ${error.message}`;this.resetting=false;}
      throw error;
    }
  }
  async save() {
    if(this.pending || this.resetting) throw new Error('Disk operation already pending');
    const gen=this.generation, controller=new AbortController(), sectors=this.device.snapshot(), revision=this.revision;
    this.device.busy=true; this.status='Saving…';
    const operation={controller,promise:null}; this.pending=operation;
    operation.promise=(async()=>{
      try {
        await this.store.commit(this.identity,{schema:1,sectorSize:SECTOR_SIZE,length:this.device.base.length,revision:revision+1,sectors},revision,controller.signal);
        if(gen!==this.generation) return false;
        this.device.committed=copySectors(sectors);this.device.staged={};this.revision=revision+1;this.status='Committed to browser storage';return true;
      } catch(error) {
        if(gen===this.generation) this.status=`Save failed: ${error.message}`;
        throw error;
      } finally { if(gen===this.generation) {this.pending=null;this.device.busy=false;} }
    })();
    return operation.promise;
  }
}

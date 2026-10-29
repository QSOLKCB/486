import { validateOverlay } from '../devices/disk.mjs';
// Apache-2.0. One atomic record per base identity; revisions are optimistic locks.
export class IndexedDBOverlayStore {
  constructor(db) { this.db=db; }
  static open(indexedDB = globalThis.indexedDB) {
    if (!indexedDB) return Promise.reject(new Error('IndexedDB unavailable'));
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open('486-lab-overlays',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('overlays');
      request.onerror=()=>reject(request.error || new Error('Cannot open disk storage'));
      request.onblocked=()=>reject(new Error('Disk storage upgrade blocked'));
      request.onsuccess=()=>resolve(new IndexedDBOverlayStore(request.result));
    });
  }
  load(identity) {
    return new Promise((resolve,reject)=>{
      const tx=this.db.transaction('overlays','readonly'); let record; let corruptNull=false;
      const req=tx.objectStore('overlays').get(identity);
      req.onsuccess=()=>{corruptNull=req.result === null; record=req.result === undefined ? null : req.result;};
      tx.oncomplete=()=>corruptNull ? reject(new Error('Invalid stored disk metadata')) : resolve(record);
      tx.onabort=()=>reject(tx.error || new Error('Storage read aborted'));
      tx.onerror=()=>{};
    });
  }
  commit(identity,record,expected,signal) {
    return new Promise((resolve,reject)=>{
      if(signal?.aborted) {reject(new Error('Save aborted'));return;}
      let reason=null;
      const tx=this.db.transaction('overlays','readwrite');
      const abort=()=>{reason=new Error('Save aborted');try {tx.abort();} catch { /* transaction already finished */ }};
      signal?.addEventListener('abort',abort,{once:true});
      const clean=()=>signal?.removeEventListener('abort',abort);
      tx.oncomplete=()=>{clean();resolve();};
      tx.onabort=()=>{clean();reject(reason || tx.error || new Error('Save aborted'));};
      tx.onerror=()=>{};
      const store=tx.objectStore('overlays');const get=store.get(identity);
      get.onsuccess=()=>{
        const existing=get.result;
        if(existing !== undefined) {
          try {
            if(existing === null || typeof existing !== 'object' || Array.isArray(existing) || existing.schema!==record.schema || existing.sectorSize!==record.sectorSize || existing.length!==record.length || !Number.isSafeInteger(existing.revision) || existing.revision<1) throw new Error('Invalid stored disk metadata');
            validateOverlay(existing.sectors,existing.length);
          } catch(error) {reason=error;tx.abort();return;}
        }
        if((existing !== undefined ? existing.revision : 0)!==expected) {reason=new Error('Stale overlay revision');tx.abort();return;}
        store.put(record,identity);
      };
    });
  }
  close() {this.db.close();}
}

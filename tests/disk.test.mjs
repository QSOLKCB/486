import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DiskDevice, DiskSession, DISK_PORTS, baseIdentity} from '../devices/disk.mjs';
import {makeLabDisk} from '../fixtures/disks/lab-disk.mjs';
import {diskGuest} from '../fixtures/diagnostics/disk.mjs';
import {Machine} from '../machine/machine.mjs';
import {IndexedDBOverlayStore} from '../storage/indexeddb.mjs';

class Store {
  constructor() {this.records=new Map();}
  async load(key) {return structuredClone(this.records.get(key) ?? null);}
  async commit(key,record,expected,signal) {
    if(signal.aborted) throw Error('Save aborted');
    if((this.records.get(key)?.revision || 0)!==expected) throw Error('Stale overlay revision');
    this.records.set(key,structuredClone(record));
  }
}
const out=(d,p,v)=>d.write(p,v);
function stage(d,value=0x5a) {out(d,0xd3,1);out(d,0xd1,0);out(d,0xd2,value);out(d,0xd3,2);}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('fixture provenance and guest reads, writes, rereads through ports',()=>{
  const base=makeLabDisk(),disk=new DiskDevice(base);
  assert.equal(sha(base),'bd7d3e1e3ae1f865f14bdedd36a4c116d9db776aa6768a4d06ab269f2c0be5cb');
  assert.equal(sha(diskGuest),'5807c9425aa3733d1c4fb8cde5288640dabc7c257a269924875c9d240187e7a9');
  for (const batch of [1,7,100]) {
    disk.reset(); const m=new Machine({program:diskGuest,profile:'diagnostic-disk-v1',setupBus(bus){for(const p of DISK_PORTS)bus.registerPort(p,disk);}});
    m.resume();while(m.state==='running') m.runBatch(batch);
    assert.equal(m.state,'halted');assert.deepEqual(m.output,[65,90]);assert.equal(disk.staged[0][0],90);assert.equal(disk.exportCommitted()[0],65);assert.equal(base[0],65);
  }
});

test('invalid media, ports, sectors and offsets do not mutate data',()=>{
  for (const b of [new Uint8Array(),new Uint8Array(15),new Uint8Array(4112)]) assert.throws(()=>new DiskDevice(b));
  const d=new DiskDevice(makeLabDisk());out(d,0xd0,4);out(d,0xd3,1);assert.equal(d.read(0xd3),1);assert.deepEqual(d.buffer,new Uint8Array(16));
  out(d,0xd0,0);out(d,0xd1,16);out(d,0xd2,77);assert.equal(d.read(0xd2),0);assert.equal(d.read(0xd3),1);assert.deepEqual(d.buffer,new Uint8Array(16));
  out(d,0xd3,9);assert.equal(d.status,2);assert.throws(()=>d.write(0xd2,256));
});

test('content identity, persistence and exact committed export',async()=>{
  const store=new Store(),base=makeLabDisk(),other=base.slice();other[2]^=1;
  assert.notEqual(await baseIdentity(base),await baseIdentity(other));
  const a=await DiskSession.open(base,store), b=await DiskSession.open(other,store);stage(a.device);await a.save();
  const reopened=await DiskSession.open(base,store);assert.equal(reopened.revision,1);assert.equal(reopened.device.exportCommitted()[0],90);assert.equal(b.device.exportCommitted()[0],65);
  assert.deepEqual(reopened.device.exportCommitted().slice(1),base.slice(1));assert.equal(base[0],65);
});

test('failed or stale save does not publish or alter committed export',async()=>{
  const store=new Store(),a=await DiskSession.open(makeLabDisk(),store),b=await DiskSession.open(makeLabDisk(),store);
  stage(a.device);await a.save();stage(b.device,88);await assert.rejects(b.save(),/Stale/);assert.equal(b.device.exportCommitted()[0],65);
  await b.reset();assert.equal(b.device.exportCommitted()[0],90);
  stage(b.device,88);store.commit=async()=>{throw Error('quota exceeded');};await assert.rejects(b.save(),/quota/);assert.equal(b.device.exportCommitted()[0],90);
  assert.equal((await DiskSession.open(makeLabDisk(),store)).device.exportCommitted()[0],90);
});

test('reset resolves abort-wins and commit-wins races before resuming',async()=>{
  for(const commitWins of [false,true]) {
    const store=new Store(); let finish; const entered=new Promise(resolve=>finish=resolve);let release;
    const gate=new Promise(resolve=>release=resolve);
    store.commit=async(key,record,expected,signal)=>{if(commitWins) store.records.set(key,structuredClone(record));finish();await gate;if(signal.aborted && !commitWins) throw Error('Save aborted');};
    const session=await DiskSession.open(makeLabDisk(),store);stage(session.device);
    const saving=session.save();await entered;const resetting=session.reset();assert.equal(session.device.busy,true);release();await saving.catch(()=>{});await resetting;
    assert.equal(session.device.exportCommitted()[0],commitWins?90:65);assert.equal(session.revision,commitWins?1:0);assert.deepEqual(session.device.staged,{});
  }
});

test('malformed stored metadata is rejected',async()=>{
  const store=new Store(),base=makeLabDisk(),key=await baseIdentity(base);
  store.records.set(key,{schema:1,length:64,sectorSize:16,revision:1,sectors:null});
  await assert.rejects(DiskSession.open(base,store),/overlay/);
  store.records.set(key,false);
  await assert.rejects(DiskSession.open(base,store),/metadata/);
});


test('IndexedDB load distinguishes absence from stored corrupt null and false',async()=>{
  function fakeDB(value) {return {transaction(){
    const request={}; const tx={objectStore(){return {get(){return request;}}}};
    queueMicrotask(()=>{request.result=value;request.onsuccess();tx.oncomplete();});return tx;
  }};}
  assert.equal(await new IndexedDBOverlayStore(fakeDB(undefined)).load('x'),null);
  assert.equal(await new IndexedDBOverlayStore(fakeDB(false)).load('x'),false);
  await assert.rejects(new IndexedDBOverlayStore(fakeDB(null)).load('x'),/Invalid stored/);
});

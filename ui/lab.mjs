// Apache-2.0. Host presentation and bounded scheduling; no guest execution here.
import {Machine} from '../machine/machine.mjs';
import {attachKeyboard, keyboardEvent} from '../devices/keyboard.mjs';
import {echoProgram} from '../fixtures/diagnostics/echo.mjs';
import {diskGuest} from '../fixtures/diagnostics/disk.mjs';
import {makeLabDisk} from '../fixtures/disks/lab-disk.mjs';
import {DiskSession, DISK_PORTS, validateBase} from '../devices/disk.mjs';
import {IndexedDBOverlayStore} from '../storage/indexeddb.mjs';

const $ = id => document.getElementById(id);
const registerNames=['ax','bx','cx','dx','si','di','bp','sp','cs','ds','es','ss','ip','flags'];
const hex = (value, digits=4) => value.toString(16).toUpperCase().padStart(digits,'0');
const decodeHex = str => Uint8Array.from(str.match(/../g).map(pair=>parseInt(pair,16)));
let machine, disk, store, hello, sequence=0, epoch=0, frame=null, transitioning=false;
let diskLabel='Original lab disk';
const registerCells = new Map();
for (const name of registerNames) { const group=document.createElement('div'), dt=document.createElement('dt'), dd=document.createElement('dd'); dt.textContent=name.toUpperCase(); group.append(dt,dd); $('registers').append(group); registerCells.set(name,dd); }
function render() {
 if(!machine) return;
 for(const name of registerNames) registerCells.get(name).textContent=hex(machine.cpu.registers[name]);
 $('profile').textContent=machine.profile; $('tick').textContent=String(machine.tick);
 $('state').textContent=machine.state.toUpperCase();
 $('instruction').textContent=machine.lastOutcome?.trace?.mnemonic || '—';
 $('reason').textContent=machine.lastOutcome?.reason || (machine.state==='running'?'Executing bounded batches.':'Ready at the direct-loader entry point.');
 $('output').textContent=machine.output.length ? machine.output.map(n=>n>=32&&n<=126?String.fromCharCode(n):`\\x${hex(n,2)}`).join('') : '—';
 const memory=machine.bus.ram; let lines=[];
 for(let row=0;row<25;row++) { let line=''; for(let col=0;col<80;col++) {const c=memory[0xb8000+(row*80+col)*2];line+=c>=32&&c<=126?String.fromCharCode(c):' ';} lines.push(line); }
 $('screen').textContent=lines.join('\n');
 $('screen-state').textContent=document.activeElement===$('screen') ? 'KEYBOARD FOCUSED' : 'FOCUS TO TYPE';
 if(disk) $('disk-status').textContent=`${diskLabel} · ${disk.identity} · revision ${disk.revision}. ${disk.status}. ${Object.keys(disk.device.staged).length ? 'Guest changes staged; save to commit.' : ''}`;
 $('save-disk').disabled=!disk || !!disk.pending || transitioning || machine.state==='running'; $('export-disk').disabled=!disk || transitioning;
 for(const id of ['run','step']) $(id).disabled=transitioning || !machine || !!disk?.pending;
 $('pause').disabled=transitioning || !machine; $('import-disk').disabled=transitioning || !store;
}
function stopFrame() {if(frame!==null) cancelAnimationFrame(frame);frame=null;}
function schedule() { if(frame!==null || machine?.state!=='running') return; const current=epoch; frame=requestAnimationFrame(()=>{frame=null;if(current!==epoch || !machine || machine.state!=='running') return;machine.runBatch(1000);render();schedule();}); }
async function newMachine() {
 if(!hello) return;
 stopFrame(); const request=++epoch; sequence=0; machine?.pause(); transitioning=true; render();
 try {
  if(disk) await disk.reset();
  if(request!==epoch) return;
  const selected=$('program').value;
  const options = selected==='text' ? {program:echoProgram,profile:'diagnostic-text-v1',registers:{ds:0xb800},setupBus:attachKeyboard,onEvent:keyboardEvent} : selected==='disk' ? {program:diskGuest,profile:'diagnostic-disk-v1',setupBus(bus){if(disk) for(const port of DISK_PORTS)bus.registerPort(port,disk.device);}} : {program:hello};
  machine=new Machine(options); transitioning=false; render();
 } catch(error) {
  if(request===epoch) {transitioning=true;render();$('reason').textContent=`Reset failed: ${error.message}`;}
 }
}
$('run').addEventListener('click',()=>{if(transitioning || disk?.pending || disk?.resetting) return;machine?.resume();render();schedule();});
$('pause').addEventListener('click',()=>{machine?.pause();stopFrame();render();});
$('step').addEventListener('click',()=>{if(!machine || transitioning || disk?.pending || disk?.resetting) return;machine.pause();stopFrame();machine.step();render();});
$('reset').addEventListener('click',newMachine);
$('program').addEventListener('change',newMachine);
$('screen').addEventListener('focus',render); $('screen').addEventListener('blur',render);
$('screen').addEventListener('keydown',event=>{
 if(transitioning || !machine || machine.state==='stopped' || machine.state==='halted' || $('program').value!=='text' || event.ctrlKey || event.altKey || event.metaKey || event.key.length!==1) return;
 const byte=event.key.charCodeAt(0); if(byte<0x20 || byte>0x7e) return;
 event.preventDefault(); machine.queueEvent({tick:machine.tick,sequence:sequence++,type:'key',byte});render();
});
$('import-disk').addEventListener('change',async event=>{
 const file=event.target.files?.[0]; event.target.value=''; if(!file)return;
 const request=++epoch; stopFrame(); machine?.pause(); transitioning=true; render();
 let resetStarted=false, resetComplete=false;
 try {
   if(file.size===0 || file.size>4096 || file.size%16) throw new Error('Choose 1–256 complete 16-byte lab sectors (16–4096 bytes).');
   const bytes=new Uint8Array(await file.arrayBuffer());validateBase(bytes);
   if(request!==epoch) return;
   if(disk) {resetStarted=true; await disk.reset(); resetComplete=true;}
   if(request!==epoch) return;
   const candidate=await DiskSession.open(bytes,store); if(request!==epoch) return;
   disk=candidate; diskLabel=file.name; newMachine();
 } catch(error) {
  if(request===epoch) {
   if(resetComplete) await newMachine();
   else {transitioning=resetStarted;render();}
   $('disk-status').textContent=`Import failed: ${error.message}`;
  }
 }
});
$('save-disk').addEventListener('click',async()=>{
 if(!disk) return;const active=disk;
 try {const promise=active.save();render();await promise;} catch { /* status is owned by session */ }
 if(active===disk) render();
});
$('export-disk').addEventListener('click',()=>{
 if(!disk)return; const bytes=disk.device.exportCommitted();const url=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));
 const a=document.createElement('a');a.href=url;a.download='486-committed-disk.img';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
async function init() {
 try {
  const response=await fetch(new URL('../fixtures/diagnostics/hello.json',import.meta.url));if(!response.ok) throw new Error(`Diagnostic fetch failed (${response.status})`);
  const fixture=await response.json();hello=decodeHex(fixture.hex);
  try {store=await IndexedDBOverlayStore.open();} catch(error) {const reason=error.message;store={load:async()=>null,commit:async()=>{throw new Error(`Browser storage unavailable: ${reason}`);}};}
  disk=await DiskSession.open(makeLabDisk(),store);await newMachine();
 } catch(error) { $('reason').textContent=`Lab could not start: ${error.message}. Serve this folder over HTTP or HTTPS.`; }
}
init();

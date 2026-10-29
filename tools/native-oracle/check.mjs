// Optional independent differential check against host x86 arithmetic.
// The C oracle executes native instructions; it does not import emulator helpers.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Bus } from '../../bus/bus.mjs';
import { Cpu } from '../../cpu/cpu.mjs';

if (process.arch !== 'x64') throw new Error('This optional oracle requires an x86-64 host');
const dir=mkdtempSync(join(tmpdir(),'486-native-oracle-'));
const source=resolve(dirname(fileURLToPath(import.meta.url)),'alu.c');
const binary=join(dir,'oracle');
function run(command,args,opts={}) {
  const result=spawnSync(command,args,{encoding:'utf8',maxBuffer:8*1024*1024,...opts});
  if(result.error) throw result.error;
  if(result.status!==0) throw new Error(`${command} exited ${result.status}: ${result.stderr}`);
  return result.stdout;
}
try {
  run('gcc',['-std=c11','-O2','-Wall','-Wextra','-o',binary,source]);
  const vectors=run(binary,[]).trim().split('\n');
  const bus=new Bus(),cpu=new Cpu(bus,{profile:'diagnostic-compute-v1'});
  const opcodes={add:[0x00,0x01],sub:[0x28,0x29],cmp:[0x38,0x39]};
  for(const line of vectors) {
    const [kind,widthText,aText,bText,resultText,flagsText]=line.split(' ');
    const width=Number(widthText),a=Number(aText),b=Number(bText);
    bus.ram[0x7c00]=opcodes[kind][width===8?0:1]; bus.ram[0x7c01]=0xd8; // AL/AX destination, BL/BX source
    cpu.registers.ip=0x7c00;cpu.registers.ax=a;cpu.registers.bx=b;cpu.registers.flags=0x202;
    const outcome=cpu.step(), value=cpu.registers.ax & (width===8?0xff:0xffff), flags=cpu.registers.flags & 0x8d5;
    if(!outcome.retired || value!==Number(resultText) || flags!==Number(flagsText))
      throw new Error(`Mismatch: ${line}; executor status=${outcome.status} result=${value} flags=${flags}`);
  }
  if(vectors.length!==49152) throw new Error(`Unexpected vector count ${vectors.length}`);
  console.log(`PASS ${vectors.length} native x86 ALU vectors; defined flags mask 0x8d5`);
} finally { rmSync(dir,{recursive:true,force:true}); }

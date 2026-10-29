import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, cp, rm, readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const repository=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const renderer=path.join(repository,'scripts/render-pages.mjs');
async function fixture(t) {
 const root=await mkdtemp(path.join(tmpdir(),'486-render-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(path.join(root,'docs'),{recursive:true});await mkdir(path.join(root,'tools/native-oracle'),{recursive:true});
 return root;
}
function render(root) {
 const r=spawnSync(process.execPath,[renderer,root],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);return r;
}
test('Pages renderer generates HTML, links and anchors without touching Markdown or code',async t=>{
 const root=await fixture(t);
 await writeFile(path.join(root,'index.html'),'<a href="./docs/SUPPORT.md">Support</a>');
 const markdown='# Support & evidence\n\n[Inner](OTHER.md#some-heading) [outside](https://example.com/page.md) ![Image](picture.png)\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```text\n[keep](OTHER.md)\n```\n';
 await writeFile(path.join(root,'docs/SUPPORT.md'),markdown);
 await writeFile(path.join(root,'docs/OTHER.md'),'# Some heading\n\n## Repeat\n\n## Repeat\n\n[Root](../README.md?x=1#read-me)');
 await writeFile(path.join(root,'README.md'),'# Read me\n');
 await writeFile(path.join(root,'GETTING_STARTED.md'),'# Start\n');
 await writeFile(path.join(root,'tools/native-oracle/README.md'),'# Oracle\n');
 render(root);
 const html=await readFile(path.join(root,'docs/SUPPORT.html'),'utf8');
 assert.match(html,/<h1 id="support--evidence">Support &amp; evidence<\/h1>/);
 assert.match(html,/<a href="OTHER\.html#some-heading">Inner<\/a>/);
 assert.match(html,/href="https:\/\/example\.com\/page\.md"/);
 assert.match(html,/<img src="picture\.png" alt="Image">/);
 assert.match(html,/<table>/);assert.match(html,/<pre><code class="language-text">\[keep\]\(OTHER\.md\)/);
 assert.match(html,/href="\.\.\/ui\/docs\.css"/);assert.match(html,/href="\.\.\/index\.html"/);
 const other=await readFile(path.join(root,'docs/OTHER.html'),'utf8');
 assert.match(other,/id="some-heading"/);assert.match(other,/id="repeat-1"/);assert.match(other,/href="\.\.\/README\.html\?x=1#read-me"/);
 assert.match(await readFile(path.join(root,'index.html'),'utf8'),/href="\.\/docs\/SUPPORT\.html"/);
 assert.equal(await readFile(path.join(root,'docs/SUPPORT.md'),'utf8'),markdown);
});

test('actual staged documentation links resolve to rendered project files',async t=>{
 const root=await fixture(t);
 for(const name of ['index.html','README.md','GETTING_STARTED.md','LICENSE'])await cp(path.join(repository,name),path.join(root,name));
 await cp(path.join(repository,'docs'),path.join(root,'docs'),{recursive:true});
 await cp(path.join(repository,'tools/native-oracle'),path.join(root,'tools/native-oracle'),{recursive:true});
 await mkdir(path.join(root,'tools/marked'),{recursive:true});
 await cp(path.join(repository,'tools/marked/README.md'),path.join(root,'tools/marked/README.md'));
 await cp(path.join(repository,'tools/marked/LICENSE.md'),path.join(root,'tools/marked/LICENSE.md'));
 render(root);
 const htmlFiles=[];
 async function collect(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const f=path.join(dir,entry.name);if(entry.isDirectory())await collect(f);else if(f.endsWith('.html'))htmlFiles.push(f);}}
 await collect(path.join(root,'docs'));await collect(path.join(root,'tools'));htmlFiles.push(path.join(root,'README.html'),path.join(root,'GETTING_STARTED.html'));
 for(const file of htmlFiles){const html=await readFile(file,'utf8');for(const match of html.matchAll(/href="([^"#?]+\.html)(?:[?#][^"]*)?"/g)){
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|\/)/i.test(match[1])) continue;
  const target=path.resolve(path.dirname(file),match[1]);await readFile(target).catch(()=>assert.fail(`${path.relative(root,file)} links to missing ${match[1]}`));
 }}
});

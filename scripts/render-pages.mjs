// Render only checked-in, staged project documentation. User disk contents are
// never passed to this build-time renderer. Marked is vendored for offline builds.
import {Marked} from '../tools/marked/marked.mjs';
import {readdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const [destination] = process.argv.slice(2);
if (!destination) throw new Error('Usage: node scripts/render-pages.mjs <staged-directory>');
const root = path.resolve(destination);

function rewriteHref(href) {
  // Rewrite local Markdown targets, including query and fragment suffixes.
  // Leave absolute URLs, protocol-relative URLs, anchors and non-Markdown intact.
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|\/|#)/i.test(href)) return href;
  return href.replace(/\.md(?=([?#]|$))/i, '.html');
}
function headingText(tokens) {
  return tokens.map(token => token.tokens ? headingText(token.tokens) : token.type === 'html' ? '' : token.text ?? '').join('');
}
function createRenderer() {
  const slugs = new Map();
  const markdown = new Marked({gfm: true, walkTokens(token) {
    if (token.type === 'link') token.href = rewriteHref(token.href);
  }});
  markdown.use({renderer: {heading(token) {
    // Match normal GitHub heading fragments; duplicate headings get -1, -2, …
    const base = headingText(token.tokens).toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').trim().replace(/\s/g, '-');
    const count = slugs.get(base) ?? 0; slugs.set(base, count + 1);
    const id = count ? `${base}-${count}` : base;
    return `<h${token.depth} id="${id}">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
  }}});
  return markdown;
}
async function markdownFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const child = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await markdownFiles(child));
    else if (entry.isFile() && /\.md$/i.test(entry.name)) found.push(child);
  }
  return found.sort();
}
const documents = [path.join(root, 'README.md'), path.join(root, 'GETTING_STARTED.md'),
  ...await markdownFiles(path.join(root, 'docs')),
  ...await markdownFiles(path.join(root, 'tools'))];
for (const file of documents) {
  const relative = path.relative(root, file).split(path.sep).join('/');
  const folder = path.posix.dirname(relative);
  const css = path.posix.relative(folder, 'ui/docs.css');
  const home = path.posix.relative(folder, 'index.html');
  const source = await readFile(file, 'utf8');
  const content = createRenderer().parse(source);
  const html = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>486 · Documentation</title><link rel="stylesheet" href="${css}"></head><body><main><p class="back"><a href="${home}">← Back to the lab</a></p><article>${content}</article></main></body></html>\n`;
  await writeFile(file.replace(/\.md$/i, '.html'), html);
}
// Source keeps its Markdown URL for an unbuilt local checkout. Only the staged
// website points to the corresponding rendered HTML document.
const indexPath = path.join(root, 'index.html');
const index = await readFile(indexPath, 'utf8');
const updated = index.replace('href="./docs/SUPPORT.md"', 'href="./docs/SUPPORT.html"');
if (updated === index) throw new Error('Expected Support link was not found in staged index.html');
await writeFile(indexPath, updated);
console.log(`Rendered ${documents.length} Markdown documents in ${root}`);

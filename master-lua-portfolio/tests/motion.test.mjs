import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read = (file) => readFile(new URL('../public/' + file, import.meta.url), 'utf8');

test('public HTML loads the motion enhancement after the base app', async () => {
  const html = await read('index.html');
  assert.match(html, /href="\/motion\.css"/);
  assert.match(html, /src="\/motion\.js" defer/);
  assert.ok(html.indexOf('/app.js') < html.indexOf('/motion.js'));
});

test('motion layer supports reduced motion and fresh content', async () => {
  const js = await read('motion.js');
  const css = await read('motion.css');
  const app = await read('app.js');
  assert.match(js, /prefers-reduced-motion/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(js, /portfolio:rendered/);
  assert.match(app, /CustomEvent\('portfolio:rendered'\)/);
  assert.match(js, /sessionStorage/);
  assert.match(js, /portfolio-motion-intro/);
});

test('admin remains independent of public motion assets', async () => {
  const html = await read('admin.html');
  assert.doesNotMatch(html, /motion\.js|motion\.css/);
});

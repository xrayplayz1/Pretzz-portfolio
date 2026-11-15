import test from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,sanitizeSite} from '../server.mjs';
import {readFile} from 'node:fs/promises';
const base=JSON.parse(await readFile(new URL('../data/site.json',import.meta.url)));
test('password hash is salt based and does not contain plaintext',()=>{
  const a=hashPassword('example-secret-123');const b=hashPassword('example-secret-123');
  assert.notEqual(a.hash,b.hash);assert.notEqual(a.hash,'example-secret-123');
});
test('sanitization keeps editable content',()=>{
  const saved=sanitizeSite(base);
  assert.equal(saved.projects.length,3);assert.equal(saved.name,'Master Lua');
});
test('sanitization rejects javascript URLs and unexpected image paths',()=>{
  const saved=sanitizeSite({...base,socials:[{name:'Bad',url:'javascript:alert(1)'}],projects:[{title:'Bad',image:'/data/auth.json',url:'javascript:foo()'}]});
  assert.equal(saved.socials[0].url,'');assert.equal(saved.projects[0].image,'');assert.equal(saved.projects[0].url,'');
});

import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, pbkdf2Sync, timingSafeEqual, randomUUID } from 'node:crypto';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');
const SITE_FILE = path.join(DATA, 'site.json');
const AUTH_FILE = path.join(DATA, 'auth.json');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const COOKIE_SECURE = process.env.COOKIE_SECURE === '1';
const SESSION_AGE = 12 * 60 * 60 * 1000;
const sessions = new Map();
const attempts = new Map();
const MIME = {
  '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg',
  '.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif',
  '.avif':'image/avif','.ico':'image/x-icon'
};
const IMAGE_TYPES = { 'image/png':'.png', 'image/jpeg':'.jpg', 'image/webp':'.webp', 'image/gif':'.gif', 'image/avif':'.avif' };

async function readJSON(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }
async function atomicJSON(file, data) {
  const temp = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(data, null, 2) + '\n', {mode:0o600});
  await fs.rename(temp, file);
}
export function hashPassword(password, salt=randomBytes(32).toString('hex')) {
  const iterations = 310000;
  const hash = pbkdf2Sync(password, Buffer.from(salt, 'hex'), iterations, 32, 'sha256').toString('hex');
  return { salt, hash, iterations, algorithm:'pbkdf2-sha256' };
}
function verifyPassword(password, auth) {
  if (!auth?.salt || !auth?.hash || auth.algorithm !== 'pbkdf2-sha256') return false;
  const result = pbkdf2Sync(password, Buffer.from(auth.salt, 'hex'), auth.iterations, 32, 'sha256');
  const expected = Buffer.from(auth.hash, 'hex');
  return result.length === expected.length && timingSafeEqual(result, expected);
}
const limits = {name:90, role:130, eyebrow:140, headline:180, headlineAccent:180, intro:520, aboutTitle:140, about:2200, email:180, location:100, availability:140, footer:180, contactTitle:150};
function trim(value, max=300) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function safeUrl(value, image=false) {
  const url = trim(value, 1200);
  if (!url) return '';
  if (image && (/^\/uploads\/[a-z0-9-]+\.(png|jpg|webp|gif|avif)$/i.test(url) || /^\/assets\/[a-z0-9-]+\.svg$/i.test(url))) return url;
  if (/^https?:\/\//i.test(url)) {
    try { const u = new URL(url); if (u.username || u.password) return ''; return u.href; } catch { return ''; }
  }
  return '';
}
function sanitizeSite(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid content');
  const out = {};
  for (const [key, max] of Object.entries(limits)) out[key] = trim(input[key], max);
  out.accent = /^#[0-9a-f]{6}$/i.test(input.accent) ? input.accent : '#ccfa5a';
  out.stats = (Array.isArray(input.stats) ? input.stats : []).slice(0, 4).map(item => ({value:trim(item?.value, 16), label:trim(item?.label, 60)}));
  out.skills = (Array.isArray(input.skills) ? input.skills : []).slice(0, 40).map(item=>trim(item, 40)).filter(Boolean);
  out.services = (Array.isArray(input.services) ? input.services : []).slice(0, 8).map(item=>({
    number:trim(item?.number, 8), title:trim(item?.title, 70), description:trim(item?.description, 350)
  }));
  out.socials = (Array.isArray(input.socials) ? input.socials : []).slice(0, 12).map(item=>({
    name:trim(item?.name, 50),url:safeUrl(item?.url)
  })).filter(item=>item.name);
  out.projects = (Array.isArray(input.projects) ? input.projects : []).slice(0, 60).map(item=>({
    id: /^[a-z0-9-]{4,80}$/i.test(item?.id) ? item.id : randomUUID(),
    title:trim(item?.title, 110), category:trim(item?.category, 70),
    description:trim(item?.description, 700), year:trim(item?.year, 12),
    image:safeUrl(item?.image, true), url:safeUrl(item?.url), github:safeUrl(item?.github),
    featured: Boolean(item?.featured), art:['snow','neon','pink','blue','orange','green'].includes(item?.art) ? item.art : 'neon'
  })).filter(item=>item.title);
  return out;
}
async function loadSite() { return readJSON(SITE_FILE); }
function send(res, status, body, type='application/json; charset=utf-8', headers={}) {
  const defaults = {
    'Content-Type':type, 'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY',
    'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    'Cache-Control':'no-store'
  };
  res.writeHead(status,{...defaults,...headers});res.end(body);
}
function json(res, status, object, headers={}) { send(res,status,JSON.stringify(object),'application/json; charset=utf-8',headers); }
function fail(res, status, message) { json(res,status,{error:message}); }
async function bodyBuffer(req, maxBytes=1_200_000) {
  const parts=[];let length=0;
  for await (const chunk of req) { length+=chunk.length; if (length>maxBytes) {const error=new Error('Payload too large');error.status=413;throw error;} parts.push(chunk); }
  return Buffer.concat(parts);
}
async function jsonBody(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) { const e=new Error('JSON required');e.status=415;throw e; }
  try {return JSON.parse((await bodyBuffer(req)).toString('utf8'));}
  catch(e){if(e.status) throw e;const err=new Error('Invalid JSON');err.status=400;throw err;}
}
function originAllowed(req) {
  if (!req.headers.origin) return true;
  const host=req.headers.host;
  if (!host) return false;
  try {return new URL(req.headers.origin).host===host;}catch{return false;}
}
function getCookie(req,name) {const cookies=(req.headers.cookie||'').split(';');const part=cookies.find(x=>x.trim().startsWith(name+'='));return part?.trim().slice(name.length+1)||'';}
function activeSession(req) {
  const token=getCookie(req,'portfolio_session');
  const session=sessions.get(token);
  if(!session) return null;
  if(session.expires<Date.now()){sessions.delete(token);return null;}
  return {token,...session};
}
function protect(req,res,requireCsrf=false) {
  const session=activeSession(req);
  if(!session){fail(res,401,'Please sign in first.');return null;}
  if(requireCsrf && req.headers['x-csrf-token']!==session.csrf){fail(res,403,'Security token missing or invalid.');return null;}
  if(requireCsrf && !originAllowed(req)){fail(res,403,'Invalid origin.');return null;}
  return session;
}
function setCookie(res,token,clear=false) {
  const base=`portfolio_session=${clear?'':token}; Path=/; HttpOnly; SameSite=Strict${COOKIE_SECURE?'; Secure':''}`;
  return {'Set-Cookie':base+(clear?'; Max-Age=0':`; Max-Age=${Math.floor(SESSION_AGE/1000)}`)};
}
function isRateLimited(ip) {
  const x=attempts.get(ip);
  if(!x) return false;
  if(x.until<Date.now()){attempts.delete(ip);return false;}
  return x.count>=5;
}
function noteFail(ip) {
  const previous=attempts.get(ip);
  const current=previous && previous.until>Date.now()?previous:{count:0,until:Date.now()+10*60*1000};
  current.count++;attempts.set(ip,current);
}
async function serveFile(req,res,filepath,cache=false) {
  try {
    const stat=await fs.stat(filepath);
    if(!stat.isFile())return fail(res,404,'Not found');
    const ext=path.extname(filepath).toLowerCase();
    const mime=MIME[ext];if(!mime)return fail(res,415,'Unsupported file');
    const headers={'Content-Length':stat.size};
    if(cache) headers['Cache-Control']='public, max-age=604800';
    res.writeHead(200,{
      'Content-Type':mime,'X-Content-Type-Options':'nosniff',
      'Referrer-Policy':'strict-origin-when-cross-origin',
      'X-Frame-Options':'DENY',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      ...headers
    });
    createReadStream(filepath).pipe(res);
  } catch { fail(res,404,'Not found'); }
}
async function handler(req,res){
  try{
    const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
    const pathname=decodeURIComponent(u.pathname);
    if(pathname==='/api/site' && req.method==='GET') return json(res,200,await loadSite());
    if(pathname==='/api/admin/login' && req.method==='POST') {
      if(!originAllowed(req))return fail(res,403,'Invalid origin.');
      const ip=req.socket.remoteAddress||'unknown';
      if(isRateLimited(ip))return fail(res,429,'Too many attempts. Try again in 10 minutes.');
      const data=await jsonBody(req);
      if(typeof data.password!=='string'||data.password.length>200)return fail(res,400,'Invalid password.');
      const auth=await readJSON(AUTH_FILE);
      if(!verifyPassword(data.password,auth)){noteFail(ip);return fail(res,401,'Incorrect password.');}
      attempts.delete(ip);
      const token=randomBytes(32).toString('hex');
      const csrf=randomBytes(32).toString('hex');
      sessions.set(token,{csrf,expires:Date.now()+SESSION_AGE});
      return json(res,200,{ok:true,csrf},{...setCookie(res,token)});
    }
    if(pathname==='/api/admin/session' && req.method==='GET') {
      const s=activeSession(req);
      return json(res,200,s?{authenticated:true,csrf:s.csrf}:{authenticated:false});
    }
    if(pathname==='/api/admin/logout' && req.method==='POST') {
      const s=protect(req,res,true);if(!s)return;
      sessions.delete(s.token);return json(res,200,{ok:true},setCookie(res,'',true));
    }
    if(pathname==='/api/admin/site' && req.method==='PUT') {
      if(!protect(req,res,true))return;
      const next=sanitizeSite(await jsonBody(req));
      await atomicJSON(SITE_FILE,next);
      return json(res,200,{ok:true,site:next});
    }
    if(pathname==='/api/admin/password' && req.method==='POST') {
      if(!protect(req,res,true))return;
      const input=await jsonBody(req);
      if(typeof input.current!=='string'||typeof input.next!=='string'||input.next.length<12||input.next.length>128)return fail(res,400,'New password must be 12–128 characters.');
      const auth=await readJSON(AUTH_FILE);
      if(!verifyPassword(input.current,auth))return fail(res,401,'Current password is incorrect.');
      await atomicJSON(AUTH_FILE,hashPassword(input.next));
      sessions.clear();return json(res,200,{ok:true},setCookie(res,'',true));
    }
    if(pathname==='/api/admin/upload' && req.method==='POST') {
      if(!protect(req,res,true))return;
      const type=(req.headers['content-type']||'').split(';')[0];
      if(!IMAGE_TYPES[type])return fail(res,415,'Only PNG, JPG, WebP, GIF, and AVIF images are supported.');
      const data=await bodyBuffer(req,5_000_000);
      if(data.length<20)return fail(res,400,'Image is empty.');
      const signatures={
        'image/png':data.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')),
        'image/jpeg':data.subarray(0,3).equals(Buffer.from('ffd8ff','hex')),
        'image/gif':['GIF87a','GIF89a'].includes(data.subarray(0,6).toString('ascii')),
        'image/webp':data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP',
        'image/avif':data.toString('ascii',4,12).includes('ftypavif')||data.toString('ascii',4,16).includes('ftypavis')
      };
      if(!signatures[type])return fail(res,400,'Image signature does not match the file type.');
      const name=`${randomUUID()}${IMAGE_TYPES[type]}`;
      await fs.writeFile(path.join(PUBLIC,'uploads',name),data,{flag:'wx',mode:0o644});
      return json(res,201,{url:'/uploads/'+name});
    }
    if(req.method!=='GET'&&req.method!=='HEAD')return fail(res,404,'Not found');
    if(pathname==='/'||pathname==='/index.html')return serveFile(req,res,path.join(PUBLIC,'index.html'));
    if(pathname==='/admin'||pathname==='/admin/')return serveFile(req,res,path.join(PUBLIC,'admin.html'));
    if(pathname==='/.env'||pathname.startsWith('/data/')||pathname.includes('..'))return fail(res,404,'Not found');
    const relative=pathname.replace(/^\/+/, '');
    const resolved=path.resolve(PUBLIC,relative);
    if(!resolved.startsWith(PUBLIC+path.sep))return fail(res,404,'Not found');
    return serveFile(req,res,resolved,true);
  }catch(error){
    console.error('[Request error]',error.message);
    if(!res.headersSent) fail(res,error.status||500,error.status?error.message:'An unexpected error occurred.');
  }
}
async function start(){
  await fs.mkdir(DATA,{recursive:true});await fs.mkdir(path.join(PUBLIC,'uploads'),{recursive:true});
  if(!existsSync(AUTH_FILE)){
    if(!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length<12) throw new Error('Set ADMIN_PASSWORD (12+ characters) for first run.');
    await atomicJSON(AUTH_FILE,hashPassword(process.env.ADMIN_PASSWORD));
    console.log('Created protected admin credential file. Unset ADMIN_PASSWORD after setup.');
  }
  if(!existsSync(SITE_FILE))throw new Error('Missing data/site.json');
  http.createServer(handler).listen(PORT,HOST,()=>{
    console.log(`Portfolio: http://${HOST}:${PORT}/`);
    console.log(`Admin:     http://${HOST}:${PORT}/admin`);
    if(!COOKIE_SECURE)console.log('For public HTTPS deployment, set COOKIE_SECURE=1.');
  });
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))start().catch(e=>{console.error(e);process.exitCode=1;});
export {sanitizeSite,handler};

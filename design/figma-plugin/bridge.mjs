// Local relay between a shell and the "Bridge (live)" plugin command.
//   node bridge.mjs                      start the relay (keep it running)
//   node bridge.mjs run job.js [out/]    send job.js, print the result, save PNGs to out/
// The job runs as the body of an async function with code.js's helpers in scope
// (P, AL, T, comp, findComp, variant, icon, init, build*, …) plus snap(node, name, scale).
import http from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 7079;
const here = dirname(fileURLToPath(import.meta.url));

if (process.argv[2] === 'run') {
  const job = readFileSync(process.argv[3], 'utf8');
  const out = process.argv[4] || join(here, 'out');
  const src = readFileSync(join(here, 'code.js'), 'utf8');
  const prelude = src.slice(0, src.indexOf('// ---------- plugin entry ----------'));
  const res = await fetch(`http://localhost:${PORT}/run`, { method: 'POST', body: prelude + '\n' + job });
  const r = await res.json();
  if (r.images && r.images.length) {
    mkdirSync(out, { recursive: true });
    for (const img of r.images) {
      const p = join(out, img.name.replace(/[^\w.-]+/g, '_') + '.png');
      writeFileSync(p, Buffer.from(img.b64, 'base64'));
      console.log('saved', p);
    }
  }
  delete r.images;
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 1);
}

const queue = [];
let inFlight = null;
let waiter = null;
let nextId = 1;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
const body = req => new Promise(ok => { let d = ''; req.on('data', c => d += c); req.on('end', () => ok(d)); });

function hand(res) {
  inFlight = queue.shift();
  res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ id: inFlight.id, code: inFlight.code }));
}

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  if (req.url === '/next') {
    if (!inFlight && queue.length) return hand(res);
    if (waiter) { waiter.writeHead(204, cors); waiter.end(); }
    waiter = res;
    const t = setTimeout(() => { if (waiter === res) { waiter = null; res.writeHead(204, cors); res.end(); } }, 20000);
    res.on('close', () => { clearTimeout(t); if (waiter === res) waiter = null; });
    return;
  }
  if (req.url === '/result' && req.method === 'POST') {
    const r = JSON.parse(await body(req));
    if (inFlight && inFlight.id === r.id) { inFlight.done(r); inFlight = null; }
    res.writeHead(204, cors); res.end();
    if (waiter && queue.length && !inFlight) { const w = waiter; waiter = null; hand(w); }
    return;
  }
  if (req.url === '/run' && req.method === 'POST') {
    const code = await body(req);
    const id = nextId++;
    const t = setTimeout(() => {
      const i = queue.findIndex(j => j.id === id);
      if (i >= 0) queue.splice(i, 1);
      if (inFlight && inFlight.id === id) inFlight = null;
      res.writeHead(504, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'timed out: is the Bridge (live) command running in Figma?' }));
    }, 180000);
    queue.push({ id, code, done: r => { clearTimeout(t); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(r)); } });
    if (waiter && !inFlight) { const w = waiter; waiter = null; hand(w); }
    return;
  }
  res.writeHead(404, cors); res.end();
}).listen(PORT, '127.0.0.1', () => console.log(`bridge on http://localhost:${PORT}`));

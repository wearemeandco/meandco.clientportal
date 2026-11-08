/* ============================================================
   Fully local dev server, no Netlify CLI, no cloud account.
   Same idea as AI Lab's own run scripts: a plain Node process on
   your own machine, local files as the data store. Once you're
   happy with the portal, this becomes a real Netlify deploy and
   Blobs takes over automatically, blobs.js already supports both,
   nothing else changes.

   Run: node scripts/local-server.js
   Then open: http://localhost:8787/portal/meandco
              http://localhost:8787/admin
   ============================================================ */

process.env.MORA_PORTAL_LOCAL_DATA = '1';

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// Plain node does not read .env automatically the way netlify dev does.
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
    });
}

const portal = require('../netlify/functions/portal/portal.js');
const admin = require('../netlify/functions/admin/admin.js');
const intake = require('../netlify/functions/intake/intake.js');

const PORT = 8787;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function toEvent(req, body) {
  const parsed = url.parse(req.url, true);
  return {
    httpMethod: req.method,
    path: parsed.pathname,
    queryStringParameters: parsed.query,
    headers: req.headers,
    body: body || '',
    isBase64Encoded: false,
  };
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
  });
}

function sendResult(res, result) {
  const headers = result.headers || {};
  res.writeHead(result.statusCode, headers);
  if (result.isBase64Encoded) {
    res.end(Buffer.from(result.body || '', 'base64'));
  } else {
    res.end(result.body || '');
  }
}

function serveStatic(req, res, pathname) {
  const filePath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = path.join(PUBLIC_DIR, filePath);
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(fullPath);
    const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.css' ? 'text/css' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const pathname = url.parse(req.url).pathname;
  const body = await readBody(req);
  const event = toEvent(req, body);

  try {
    if (pathname.startsWith('/portal/')) {
      const parts = pathname.slice('/portal/'.length).split('/').filter(Boolean);
      event.queryStringParameters = event.queryStringParameters || {};
      event.queryStringParameters.slug = parts[0] || '';
      if (parts[1] === 'file' && parts[2]) {
        event.queryStringParameters.fileId = parts[2];
      } else if (parts[1]) {
        event.queryStringParameters.cardId = parts[1];
      }
      return sendResult(res, await portal.handler(event));
    }
    if (pathname.startsWith('/onboarding-form/')) {
      const parts = pathname.slice('/onboarding-form/'.length).split('/').filter(Boolean);
      event.queryStringParameters = event.queryStringParameters || {};
      event.queryStringParameters.slug = parts[0] || '';
      event.queryStringParameters.cardId = parts[1] || '';
      event.queryStringParameters.form = '1';
      return sendResult(res, await portal.handler(event));
    }
    if (pathname === '/.netlify/functions/portal') {
      return sendResult(res, await portal.handler(event));
    }
    // Stage 1, the public front door. Mirrors the /start redirects in
    // netlify.toml, so what runs here is what runs on the real deploy.
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      event.path = pathname;
      return sendResult(res, await admin.handler(event));
    }
    // Intake, mirroring the netlify.toml redirects one for one so what
    // runs locally is what runs deployed. The root is the entry page
    // now, so public/index.html is no longer what / serves.
    if (
      pathname === '/' ||
      pathname === '/start' ||
      pathname.startsWith('/start/') ||
      pathname === '/login' ||
      pathname.startsWith('/magic/') ||
      pathname === '/.netlify/functions/intake'
    ) {
      event.path = pathname;
      return sendResult(res, await intake.handler(event));
    }
    return serveStatic(req, res, pathname);
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server error: ' + err.message);
  }
});

server.listen(PORT, () => {
  console.log('Mora client portal, fully local, running at http://localhost:' + PORT);
  console.log('Front door: http://localhost:' + PORT + '/start');
  console.log('Inquiry:    http://localhost:' + PORT + '/start/inquiry');
  console.log('Portal:     http://localhost:' + PORT + '/portal/meandco');
  console.log('Brief:      http://localhost:' + PORT + '/portal/meandco/brief');
  console.log('Admin:      http://localhost:' + PORT + '/admin');
  console.log('Inquiries:  http://localhost:' + PORT + '/admin/inquiries');
});

const fs = require('node:fs');
const path = require('node:path');

const PUBLIC_ROOT = path.resolve(__dirname, '../../public');
const ALLOWED = new Map([
  ['/manifest.webmanifest', 'manifest.webmanifest'],
  ['/assets/preston-ai-logo.png', 'assets/preston-ai-logo.png'],
  ['/icons/favicon-32.png', 'icons/favicon-32.png'],
  ['/icons/apple-touch-icon.png', 'icons/apple-touch-icon.png'],
  ['/icons/icon-192.png', 'icons/icon-192.png'],
  ['/icons/icon-512.png', 'icons/icon-512.png'],
  ['/icons/icon-maskable-512.png', 'icons/icon-maskable-512.png']
]);

function contentType(file) {
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.webmanifest')) return 'application/manifest+json; charset=utf-8';
  return 'application/octet-stream';
}

function serveStatic(req, res, pathname) {
  if (pathname.includes('\0') || /%2e/i.test(req.url || '')) return false;
  const relative = ALLOWED.get(pathname);
  if (!relative) return false;
  const file = path.resolve(PUBLIC_ROOT, relative);
  if (!file.startsWith(PUBLIC_ROOT + path.sep)) return false;
  let data;
  try { data = fs.readFileSync(file); } catch { return false; }
  res.writeHead(200, {'content-type':contentType(file), 'cache-control':'public,max-age=86400,immutable'});
  res.end(data);
  return true;
}

module.exports = { serveStatic, ALLOWED };

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {ALLOWED}=require('../src/http/static');

const publicRoot=path.join(__dirname,'../public');
const manifest=JSON.parse(fs.readFileSync(path.join(publicRoot,'manifest.webmanifest'),'utf8'));

function pngDimensions(file){
  const data=fs.readFileSync(file);
  assert.equal(data.subarray(1,4).toString('ascii'),'PNG',`${file} must be a PNG`);
  return {width:data.readUInt32BE(16),height:data.readUInt32BE(20),bytes:data.length};
}

assert.equal(manifest.name,'preston.ai');
assert.equal(manifest.short_name,'preston.ai');
assert.equal(manifest.start_url,'/');
assert.equal(manifest.display,'standalone');
assert.ok(manifest.icons.some(i=>i.src==='/icons/icon-192.png'&&i.sizes==='192x192'));
assert.ok(manifest.icons.some(i=>i.src==='/icons/icon-512.png'&&i.sizes==='512x512'&&!i.purpose));
assert.ok(manifest.icons.some(i=>i.src==='/icons/icon-maskable-512.png'&&i.sizes==='512x512'&&i.purpose==='maskable'));

const expectedIcons=[
  ['icons/favicon-32.png',32,25000],
  ['icons/apple-touch-icon.png',180,175000],
  ['icons/icon-192.png',192,200000],
  ['icons/icon-512.png',512,800000],
  ['icons/icon-maskable-512.png',512,800000]
];
for(const [relative,size,maxBytes] of expectedIcons){
  const file=path.join(publicRoot,relative);
  assert.ok(fs.existsSync(file),`missing ${relative}`);
  const png=pngDimensions(file);
  assert.deepEqual([png.width,png.height],[size,size],`${relative} should be ${size}x${size}`);
  assert.ok(png.bytes<maxBytes,`${relative} should be smaller than ${maxBytes} bytes; got ${png.bytes}`);
}

const source=pngDimensions(path.join(publicRoot,'icons/preston ai app icon.png'));
assert.ok(source.width>=512&&source.height>=512,'approved source icon must remain high resolution');
assert.ok(fs.existsSync(path.join(__dirname,'../scripts/build-icons.js')),'missing deterministic icon build script');
assert.ok(fs.existsSync(path.join(publicRoot,'assets/preston-ai-logo.png')),'missing preston.ai logo');
assert.equal(ALLOWED.get('/sw.js'),'sw.js');
assert.equal(ALLOWED.get('/notifications.js'),'notifications.js');
const sw=fs.readFileSync(path.join(publicRoot,'sw.js'),'utf8');
assert.match(sw,/addEventListener\(['"]push['"]/);
assert.match(sw,/showNotification/);
assert.match(sw,/addEventListener\(['"]notificationclick['"]/);
assert.match(sw,/openWindow|focus\(/);
console.log('pwa tests passed');

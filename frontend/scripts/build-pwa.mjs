// Generate a versioned offline cache from the actual Vite output.
// This deliberately caches only static application files, never journal records.
import {readdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
async function filesIn(folder, prefix = '') {
  const entries = await readdir(folder, {withFileTypes:true});
  const result = [];
  for (const entry of entries) {
    const rel = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) result.push(...await filesIn(path.join(folder, entry.name), rel));
    else if (entry.isFile() && rel !== 'sw.js') result.push(rel);
  }
  return result;
}
const paths = (await filesIn(dist)).sort();
const hash = createHash('sha256');
for (const rel of paths) {
  hash.update(rel);
  hash.update(await readFile(path.join(dist, rel)));
}
const cacheName = 'yaprak-static-' + hash.digest('hex').slice(0, 14);
const precache = ['./', ...paths.map(p => './' + p)];
const worker = `
const CACHE_NAME = ${JSON.stringify(cacheName)};
const PRECACHE = ${JSON.stringify(precache)};

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('yaprak-static-') && key !== CACHE_NAME) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try { return await fetch(request); }
      catch {
        return (await caches.match(request)) ||
          (await caches.match(new URL('./index.html', self.registration.scope))) ||
          Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    return fetch(request);
  })());
});
`;
await writeFile(path.join(dist, 'sw.js'), worker);
console.log('PWA offline cache ready:', cacheName, paths.length, 'files');

// Rede primeiro: com o PC ligado pega a versão nova; sem rede, usa a última guardada. Ao mudar arquivos, troque o número da CAIXA.
const CAIXA = 'qi-chaminha-17';
const TUDO = ['./', 'index.html', 'manifest.webmanifest', 'icone-192.png', 'icone-512.png', 'perguntas.js', 'perguntas2.js', 'perguntas3.js', 'arena.js', 'adedonha.js', 'diario.js', 'anuncios.js', 'testeqi.js', 'musica.js', 'privacidade.html'];
self.addEventListener('install', e => e.waitUntil(caches.open(CAIXA).then(k => k.addAll(TUDO)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CAIXA).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => {
    // só guarda o que é do próprio site (API, fontes e PeerJS ficam de fora)
    if (r.ok && new URL(e.request.url).origin === location.origin) { const c = r.clone(); caches.open(CAIXA).then(k => k.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === 'navigate' ? caches.match('./') : Response.error()))));
});

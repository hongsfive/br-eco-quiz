// 오프라인 저장 — 파일을 바꾸면 VERSION을 올려야 새 파일로 교체된다
const VERSION = 'v1';
const CACHE = `sound-quiz-${VERSION}`;

const FILES = [
    './',
    'index.html',
    'answer.html',
    'style.css',
    'app.js',
    'site.webmanifest',
    'favicon.svg',
    'favicon-96x96.png',
    'img/silhouette.png',
    'img/metbidulgi.jpg',
    'img/ososaek.jpg',
    'img/gorani.jpg',
    'img/baksae.jpg',
    'img/ttaksae.jpg',
    'audio/sound1.mp3',
    'audio/sound2.mp3',
    'audio/sound3.mp3',
    'audio/sound4.mp3',
    'audio/sound5.mp3',
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE)
            .then(cache => cache.addAll(FILES))
            .then(() => self.skipWaiting())
    );
});

// 예전 버전 저장분 정리
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // 글꼴(webfontworld)은 처음 받을 때 저장해 두고 이후엔 저장분 사용
    if (url.hostname === 'webfontworld.github.io') {
        event.respondWith(cacheFirst(req));
        return;
    }
    if (url.origin !== location.origin) return; // 유튜브 등 나머지 외부 링크는 그대로

    // 소리: 사파리는 Range(부분) 요청을 보내므로 저장된 파일에서 잘라서 응답
    if (req.headers.has('range')) {
        event.respondWith(rangeResponse(req));
        return;
    }

    // 페이지·코드는 인터넷이 되면 최신으로, 안 되면 저장분으로
    if (req.mode === 'navigate' || /\.(html|css|js)$/.test(url.pathname)) {
        event.respondWith(networkFirst(req));
        return;
    }

    event.respondWith(cacheFirst(req));
});

async function cacheFirst(req) {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
    }
    return res;
}

async function networkFirst(req) {
    try {
        const res = await fetch(req);
        if (res.ok) {
            const cache = await caches.open(CACHE);
            cache.put(req, res.clone());
        }
        return res;
    } catch (err) {
        const cached = await caches.match(req, { ignoreSearch: true })
            || (req.mode === 'navigate' && await caches.match('index.html'));
        if (cached) return cached;
        throw err;
    }
}

async function rangeResponse(req) {
    const cached = await caches.match(req.url, { ignoreSearch: true });
    if (!cached) return fetch(req);

    const buf = await cached.arrayBuffer();
    const size = buf.byteLength;
    const match = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
    let start = match && match[1] ? Number(match[1]) : 0;
    let end = match && match[2] ? Number(match[2]) : size - 1;
    if (match && !match[1] && match[2]) { // bytes=-500 (끝에서 500바이트)
        start = size - Number(match[2]);
        end = size - 1;
    }
    if (start >= size || start > end) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    }
    end = Math.min(end, size - 1);

    return new Response(buf.slice(start, end + 1), {
        status: 206,
        headers: {
            'Content-Type': cached.headers.get('Content-Type') || 'audio/mpeg',
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Content-Length': String(end - start + 1),
            'Accept-Ranges': 'bytes',
        },
    });
}

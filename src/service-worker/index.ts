// アプリ本体（JS/CSS/アイコン）だけをキャッシュする Service Worker。
// PDS や AnkiConnect など、ほかのオリジンへの通信には一切触れない（docs/SPEC.md「PWA」）。
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { resolve } from '$app/paths';
import { self as sw } from '$app/service-worker';

const CACHE = `ankiat-${version}`;
// SPA のシェル。adapter-static の fallback（index.html）が返る
const SHELL = resolve('/');
// インストール後の起動に不要な大きいファイルは除く
const EXCLUDE = new Set(['og.png', 'robots.txt']);
const ASSETS = [
	...immutable.map((f) => f.path),
	...assets.map((f) => f.path).filter((p) => !EXCLUDE.has(p))
].map((p) => SHELL + p.replace(/^\//, ''));
const ASSET_SET = new Set(ASSETS);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll([...ASSETS, SHELL]);
			// 待たずに有効化する。開いている画面はそのまま動き続け、次の起動・画面遷移から新しい版になる
			await sw.skipWaiting();
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return;

	// ビルド成果物と static/ のファイル: キャッシュ優先（ファイル名にハッシュが付くか、版ごとにキャッシュを作り直す）
	if (ASSET_SET.has(url.pathname)) {
		event.respondWith(
			(async () => (await caches.match(url.pathname, { cacheName: CACHE })) ?? fetch(request))()
		);
		return;
	}

	// 画面の読み込み: ネットワーク優先（常に最新の版を開く）。オフラインならキャッシュしたシェルを返す
	if (request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				try {
					return await fetch(request);
				} catch (e) {
					const shell = await caches.match(SHELL, { cacheName: CACHE });
					if (shell) return shell;
					throw e;
				}
			})()
		);
	}
	// それ以外（client-metadata.json など）はブラウザに任せる
});

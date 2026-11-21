/** デッキの OGP 画像（PNG）を生成して返す（docs/SPEC.md 3.8） */
import { fetchAvatarUrl, fetchDeckSummary } from '../../../../server/og/deck';
import { renderDeckImage } from '../../../../server/og/image';

const IMAGE_TTL = 60 * 60 * 24;

async function toDataUrl(url: string | undefined): Promise<string | undefined> {
	if (!url) return undefined;
	try {
		const res = await fetch(url);
		const type = res.headers.get('content-type') ?? '';
		if (!res.ok || !/^image\/(jpeg|png)/.test(type)) return undefined;
		const bytes = new Uint8Array(await res.arrayBuffer());
		let bin = '';
		for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
		return `data:${type.split(';')[0]};base64,${btoa(bin)}`;
	} catch {
		return undefined;
	}
}

export const onRequestGet: PagesFunction = async (ctx) => {
	const cache = caches.default;
	const hit = await cache.match(ctx.request);
	if (hit) return hit;

	const { did, rkey: file } = ctx.params as { did: string; rkey: string };
	const rkey = file.replace(/\.png$/, '');
	const deck = await fetchDeckSummary(did, rkey).catch(() => undefined);
	if (!deck) return Response.redirect(new URL('/og.png', ctx.request.url).toString(), 302);

	try {
		const url = new URL(ctx.request.url);
		const png = await renderDeckImage({
			deck,
			host: url.host,
			avatar: await toDataUrl(await fetchAvatarUrl(did))
		});
		const res = new Response(png, {
			headers: { 'content-type': 'image/png', 'cache-control': `public, max-age=${IMAGE_TTL}` }
		});
		ctx.waitUntil(cache.put(ctx.request, res.clone()));
		return res;
	} catch (e) {
		console.error('og image failed', e);
		return Response.redirect(new URL('/og.png', ctx.request.url).toString(), 302);
	}
};

/**
 * デッキの URL に、デッキごとの OGP（タイトル・説明・画像）を入れて返す（docs/SPEC.md 3.8）。
 * 本体は静的 SPA のまま。取得に失敗したら、元の HTML をそのまま返す。
 */
import { fetchDeckSummary } from '../../../server/og/deck';
import { buildMeta, type DeckSummary } from '../../../server/og/text';

const SUMMARY_TTL = 600;
const TIMEOUT_MS = 3000;

async function cachedSummary(ctx: EventContext<unknown, string, unknown>, did: string, rkey: string) {
	const cache = caches.default;
	const key = new Request(new URL(`/__cache/deck-summary/${did}/${rkey}`, ctx.request.url));
	const hit = await cache.match(key);
	if (hit) return (await hit.json()) as DeckSummary | null;
	const summary = (await fetchDeckSummary(did, rkey)) ?? null;
	ctx.waitUntil(
		cache.put(
			key,
			new Response(JSON.stringify(summary), {
				headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${SUMMARY_TTL}` }
			})
		)
	);
	return summary;
}

export const onRequestGet: PagesFunction = async (ctx) => {
	const res = await ctx.next();
	if (!res.ok || !res.headers.get('content-type')?.includes('text/html')) return res;
	const { did, rkey } = ctx.params as { did: string; rkey: string };

	let summary: DeckSummary | null = null;
	try {
		summary = await Promise.race([
			cachedSummary(ctx, did, rkey),
			new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS))
		]);
	} catch {
		summary = null;
	}
	if (!summary) return res;

	const meta = buildMeta(summary, new URL(ctx.request.url).origin);
	const setContent = (value: string) => ({
		element(e: Element) {
			e.setAttribute('content', value);
		}
	});
	const rewritten = new HTMLRewriter()
		.on('title', {
			element(e) {
				e.setInnerContent(meta.title);
			}
		})
		.on('meta[name="description"]', setContent(meta.description))
		.on('meta[property="og:title"]', setContent(meta.title))
		.on('meta[property="og:description"]', setContent(meta.description))
		.on('meta[property="og:url"]', setContent(meta.url))
		.on('meta[property="og:image"]', setContent(meta.image))
		.transform(res);
	const headers = new Headers(rewritten.headers);
	headers.set('cache-control', 'public, max-age=0, must-revalidate');
	return new Response(rewritten.body, { status: rewritten.status, headers });
};

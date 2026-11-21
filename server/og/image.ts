/** デッキの OGP 画像（1200×630）を描く（docs/SPEC.md 3.8） */
import satori from '@cf-wasm/satori/workerd';
import { Resvg } from '@cf-wasm/resvg/workerd';
import { loadSubsetFont } from './font';
import { isJapanese, stripEmoji, truncate, type DeckSummary } from './text';

const FONT = 'Noto Sans JP';
const COLORS = {
	bg: '#f5f7fb',
	text: '#141a26',
	text2: '#4a5468',
	muted: '#6b7488',
	accent: '#2453c4',
	paper: '#fffefb',
	border: '#dfe4ee'
};

const LOGO =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#2453c4"/><rect x="14" y="10" width="36" height="44" rx="6" fill="#8fb0f0" transform="rotate(-12 32 32)"/><rect x="14" y="10" width="36" height="44" rx="6" fill="#ffffff"/><g fill="none" stroke="#2453c4" stroke-width="4" stroke-linecap="round"><circle cx="32" cy="32" r="5.5"/><path d="M37.5 26.5v8a3.5 3.5 0 0 0 7 0v-2.5a12.5 12.5 0 1 0-4.9 9.9"/></g></svg>';

type Node = { type: string; props: Record<string, unknown> & { style?: Record<string, unknown>; children?: unknown } };
const el = (type: string, style: Record<string, unknown>, children?: unknown, props: Record<string, unknown> = {}): Node => ({
	type,
	props: { ...props, style, children }
});

export interface DeckImageInput {
	deck: DeckSummary;
	host: string;
	/** アバター画像の data URL */
	avatar?: string;
}

/** 描く文字列（フォントのサブセットに使う） */
export function imageTexts(deck: DeckSummary, host: string) {
	const ja = isJapanese(`${deck.name} ${deck.firstFront ?? ''}`);
	const name = truncate(stripEmoji(deck.name) || 'AnkiAt', 60);
	const front = deck.firstFront ? truncate(stripEmoji(deck.firstFront), 70) : undefined;
	const author = deck.handle ? `@${deck.handle}` : '';
	const count = ja ? `カード ${deck.cardCount} 枚` : `${deck.cardCount} cards`;
	const cta = ja ? 'ログインなしで、すぐに学習できます' : 'Study now, no sign-in needed';
	return { name, front, author, count, cta, host };
}

export function deckImageTree({ deck, host, avatar }: DeckImageInput): Node {
	const tx = imageTexts(deck, host);
	const nameSize = Array.from(tx.name).length > 24 ? 52 : 64;
	return el(
		'div',
		{
			width: 1200,
			height: 630,
			display: 'flex',
			flexDirection: 'column',
			padding: '56px 64px',
			background: COLORS.bg,
			fontFamily: FONT,
			color: COLORS.text
		},
		[
			el('div', { display: 'flex', alignItems: 'center', gap: 16 }, [
				el('img', { width: 52, height: 52 }, undefined, {
					src: `data:image/svg+xml;utf8,${encodeURIComponent(LOGO)}`,
					width: 52,
					height: 52
				}),
				el('div', { fontSize: 32, fontWeight: 700 }, 'AnkiAt')
			]),
			el('div', { display: 'flex', flex: 1, alignItems: 'center', gap: 48 }, [
				el('div', { display: 'flex', flexDirection: 'column', flex: 1, gap: 24 }, [
					el('div', { fontSize: nameSize, fontWeight: 700, lineHeight: 1.25, lineClamp: 3 }, tx.name),
					el('div', { display: 'flex', alignItems: 'center', gap: 16, fontSize: 28, color: COLORS.text2 }, [
						...(avatar
							? [el('img', { width: 48, height: 48, borderRadius: 24 }, undefined, { src: avatar, width: 48, height: 48 })]
							: []),
						...(tx.author ? [el('div', {}, tx.author)] : []),
						el('div', { color: COLORS.muted }, tx.count)
					])
				]),
				...(tx.front
					? [
							el(
								'div',
								{
									display: 'flex',
									flexDirection: 'column',
									width: 440,
									height: 300,
									padding: '28px 32px',
									borderRadius: 20,
									border: `1px solid ${COLORS.border}`,
									background: COLORS.paper,
									boxShadow: '0 12px 32px rgba(20, 30, 60, 0.12)',
									transform: 'rotate(2deg)'
								},
								[
									el('div', { width: 44, height: 5, borderRadius: 3, background: COLORS.accent }),
									el(
										'div',
										{
											display: 'flex',
											flex: 1,
											alignItems: 'center',
											justifyContent: 'center',
											textAlign: 'center',
											fontSize: 32,
											lineHeight: 1.5,
											lineClamp: 4
										},
										tx.front
									)
								]
							)
						]
					: [])
			]),
			el('div', { display: 'flex', justifyContent: 'space-between', fontSize: 24 }, [
				el('div', { color: COLORS.accent, fontWeight: 700 }, tx.cta),
				el('div', { color: COLORS.muted }, tx.host)
			])
		]
	);
}

export async function renderDeckImage(input: DeckImageInput): Promise<Uint8Array> {
	const tx = imageTexts(input.deck, input.host);
	const all = ['AnkiAt', tx.name, tx.front ?? '', tx.author, tx.count, tx.cta, tx.host, '…'].join('');
	const [regular, bold] = await Promise.all([
		loadSubsetFont(FONT, 400, all),
		loadSubsetFont(FONT, 700, all)
	]);
	const svg = await satori(deckImageTree(input) as never, {
		width: 1200,
		height: 630,
		fonts: [
			{ name: FONT, data: regular, weight: 400, style: 'normal' },
			{ name: FONT, data: bold, weight: 700, style: 'normal' }
		]
	});
	const resvg = await Resvg.async(svg, { fitTo: { mode: 'width', value: 1200 } });
	return resvg.render().asPng();
}

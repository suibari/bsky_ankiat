/**
 * 共有画像「今日の学習」（1200×630）をブラウザ内で描く。
 * タイムラインで見え方が揃うよう、テーマに関係なくライトの配色で描く。
 */

export interface ShareCardData {
	dateLabel: string;
	reviewedToday: number;
	unitLabel: string;
	streakLabel?: string;
	decks: { name: string; count: number }[];
	decksTitle: string;
	displayName: string;
	handle: string;
	avatar?: ImageBitmap;
	logo?: HTMLImageElement;
}

export const SHARE_WIDTH = 1200;
export const SHARE_HEIGHT = 630;

const C = {
	bg: '#eef2f8',
	paper: '#fffefb',
	text: '#111827',
	text2: '#4b5565',
	muted: '#6b7487',
	rule: '#e3e8f0',
	accent: '#2453c4',
	warn: '#b25d0a'
};
const FONT = `system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', 'Noto Sans CJK JP', sans-serif`;
const FLAME = new Path2D('M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4');

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.roundRect(x, y, w, h, r);
}

/** 幅に収まらない文字列を「…」で切る */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
	if (ctx.measureText(text).width <= maxWidth) return text;
	let s = text;
	while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
	return `${s}…`;
}

export function drawShareCard(ctx: CanvasRenderingContext2D, d: ShareCardData) {
	const W = SHARE_WIDTH;
	const H = SHARE_HEIGHT;
	ctx.fillStyle = C.bg;
	ctx.fillRect(0, 0, W, H);

	// インデックスカード（紙の面・柔らかい影・左上の青い見出し罫）
	const card = { x: 64, y: 56, w: W - 128, h: H - 112 };
	ctx.save();
	ctx.shadowColor = 'rgba(17, 24, 39, 0.10)';
	ctx.shadowBlur = 32;
	ctx.shadowOffsetY = 8;
	ctx.fillStyle = C.paper;
	roundRect(ctx, card.x, card.y, card.w, card.h, 20);
	ctx.fill();
	ctx.restore();
	ctx.fillStyle = C.accent;
	roundRect(ctx, card.x + 40, card.y + 28, 44, 6, 3);
	ctx.fill();

	const left = card.x + 40;
	ctx.textBaseline = 'alphabetic';

	// 日付
	ctx.fillStyle = C.muted;
	ctx.font = `400 26px ${FONT}`;
	ctx.fillText(d.dateLabel, left, card.y + 88);

	// 今日の回答数（主役）
	ctx.fillStyle = C.text;
	ctx.font = `500 156px ${FONT}`;
	const num = String(d.reviewedToday);
	ctx.fillText(num, left - 6, card.y + 250);
	const numW = ctx.measureText(num).width;
	ctx.font = `400 36px ${FONT}`;
	ctx.fillStyle = C.text2;
	ctx.fillText(d.unitLabel, left + numW + 16, card.y + 250);

	// 連続日数
	if (d.streakLabel) {
		ctx.save();
		ctx.translate(left, card.y + 290);
		ctx.scale(1.5, 1.5);
		ctx.strokeStyle = C.warn;
		ctx.lineWidth = 2;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.stroke(FLAME);
		ctx.restore();
		ctx.fillStyle = C.text;
		ctx.font = `500 32px ${FONT}`;
		ctx.fillText(d.streakLabel, left + 48, card.y + 320);
	}

	// 今日学習したデッキ（右側）
	const colX = card.x + card.w * 0.58;
	const colW = card.x + card.w - 40 - colX;
	if (d.decks.length > 0) {
		ctx.fillStyle = C.muted;
		ctx.font = `400 22px ${FONT}`;
		ctx.fillText(d.decksTitle, colX, card.y + 88);
		d.decks.slice(0, 3).forEach((deck, i) => {
			const y = card.y + 148 + i * 64;
			ctx.strokeStyle = C.rule;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(colX, y + 22);
			ctx.lineTo(colX + colW, y + 22);
			ctx.stroke();
			ctx.font = `500 26px ${FONT}`;
			const count = String(deck.count);
			const countW = ctx.measureText(count).width;
			ctx.fillStyle = C.text;
			ctx.fillText(fit(ctx, deck.name, colW - countW - 24), colX, y);
			ctx.fillStyle = C.text2;
			ctx.textAlign = 'right';
			ctx.fillText(count, colX + colW, y);
			ctx.textAlign = 'left';
		});
	}

	// 下段: ユーザー（左）と AnkiAt（右）
	const baseY = card.y + card.h - 48;
	const r = 26;
	ctx.save();
	ctx.beginPath();
	ctx.arc(left + r, baseY - 10, r, 0, Math.PI * 2);
	ctx.clip();
	if (d.avatar) {
		ctx.drawImage(d.avatar, left, baseY - 10 - r, r * 2, r * 2);
	} else {
		ctx.fillStyle = C.rule;
		ctx.fillRect(left, baseY - 10 - r, r * 2, r * 2);
	}
	ctx.restore();
	ctx.fillStyle = C.text;
	ctx.font = `500 24px ${FONT}`;
	ctx.fillText(fit(ctx, d.displayName, 420), left + r * 2 + 16, baseY - 14);
	ctx.fillStyle = C.muted;
	ctx.font = `400 20px ${FONT}`;
	ctx.fillText(fit(ctx, `@${d.handle}`, 420), left + r * 2 + 16, baseY + 14);

	const right = card.x + card.w - 40;
	ctx.textAlign = 'right';
	ctx.fillStyle = C.text;
	ctx.font = `600 26px ${FONT}`;
	ctx.fillText('AnkiAt', right, baseY - 4);
	const brandW = ctx.measureText('AnkiAt').width;
	ctx.fillStyle = C.muted;
	ctx.font = `400 18px ${FONT}`;
	ctx.fillText('ankiat.suibari.com', right, baseY + 22);
	ctx.textAlign = 'left';
	if (d.logo) ctx.drawImage(d.logo, right - brandW - 52, baseY - 34, 40, 40);
}

export async function renderShareImage(d: ShareCardData): Promise<Blob> {
	const canvas = document.createElement('canvas');
	canvas.width = SHARE_WIDTH;
	canvas.height = SHARE_HEIGHT;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('canvas is not supported');
	await document.fonts?.ready;
	drawShareCard(ctx, d);
	return new Promise((resolve, reject) =>
		canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('failed to export image'))), 'image/png')
	);
}

export function loadLogo(): Promise<HTMLImageElement | undefined> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => resolve(undefined);
		img.src = '/favicon.svg';
	});
}

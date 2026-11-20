/** Anki のデータを AnkiAt のレコードに変換する（docs/SPEC.md 3.6） */
import type { Card, Rating, ReviewEntry } from '../atproto/records';
import type { AnkiCardInfo, RevlogRow } from './client';

export const ankiCardId = (cardId: number): string => `a${cardId}`;

export function parseAnkiCardId(id: string): number | undefined {
	const m = /^a(\d+)$/.exec(id);
	return m ? Number(m[1]) : undefined;
}

/** CSS は表示に使わないため、保存前に <style> を取り除いて容量を節約する */
export function stripStyles(html: string): string {
	return html.replace(/<style\b[\s\S]*?<\/style>/gi, '').trim();
}

export function toCard(info: AnkiCardInfo, noteMod: number): Card {
	return {
		id: ankiCardId(info.cardId),
		front: stripStyles(info.question),
		back: stripStyles(info.answer),
		anki: { cardId: info.cardId, noteId: info.note, mod: info.mod, noteMod }
	};
}

/** Anki 検索クエリ用にデッキ名をエスケープする */
export function escapeDeckName(name: string): string {
	return name.replace(/[\\"*_]/g, (c) => `\\${c}`);
}

/** サブデッキを含めず、そのデッキが直接持つカードだけを探すクエリ */
export function directDeckQuery(name: string): string {
	const n = escapeDeckName(name);
	return `"deck:${n}" -"deck:${n}::*"`;
}

/**
 * 復習ログの行を ReviewEntry に変換する。
 * ease 1〜4 以外（手動での期日変更・リセット）と、type 4 以上（Manual / Rescheduled）は除外する。
 */
export function revlogToEntry(row: RevlogRow): ReviewEntry | undefined {
	const [id, cid, , ease, , , , time, type] = row;
	if (ease < 1 || ease > 4 || type >= 4) return undefined;
	return {
		cardId: ankiCardId(cid),
		rating: ease as Rating,
		reviewedAt: new Date(id).toISOString(),
		durationMs: Math.max(0, time),
		ankiRevlogId: id
	};
}

export interface ContentDiff {
	upserts: string[];
	deletes: string[];
}

/**
 * Anki の現在のカード（cardId → card mod / note mod）と PDS のカードを比べ、
 * 取り直しが必要なカードと削除するカードを求める。ノートの編集はカードの mod に出ないので両方見る。
 */
export function diffContent(
	current: Map<number, { mod: number; noteMod: number }>,
	stored: Card[]
): ContentDiff {
	const storedById = new Map<number, Card>();
	for (const c of stored) if (c.anki) storedById.set(c.anki.cardId, c);
	const upserts: string[] = [];
	for (const [cardId, m] of current) {
		const s = storedById.get(cardId)?.anki;
		if (!s || s.mod !== m.mod || s.noteMod !== m.noteMod) upserts.push(ankiCardId(cardId));
	}
	const deletes = stored.filter((c) => c.anki && !current.has(c.anki.cardId)).map((c) => c.id);
	return { upserts, deletes };
}

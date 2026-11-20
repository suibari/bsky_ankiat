/**
 * カードをチャンクに振り分ける（docs/SPEC.md 4.2）
 * - 新しいカードは末尾のチャンクに追加し、目安サイズを超えたら新しいチャンクを作る
 * - 削除しても他のチャンクへ詰め直さない。空になったチャンクも残す
 * - 更新で目安サイズを超えたチャンクは、そのカードを末尾へ移す
 */
import type { Card } from '../atproto/records';
import { jsonBytes } from '../atproto/writes';

export const CHUNK_TARGET_BYTES = 100_000;

export interface CardChanges {
	upserts?: Card[];
	deletes?: string[];
}

export interface ChunkPlan {
	/** 変更後の全チャンク（index 順） */
	chunks: Card[][];
	/** 書き込みが必要なチャンクの index（既存の更新・新規作成の両方） */
	changed: number[];
	cardCount: number;
}

export function applyCardChanges(
	existing: Card[][],
	changes: CardChanges,
	target = CHUNK_TARGET_BYTES
): ChunkPlan {
	const chunks = existing.map((c) => [...c]);
	const changed = new Set<number>();
	const location = new Map<string, number>();
	chunks.forEach((cards, i) => cards.forEach((c) => location.set(c.id, i)));

	for (const id of changes.deletes ?? []) {
		const i = location.get(id);
		if (i === undefined) continue;
		chunks[i] = chunks[i].filter((c) => c.id !== id);
		location.delete(id);
		changed.add(i);
	}

	const pending: Card[] = [];
	for (const card of changes.upserts ?? []) {
		const i = location.get(card.id);
		if (i === undefined) {
			pending.push(card);
			continue;
		}
		const pos = chunks[i].findIndex((c) => c.id === card.id);
		chunks[i][pos] = card;
		changed.add(i);
		if (chunks[i].length > 1 && jsonBytes(chunks[i]) > target) {
			chunks[i].splice(pos, 1);
			location.delete(card.id);
			pending.push(card);
		}
	}

	if (pending.length > 0) {
		if (chunks.length === 0) chunks.push([]);
		let last = chunks.length - 1;
		let size = jsonBytes(chunks[last]);
		for (const card of pending) {
			const bytes = jsonBytes(card) + 1;
			if (chunks[last].length > 0 && size + bytes > target) {
				chunks.push([]);
				last = chunks.length - 1;
				size = jsonBytes(chunks[last]);
			}
			chunks[last].push(card);
			location.set(card.id, last);
			size += bytes;
			changed.add(last);
		}
	}

	return {
		chunks,
		changed: [...changed].sort((a, b) => a - b),
		cardCount: chunks.reduce((n, c) => n + c.length, 0)
	};
}

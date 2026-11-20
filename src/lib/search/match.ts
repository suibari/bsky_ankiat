/** デッキ検索のマッチング（クライアント側、docs/SPEC.md 3.3） */
import type { DeckRecord } from '../atproto/records';

export interface IndexedDeck {
	did: string;
	handle?: string;
	rkey: string;
	record: DeckRecord;
	/** 学習リストに追加している人数（作者を除く） */
	learners?: number;
}

function normalize(s: string): string {
	return s.normalize('NFKC').toLowerCase();
}

/**
 * 空白区切りの各語がすべて、名前・説明・タグ・作者ハンドルのいずれかに含まれるデッキを返す。
 * listed: false のデッキは除外する。並びは学習中の人数の多い順、同数なら更新日時の新しい順。
 */
export function searchDecks(decks: IndexedDeck[], query: string): IndexedDeck[] {
	const terms = normalize(query).split(/\s+/).filter(Boolean);
	return decks
		.filter((d) => d.record.listed !== false)
		.filter((d) => {
			if (terms.length === 0) return true;
			const haystack = normalize(
				[d.record.name, d.record.description ?? '', ...(d.record.tags ?? []), d.handle ?? ''].join('\n')
			);
			return terms.every((t) => haystack.includes(t));
		})
		.sort(
			(a, b) =>
				(b.learners ?? 0) - (a.learners ?? 0) || b.record.updatedAt.localeCompare(a.record.updatedAt)
		);
}

/** プロフィールページ用: 任意のユーザーの公開データ（回答履歴・デッキ）を読む */
import { NSID } from '../atproto/lexicons';
import { getRecord, listAllRecords } from '../atproto/publicRepo';
import { parseAtUri, type DeckRecord, type ReviewEntry, type ReviewLogRecord } from '../atproto/records';
import { listDecks, type DeckRef } from '../decks/service';
import { computeProfileStats, type ProfileStats } from './stats';

export interface StudiedDeck {
	uri: string;
	did: string;
	rkey: string;
	name?: string;
	reviews: number;
}

export interface ProfileData {
	stats: ProfileStats;
	ownDecks: DeckRef[];
	studiedDecks: StudiedDeck[];
}

const TOP_DECKS = 5;

export async function loadProfileData(did: string): Promise<ProfileData> {
	const [logs, ownDecks] = await Promise.all([
		listAllRecords<ReviewLogRecord>(did, NSID.reviewLog),
		listDecks(did).then((d) => d.filter((x) => x.record.listed !== false))
	]);
	const byDeck = new Map<string, ReviewEntry[]>();
	for (const l of logs) {
		const list = byDeck.get(l.value.deck) ?? [];
		list.push(...l.value.entries);
		byDeck.set(l.value.deck, list);
	}
	const stats = computeProfileStats(byDeck);
	const studiedDecks = await Promise.all(
		stats.decks.slice(0, TOP_DECKS).map(async ({ uri, reviews }) => {
			const { did: owner, rkey } = parseAtUri(uri);
			const own = ownDecks.find((d) => d.uri === uri);
			const record =
				own?.record ??
				(await getRecord<DeckRecord>(owner, NSID.deck, rkey).catch(() => undefined))?.value;
			// 非公開（検索に出さない）デッキの名前は表示しない
			const name = record && record.listed !== false ? record.name : undefined;
			return { uri, did: owner, rkey, name, reviews };
		})
	);
	return { stats, ownDecks, studiedDecks };
}

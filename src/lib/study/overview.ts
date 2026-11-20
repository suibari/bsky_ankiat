/** ホーム画面用: 自分のデッキ + ホームに追加した他人のデッキと、今日の件数 */
import type { Agent } from '@atproto/api';
import { parseAtUri } from '../atproto/records';
import { listDecks, loadDeck, type LoadedDeck } from '../decks/service';
import {
	DEFAULT_NEW_CARDS_PER_DAY,
	getPreferences,
	listSubscriptions,
	loadAnkiOverrides,
	loadReviewEntries,
	type Subscription
} from './data';
import { buildQueue } from './queue';
import { getScheduler, replay } from './scheduler';
import { computeStreak, type Streak } from './streak';

export interface DeckOverview {
	uri: string;
	did: string;
	rkey: string;
	own: boolean;
	/** 他人のデッキのとき、ホームに追加した記録 */
	subscription?: Subscription;
	/** null ならデッキが削除されている */
	deck: LoadedDeck | null;
	dueCount: number;
	newCount: number;
}

export interface Overview {
	decks: DeckOverview[];
	streak: Streak;
}

export async function loadOverview(agent: Agent, did: string): Promise<Overview> {
	const [own, subs, entries, prefs, scheduler] = await Promise.all([
		listDecks(did),
		listSubscriptions(did),
		loadReviewEntries(agent, did),
		getPreferences(did),
		getScheduler()
	]);
	const newLimit = prefs.newCardsPerDay ?? DEFAULT_NEW_CARDS_PER_DAY;
	const now = new Date();
	const ownUris = new Set(own.map((d) => d.uri));
	const targets = [
		...own.map((d) => ({ uri: d.uri, own: true, subscription: undefined as Subscription | undefined })),
		...subs
			.filter((s, i) => !ownUris.has(s.deck) && subs.findIndex((x) => x.deck === s.deck) === i)
			.map((s) => ({ uri: s.deck, own: false, subscription: s }))
	];
	const streak = computeStreak([...entries.values()].flat().map((e) => e.reviewedAt), now);
	const decks = await Promise.all(
		targets.map(async (t) => {
			const { did: owner, rkey } = parseAtUri(t.uri);
			const base = { ...t, did: owner, rkey };
			const deck = (await loadDeck(owner, rkey).catch(() => undefined)) ?? null;
			if (!deck) return { ...base, deck, dueCount: 0, newCount: 0 };
			const deckEntries = entries.get(t.uri) ?? [];
			const overrides = await loadAnkiOverrides(did, deck, deckEntries);
			const q = buildQueue(
				deck.chunks.flat(),
				replay(scheduler, deckEntries),
				deckEntries,
				now,
				newLimit,
				overrides
			);
			return { ...base, deck, dueCount: q.due.length, newCount: q.newCards.length };
		})
	);
	return { decks, streak };
}

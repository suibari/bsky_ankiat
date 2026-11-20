/** ホーム画面用: 学習中のデッキと今日の件数 */
import type { Agent } from '@atproto/api';
import { parseAtUri } from '../atproto/records';
import { loadDeck, type LoadedDeck } from '../decks/service';
import {
	DEFAULT_NEW_CARDS_PER_DAY,
	getPreferences,
	listSubscriptions,
	loadReviewEntries,
	type Subscription
} from './data';
import { buildQueue } from './queue';
import { getScheduler, replay } from './scheduler';

export interface DeckOverview {
	subscription: Subscription;
	/** null ならデッキが削除されている */
	deck: LoadedDeck | null;
	dueCount: number;
	newCount: number;
}

export async function loadOverview(agent: Agent, did: string): Promise<DeckOverview[]> {
	const [subs, entries, prefs, scheduler] = await Promise.all([
		listSubscriptions(did),
		loadReviewEntries(agent, did),
		getPreferences(did),
		getScheduler()
	]);
	const newLimit = prefs.newCardsPerDay ?? DEFAULT_NEW_CARDS_PER_DAY;
	const now = new Date();
	return Promise.all(
		subs.map(async (subscription) => {
			const { did: owner, rkey } = parseAtUri(subscription.deck);
			const deck = (await loadDeck(owner, rkey).catch(() => undefined)) ?? null;
			if (!deck) return { subscription, deck, dueCount: 0, newCount: 0 };
			const deckEntries = entries.get(subscription.deck) ?? [];
			const q = buildQueue(deck.chunks.flat(), replay(scheduler, deckEntries), deckEntries, now, newLimit);
			return { subscription, deck, dueCount: q.due.length, newCount: q.newCards.length };
		})
	);
}

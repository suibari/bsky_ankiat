/** お試しの回答をログイン後に PDS へ引き継ぐ（docs/SPEC.md 3.7） */
import type { Agent } from '@atproto/api';
import { parseAtUri } from '../atproto/records';
import { adjustCachedLearners } from '../search/index';
import { getOutbox, getPreferences, listSubscriptions, savePreferences, subscribe } from '../study/data';
import { learning } from '../study/learning.svelte';
import { guestReviews, type GuestEntry } from './store';

/** 学習リストに追加するデッキ: 他人のデッキで、まだ追加していないもの（重複なし） */
export function decksToSubscribe(items: GuestEntry[], myDid: string, subscribed: string[]): string[] {
	const out: string[] = [];
	for (const { deck } of items) {
		if (out.includes(deck) || subscribed.includes(deck)) continue;
		try {
			if (parseAtUri(deck).did === myDid) continue;
		} catch {
			continue;
		}
		out.push(deck);
	}
	return out;
}

/** ホームなどが引き継ぎの完了を検知して読み直すための版数 */
export const guestImport = $state({ version: 0 });

export async function importGuestReviews(agent: Agent, did: string): Promise<number> {
	const items = await guestReviews.all();
	if (items.length === 0) return 0;

	const prefs = await getPreferences(did);
	if (!prefs.publicHistoryConsentAt) {
		await savePreferences(agent, did, { publicHistoryConsentAt: new Date().toISOString() });
	}

	// 先に端末のアウトボックスへ移してから消す。PDS への書き込みはアウトボックスが再送も含めて担う
	const outbox = getOutbox(agent, did);
	await outbox.addMany(items);
	await guestReviews.clear();

	const subs = await listSubscriptions(did);
	for (const deck of decksToSubscribe(items, did, subs.map((s) => s.deck))) {
		await subscribe(agent, did, deck);
		if (learning.uris) learning.uris = [...learning.uris, deck];
		void adjustCachedLearners(deck, 1);
	}

	await outbox.flush().catch(() => {});
	guestImport.version++;
	return items.length;
}

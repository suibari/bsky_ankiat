import type { Agent } from '@atproto/api';
import { unlinkDeck } from '../anki/sync';
import { deleteDeck, type DeckRef } from './service';

/** デッキを削除する。Anki 連携デッキなら同期状態（ankiSync）も消す */
export async function removeDeck(agent: Agent, did: string, deck: DeckRef): Promise<void> {
	if (deck.record.source?.type === 'anki') await unlinkDeck(agent, did, deck, false);
	else await deleteDeck(agent, deck);
}

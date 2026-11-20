<script lang="ts">
	import { goto } from '$app/navigation';
	import { currentUser } from '#lib/atproto/auth.svelte.js';
	import DeckForm from '#lib/components/DeckForm.svelte';
	import { createDeck, type DeckMeta } from '#lib/decks/service.js';
	import { t } from '#lib/i18n/index.svelte.js';
	import { subscribe } from '#lib/study/data.js';

	async function onsubmit(meta: DeckMeta) {
		const { agent, did } = currentUser();
		const deck = await createDeck(agent, did, meta);
		// 自分で作ったデッキは学習対象に追加する
		await subscribe(agent, did, deck.uri);
		await goto(`/deck/${deck.did}/${deck.rkey}`);
	}
</script>

<h1>{t('deck.new')}</h1>
<DeckForm
	submitLabel={t('deck.create')}
	submittingLabel={t('deck.creating')}
	{onsubmit}
	oncancel={() => history.back()}
/>

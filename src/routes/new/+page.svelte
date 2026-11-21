<script lang="ts">
	import { goto } from '$app/navigation';
	import { currentUser } from '#lib/atproto/auth.svelte.js';
	import BulkCardInput from '#lib/components/BulkCardInput.svelte';
	import DeckForm from '#lib/components/DeckForm.svelte';
	import type { BulkCard } from '#lib/decks/bulk.js';
	import { createDeck, newCardId, type DeckMeta } from '#lib/decks/service.js';
	import { textToHtml } from '#lib/decks/text.js';
	import { t } from '#lib/i18n/index.svelte.js';

	let cards = $state<BulkCard[]>([]);

	async function onsubmit(meta: DeckMeta) {
		const { agent, did } = currentUser();
		const deck = await createDeck(
			agent,
			did,
			meta,
			cards.map((c) => ({ id: newCardId(), front: textToHtml(c.front), back: textToHtml(c.back) }))
		);
		await goto(`/deck/${deck.did}/${deck.rkey}`);
	}
</script>

<h1>{t('deck.new')}</h1>
<DeckForm
	submitLabel={cards.length > 0 ? t('deck.createWithCards', { count: String(cards.length) }) : t('deck.create')}
	submittingLabel={t('deck.creating')}
	{onsubmit}
	oncancel={() => history.back()}
>
	<details class="bulk">
		<summary>{t('bulk.optional')}</summary>
		<BulkCardInput bind:cards />
	</details>
</DeckForm>

<style>
	.bulk {
		margin: 8px 0;
		padding: 12px 16px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	summary {
		cursor: pointer;
		font-weight: 500;
	}
	.bulk[open] summary {
		margin-bottom: 12px;
	}
</style>

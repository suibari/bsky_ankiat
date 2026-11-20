<script lang="ts">
	import { currentUser } from '#lib/atproto/auth.svelte.js';
	import { listDecks } from '#lib/decks/service.js';
	import { t } from '#lib/i18n/index.svelte.js';

	const { did } = currentUser();
	const decks = listDecks(did);
</script>

<div class="head">
	<h1>{t('nav.myDecks')}</h1>
	<a class="btn" href="/decks/new">{t('deck.new')}</a>
</div>

{#await decks}
	<p class="muted">{t('common.loading')}</p>
{:then list}
	{#if list.length === 0}
		<p class="muted">{t('deck.noDecks')}</p>
	{:else}
		<ul>
			{#each list as deck (deck.uri)}
				<li class="panel">
					<a href="/deck/{deck.did}/{deck.rkey}">{deck.record.name}</a>
					<span class="muted">{t('deck.cards', { count: String(deck.record.cardCount) })}</span>
					{#if deck.record.listed === false}<span class="tag">{t('deck.unlisted')}</span>{/if}
				</li>
			{/each}
		</ul>
	{/if}
{:catch e}
	<p class="error">{t('deck.loadError')}: {e.message}</p>
{/await}

<style>
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}
	ul {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.75rem;
		align-items: baseline;
	}
	li a {
		font-weight: 600;
	}
</style>

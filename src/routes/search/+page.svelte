<script lang="ts">
	import { formatDate } from '#lib/i18n/format.js';
	import { i18n, t } from '#lib/i18n/index.svelte.js';
	import { getIndex, type DeckIndex } from '#lib/search/index.js';
	import { searchDecks } from '#lib/search/match.js';

	let index = $state<DeckIndex>();
	let loading = $state(false);
	let error = $state<string>();
	let query = $state('');

	const results = $derived(index ? searchDecks(index.decks, query) : []);

	async function load(force = false) {
		loading = true;
		error = undefined;
		try {
			index = await getIndex(force);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}
	load();
</script>

<h1>{t('nav.search')}</h1>

<input
	class="field"
	type="search"
	bind:value={query}
	placeholder={t('search.placeholder')}
	aria-label={t('search.placeholder')}
/>

<div class="meta muted">
	{#if index}
		<span>{t('search.updatedAt', { date: formatDate(index.fetchedAt, i18n.locale) })}</span>
		<span>{t('search.results', { count: String(results.length) })}</span>
		{#if index.failed > 0}<span>{t('search.failed', { count: String(index.failed) })}</span>{/if}
	{/if}
	<button class="link" disabled={loading} onclick={() => load(true)}>{t('search.refresh')}</button>
</div>

{#if error}
	<p class="error">{t('deck.loadError')}: {error}</p>
{:else if loading && !index}
	<p class="muted">{t('search.building')}</p>
{:else if index && results.length === 0}
	<p class="muted">{t('search.noResults')}</p>
{:else}
	<ul>
		{#each results as d (d.did + d.rkey)}
			<li class="panel">
				<a class="name" href="/deck/{d.did}/{d.rkey}">{d.record.name}</a>
				<span class="muted small">
					{t('deck.byAuthor', { author: d.handle ?? d.did })} ・ {t('deck.cards', {
						count: String(d.record.cardCount)
					})}
				</span>
				{#if d.record.description}<p class="description">{d.record.description}</p>{/if}
				{#if d.record.tags?.length}
					<p class="tags">{#each d.record.tags as tag (tag)}<span class="tag">{tag}</span>{/each}</p>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1rem;
		font-size: 0.875rem;
		margin: 0.5rem 0 1rem;
	}
	.link {
		border: none;
		background: none;
		padding: 0;
		color: var(--accent);
		cursor: pointer;
	}
	ul {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}
	li {
		display: grid;
		gap: 0.25rem;
	}
	.name {
		font-weight: 600;
	}
	.small {
		font-size: 0.875rem;
	}
	.description {
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		white-space: pre-wrap;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin: 0;
	}
</style>

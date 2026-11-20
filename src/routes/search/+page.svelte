<script lang="ts">
	import { formatDate } from '#lib/i18n/format.js';
	import { i18n, t } from '#lib/i18n/index.svelte.js';
	import UserChip from '#lib/components/UserChip.svelte';
	import LearnButton from '#lib/components/LearnButton.svelte';
	import { currentUser } from '#lib/atproto/auth.svelte.js';
	import { NSID } from '#lib/atproto/lexicons.js';

	const me = currentUser();
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

<div class="page-head"><h1>{t('nav.search')}</h1></div>

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
				<div class="title-row">
					<a class="name" href="/deck/{d.did}/{d.rkey}">{d.record.name}</a>
					{#if d.did === me.did}
						<span class="muted small num">{t('learn.count', { count: String(d.learners ?? 0) })}</span>
					{:else}
						<LearnButton uri="at://{d.did}/{NSID.deck}/{d.rkey}" bind:count={d.learners} size="small" />
					{/if}
				</div>
				<span class="deck-meta muted small">
					<UserChip did={d.did} handle={d.handle} size={20} />
					<span>{t('deck.cards', { count: String(d.record.cardCount) })}</span>
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
	.title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.title-row .name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.deck-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 16px;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		font-size: 0.875rem;
		margin: 8px 0 16px;
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
		gap: 8px;
	}
	li {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.name {
		color: var(--text);
		font-weight: 500;
		text-decoration: none;
	}
	.name:hover {
		color: var(--accent-ink);
		text-decoration: underline;
	}
	.small {
		font-size: 0.875rem;
	}
	.description {
		margin: 0;
		color: var(--text-2);
		font-size: 0.875rem;
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

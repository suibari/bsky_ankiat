<script lang="ts">
	import { currentUser } from '#lib/atproto/auth.svelte.js';
	import { unsubscribe } from '#lib/study/data.js';
	import { loadOverview, type DeckOverview } from '#lib/study/overview.js';
	import { t } from '#lib/i18n/index.svelte.js';
	import { parseAtUri } from '#lib/atproto/records.js';

	const me = currentUser();
	let overview = $state<DeckOverview[]>();
	let error = $state<string>();

	function load() {
		loadOverview(me.agent, me.did)
			.then((o) => (overview = o))
			.catch((e) => (error = e.message));
	}
	load();

	async function remove(o: DeckOverview) {
		await unsubscribe(me.agent, me.did, o.subscription.deck);
		overview = overview?.filter((x) => x !== o);
	}
</script>

<h1>{t('home.welcome', { handle: me.handle })}</h1>

{#if error}
	<p class="error">{t('deck.loadError')}: {error}</p>
{:else if !overview}
	<p class="muted">{t('common.loading')}</p>
{:else if overview.length === 0}
	<p class="muted">{t('home.empty')}</p>
	<p><a href="/decks">{t('home.findDecks')}</a></p>
{:else}
	<ul>
		{#each overview as o (o.subscription.rkey)}
			{@const ref = parseAtUri(o.subscription.deck)}
			<li class="panel">
				{#if o.deck}
					<div class="info">
						<a href="/deck/{ref.did}/{ref.rkey}" class="name">{o.deck.record.name}</a>
						<span class="counts">
							<span class="new">{t('study.new', { count: String(o.newCount) })}</span>
							<span class="due">{t('study.due', { count: String(o.dueCount) })}</span>
						</span>
					</div>
					{#if o.newCount + o.dueCount > 0}
						<a class="btn" href="/study/{ref.did}/{ref.rkey}">{t('study.start')}</a>
					{:else}
						<span class="muted small">{t('study.nothingDue')}</span>
					{/if}
				{:else}
					<span class="muted">{t('study.deckDeleted')}</span>
					<button class="btn secondary" onclick={() => remove(o)}>{t('study.remove')}</button>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	ul {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		align-items: center;
		justify-content: space-between;
	}
	.info {
		display: grid;
	}
	.name {
		font-weight: 600;
	}
	.counts {
		display: flex;
		gap: 0.75rem;
		font-size: 0.875rem;
	}
	.new {
		color: #2a6fdb;
	}
	.due {
		color: var(--accent);
	}
	.small {
		font-size: 0.875rem;
	}
</style>

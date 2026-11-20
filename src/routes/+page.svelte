<script lang="ts">
	import { currentUser } from '#lib/atproto/auth.svelte.js';
	import ConfirmButton from '#lib/components/ConfirmButton.svelte';
	import { removeDeck } from '#lib/decks/remove.js';
	import { t } from '#lib/i18n/index.svelte.js';
	import { unsubscribe } from '#lib/study/data.js';
	import { loadOverview, type DeckOverview } from '#lib/study/overview.js';

	const me = currentUser();
	let overview = $state<DeckOverview[]>();
	let error = $state<string>();
	let busy = $state<string>();

	loadOverview(me.agent, me.did)
		.then((o) => (overview = o))
		.catch((e) => (error = e.message));

	async function act(o: DeckOverview, action: () => Promise<void>) {
		busy = o.uri;
		error = undefined;
		try {
			await action();
			overview = overview?.filter((x) => x !== o);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = undefined;
		}
	}

	const remove = (o: DeckOverview) => act(o, () => removeDeck(me.agent, me.did, o.deck!));
	const hide = (o: DeckOverview) => act(o, () => unsubscribe(me.agent, me.did, o.uri));
</script>

<div class="head">
	<h1>{t('home.welcome', { handle: me.handle })}</h1>
	<a class="btn" href="/new">{t('deck.new')}</a>
</div>

{#if error}<p class="error" role="alert">{t('deck.saveError')}: {error}</p>{/if}

{#if !overview}
	{#if !error}<p class="muted">{t('common.loading')}</p>{/if}
{:else if overview.length === 0}
	<p class="muted">{t('home.empty')}</p>
	<p><a href="/search">{t('home.findDecks')}</a></p>
{:else}
	<ul>
		{#each overview as o (o.uri)}
			<li class="panel">
				<div class="main">
					{#if o.deck}
						<div class="info">
							<a href="/deck/{o.did}/{o.rkey}" class="name">{o.deck.record.name}</a>
							<span class="counts">
								<span class="new">{t('study.new', { count: String(o.newCount) })}</span>
								<span class="due">{t('study.due', { count: String(o.dueCount) })}</span>
							</span>
						</div>
						{#if o.newCount + o.dueCount > 0}
							<a class="btn" href="/study/{o.did}/{o.rkey}">{t('study.start')}</a>
						{:else}
							<span class="muted small">{t('study.nothingDue')}</span>
						{/if}
					{:else}
						<span class="muted">{t('study.deckDeleted')}</span>
					{/if}
				</div>
				<div class="actions">
					{#if o.own && o.deck}
						<ConfirmButton
							label={t('deck.delete')}
							message={t('deck.deleteConfirm')}
							disabled={busy === o.uri}
							onconfirm={() => remove(o)}
						/>
					{:else}
						<button class="btn secondary small" disabled={busy === o.uri} onclick={() => hide(o)}>
							{t('study.remove')}
						</button>
					{/if}
				</div>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem 1rem;
	}
	ul {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}
	li {
		display: grid;
		gap: 0.5rem;
	}
	.main {
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
	.actions {
		display: flex;
		justify-content: flex-end;
		font-size: 0.875rem;
	}
</style>

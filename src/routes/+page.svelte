<script lang="ts">
	import { ArrowRight, Check, Plus } from '@lucide/svelte';
	import { currentUser } from '#lib/atproto/auth.svelte.js';
	import RowMenu from '#lib/components/RowMenu.svelte';
	import StreakCard from '#lib/components/StreakCard.svelte';
	import UserChip from '#lib/components/UserChip.svelte';
	import { removeDeck } from '#lib/decks/remove.js';
	import { i18n, t } from '#lib/i18n/index.svelte.js';
	import { unsubscribe } from '#lib/study/data.js';
	import { loadOverview, type DeckOverview } from '#lib/study/overview.js';
	import type { Streak } from '#lib/study/streak.js';

	const me = currentUser();
	let overview = $state<DeckOverview[]>();
	let streak = $state<Streak>();
	let error = $state<string>();

	const today = $derived(
		new Intl.DateTimeFormat(i18n.locale, { month: 'long', day: 'numeric', weekday: 'short' }).format(
			new Date()
		)
	);

	loadOverview(me.agent, me.did)
		.then((o) => {
			overview = o.decks;
			streak = o.streak;
		})
		.catch((e) => (error = e.message));

	async function act(o: DeckOverview, action: () => Promise<void>) {
		error = undefined;
		try {
			await action();
			overview = overview?.filter((x) => x !== o);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	const menuFor = (o: DeckOverview) =>
		o.own && o.deck
			? [
					{
						label: t('deck.delete'),
						danger: true,
						confirmLabel: t('deck.deleteConfirmShort'),
						onselect: () => act(o, () => removeDeck(me.agent, me.did, o.deck!))
					}
				]
			: [{ label: t('study.remove'), onselect: () => act(o, () => unsubscribe(me.agent, me.did, o.uri)) }];
</script>

<div class="page-head">
	<div>
		<h1>{t('home.welcome')}</h1>
		<p class="sub">{today}</p>
	</div>
	<a class="btn secondary" href="/new"><Plus size={16} aria-hidden="true" />{t('deck.new')}</a>
</div>

{#if streak}<StreakCard {streak} />{/if}

{#if error}<p class="error" role="alert">{t('deck.saveError')}: {error}</p>{/if}

{#if !overview}
	{#if !error}<p class="muted">{t('common.loading')}</p>{/if}
{:else if overview.length === 0}
	<div class="panel empty">
		<p>{t('home.empty')}</p>
		<a href="/search">{t('home.findDecks')}</a>
	</div>
{:else}
	<h2 class="list-title">{t('home.decks')}</h2>
	<ul class="panel list">
		{#each overview as o (o.uri)}
			<li>
				<div class="info">
					{#if o.deck}
						<a href="/deck/{o.did}/{o.rkey}" class="name">{o.deck.record.name}</a>
						<span class="meta">
							<span>{t('label.new')}<span class="num">{o.newCount}</span></span>
							<span>{t('label.due')}<span class="num">{o.dueCount}</span></span>
							{#if !o.own}<UserChip did={o.did} size={16} />{/if}
						</span>
					{:else}
						<span class="name muted">{t('study.deckDeleted')}</span>
					{/if}
				</div>
				{#if o.deck}
					{#if o.newCount + o.dueCount > 0}
						<a class="btn small secondary study" href="/study/{o.did}/{o.rkey}">
							{t('study.start')}<ArrowRight size={16} aria-hidden="true" />
						</a>
					{:else}
						<span class="done"><Check size={16} aria-hidden="true" />{t('study.nothingDue')}</span>
					{/if}
				{/if}
				<RowMenu label={t('deck.menu')} items={menuFor(o)} />
			</li>
		{/each}
	</ul>
{/if}

<style>
	.list-title {
		margin: 0 0 8px;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--muted);
	}
	.list {
		margin: 0;
		padding: 4px 8px 4px 20px;
		list-style: none;
	}
	li {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 68px;
		padding: 12px 0;
	}
	li + li {
		border-top: 1px solid var(--border);
	}
	.info {
		display: grid;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text);
		font-weight: 500;
		text-decoration: none;
	}
	a.name:hover {
		color: var(--accent-ink);
		text-decoration: underline;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 16px;
		font-size: 0.8125rem;
		color: var(--muted);
	}
	.meta .num {
		margin-left: 4px;
		color: var(--text-2);
	}
	.study {
		color: var(--accent-ink);
	}
	.done {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 0.8125rem;
		color: var(--muted);
	}
	.empty {
		display: grid;
		gap: 8px;
	}
	.empty p {
		margin: 0;
	}
	@media (max-width: 560px) {
		.done {
			display: none;
		}
	}
</style>

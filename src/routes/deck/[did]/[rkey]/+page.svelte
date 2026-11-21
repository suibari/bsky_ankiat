<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { viewer } from '#lib/atproto/auth.svelte.js';
	import { resolveIdentity } from '#lib/atproto/identity.js';
	import type { Card } from '#lib/atproto/records.js';
	import BulkCardInput from '#lib/components/BulkCardInput.svelte';
	import CardForm from '#lib/components/CardForm.svelte';
	import type { BulkCard } from '#lib/decks/bulk.js';
	import CardHtml from '#lib/components/CardHtml.svelte';
	import RowMenu from '#lib/components/RowMenu.svelte';
	import { FileDown, Link2, Pencil } from '@lucide/svelte';
	import { anki, ankiState } from '#lib/anki/state.svelte.js';
	import { exportDeckToAnki } from '#lib/anki/export.js';
	import UserChip from '#lib/components/UserChip.svelte';
	import DeckForm from '#lib/components/DeckForm.svelte';
	import { removeDeck as deleteDeckAndSync } from '#lib/decks/remove.js';
	import {
		loadDeck,
		newCardId,
		saveCardChanges,
		updateDeckMeta,
		type DeckMeta,
		type LoadedDeck
	} from '#lib/decks/service.js';
	import { stripAnswerPrefix } from '#lib/decks/sanitize.js';
	import { htmlToText, textToHtml } from '#lib/decks/text.js';
	import { t } from '#lib/i18n/index.svelte.js';
	import LearnButton from '#lib/components/LearnButton.svelte';
	import ShareDeckButton from '#lib/components/ShareDeckButton.svelte';
	import { getCachedIndex } from '#lib/search/index.js';

	const me = viewer();

	let deck = $state<LoadedDeck | null>();
	let loadError = $state<string>();
	let author = $state<string>();
	let editingMeta = $state(false);
	let editingCard = $state<string>();
	let addMode = $state<'single' | 'bulk'>('single');
	let busy = $state(false);
	let actionError = $state<string>();
	let learners = $state<number>();

	const isOwner = $derived(!!me && deck?.did === me.did);
	const editable = $derived(isOwner && !deck?.record.source);
	const cards = $derived(deck ? deck.chunks.flat() : []);

	let exporting = $state(false);
	let exportMessage = $state<string>();

	// 自分の Anki 連携デッキは、もともと Anki にあるので書き出さない
	const canExport = $derived(ankiState.status === 'connected' && !(isOwner && deck?.record.source));

	async function exportToAnki() {
		if (!deck) return;
		exporting = true;
		exportMessage = actionError = undefined;
		try {
			const result = await exportDeckToAnki(
				anki,
				{ name: deck.record.name, cards: deck.chunks.flat(), fromAnki: !!deck.record.source },
				{ image: t('card.image'), audio: t('card.audio') }
			);
			exportMessage = t('export.done', {
				deck: result.deckName,
				added: String(result.added),
				skipped: String(result.skipped)
			});
		} catch (e) {
			actionError = e instanceof Error ? e.message : String(e);
		} finally {
			exporting = false;
		}
	}

	$effect(() => {
		const { did, rkey } = page.params as { did: string; rkey: string };
		deck = undefined;
		loadError = undefined;
		loadDeck(did, rkey)
			.then((d) => (deck = d ?? null))
			.catch((e) => (loadError = e.message));
		resolveIdentity(did)
			.then((id) => (author = id.handle ?? did))
			.catch(() => (author = did));
		// 学習中の人数は検索の索引（キャッシュ）から。索引がなければ表示しない
		learners = undefined;
		getCachedIndex().then((index) => {
			const hit = index?.decks.find((d) => d.did === did && d.rkey === rkey);
			if (hit) learners = hit.learners ?? 0;
		});
	});


	async function run(action: (d: LoadedDeck) => Promise<LoadedDeck | void>) {
		if (!deck) return;
		busy = true;
		actionError = undefined;
		try {
			const next = await action(deck);
			if (next) deck = next;
		} catch (e) {
			actionError = e instanceof Error ? e.message : String(e);
			throw e;
		} finally {
			busy = false;
		}
	}

	const saveMeta = (meta: DeckMeta) =>
		run(async (d) => {
			const next = await updateDeckMeta(me!.agent, d, meta);
			editingMeta = false;
			return next;
		});

	const addCard = (input: { front: string; back: string }) =>
		run((d) =>
			saveCardChanges(me!.agent, d, {
				upserts: [{ id: newCardId(), front: textToHtml(input.front), back: textToHtml(input.back) }]
			})
		);

	const addCards = (input: BulkCard[]) =>
		run((d) =>
			saveCardChanges(me!.agent, d, {
				upserts: input.map((c) => ({ id: newCardId(), front: textToHtml(c.front), back: textToHtml(c.back) }))
			})
		);

	const updateCard = (card: Card, input: { front: string; back: string }) =>
		run(async (d) => {
			const next = await saveCardChanges(me!.agent, d, {
				upserts: [{ ...card, front: textToHtml(input.front), back: textToHtml(input.back) }]
			});
			editingCard = undefined;
			return next;
		});

	const removeCard = (card: Card) =>
		run((d) => saveCardChanges(me!.agent, d, { deletes: [card.id] })).catch(() => {});

	const removeDeck = () =>
		run(async (d) => {
			await deleteDeckAndSync(me!.agent, me!.did, d);
			await goto('/');
		}).catch(() => {});
</script>

<svelte:head>
	{#if deck}<title>{deck.record.name} | AnkiAt</title>{/if}
</svelte:head>

{#if loadError}
	<p class="error">{t('deck.loadError')}: {loadError}</p>
{:else if deck === undefined}
	<p class="muted">{t('common.loading')}</p>
{:else if deck === null}
	<p>{t('deck.notFound')}</p>
{:else}
	{#if editingMeta}
		<section class="panel">
			<DeckForm
				initial={deck.record}
				submitLabel={t('deck.save')}
				submittingLabel={t('deck.saving')}
				onsubmit={saveMeta}
				oncancel={() => (editingMeta = false)}
			/>
		</section>
	{:else}
		<header>
			<h1>{deck.record.name}</h1>
			<p class="meta muted">
				<UserChip did={deck.did} handle={author} />
				<span>{t('deck.cards', { count: String(deck.record.cardCount) })}</span>
				{#if isOwner && learners !== undefined}
					<span>{t('learn.count', { count: String(learners) })}</span>
				{/if}
				{#if deck.record.listed === false}<span class="tag">{t('deck.unlisted')}</span>{/if}
			</p>
			{#if deck.record.description}<p class="description">{deck.record.description}</p>{/if}
			{#if deck.record.tags?.length}
				<p class="tags">
					{#each deck.record.tags as tag (tag)}<span class="tag">{tag}</span>{/each}
				</p>
			{/if}
			{#if deck.record.source}
				<p class="linked muted small"><Link2 size={16} aria-hidden="true" />{t('deck.ankiLinked')}</p>
			{/if}
			<div class="actions">
				<a class="btn" href="/study/{deck.did}/{deck.rkey}">{t('study.start')}</a>
				{#if !isOwner}
					<LearnButton uri={deck.uri} bind:count={learners} />
				{/if}
				{#if deck.record.listed !== false || isOwner}
					<ShareDeckButton
						name={deck.record.name}
						did={deck.did}
						rkey={deck.rkey}
						updatedAt={deck.record.updatedAt}
						own={isOwner}
					/>
				{/if}
				{#if canExport}
					<button class="btn secondary" disabled={exporting} onclick={exportToAnki} title={t('export.note')}>
						<FileDown size={16} aria-hidden="true" />{exporting ? t('export.running') : t('export.button')}
					</button>
				{/if}
				{#if isOwner}
					<button class="btn secondary" onclick={() => (editingMeta = true)}>
						<Pencil size={16} aria-hidden="true" />{t('deck.edit')}
					</button>
					<RowMenu
						label={t('deck.menu')}
						items={[
							{
								label: t('deck.delete'),
								danger: true,
								confirmLabel: t('deck.deleteConfirmShort'),
								onselect: removeDeck
							}
						]}
					/>
				{/if}
			</div>
		</header>
	{/if}

	{#if exportMessage}<p class="small" role="status">{exportMessage}</p>{/if}
	{#if actionError}<p class="error" role="alert">{t('deck.saveError')}: {actionError}</p>{/if}

	{#if editable}
		<section class="panel">
			<div class="add-head">
				<h2>{t('card.add')}</h2>
				<div class="tabs" role="tablist">
					<button role="tab" aria-selected={addMode === 'single'} onclick={() => (addMode = 'single')}>
						{t('bulk.tab.single')}
					</button>
					<button role="tab" aria-selected={addMode === 'bulk'} onclick={() => (addMode = 'bulk')}>
						{t('bulk.tab.bulk')}
					</button>
				</div>
			</div>
			{#if addMode === 'single'}
				<CardForm submitLabel={t('card.add')} submittingLabel={t('card.adding')} onsubmit={addCard} />
			{:else}
				<BulkCardInput onsubmit={addCards} />
			{/if}
		</section>
	{/if}

	{#if cards.length === 0}
		<p class="muted">{t('card.empty')}</p>
	{:else}
		<ol class="cards">
			{#each cards as card (card.id)}
				<li class="index-card">
					{#if editingCard === card.id}
						<CardForm
							initial={{ front: htmlToText(card.front), back: htmlToText(card.back) }}
							submitLabel={t('deck.save')}
							submittingLabel={t('deck.saving')}
							onsubmit={(input) => updateCard(card, input)}
							oncancel={() => (editingCard = undefined)}
						/>
					{:else}
						<div class="sides">
							<CardHtml html={card.front} />
							<CardHtml html={deck.record.source ? stripAnswerPrefix(card.back) : card.back} />
						</div>
						{#if editable}
							<div class="card-menu">
								<RowMenu
									label={t('deck.menu')}
									items={[
										{ label: t('card.edit'), onselect: () => (editingCard = card.id) },
										{
											label: t('card.delete'),
											danger: true,
											confirmLabel: t('deck.deleteConfirmShort'),
											onselect: () => removeCard(card)
										}
									]}
								/>
							</div>
						{/if}
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
{/if}

<style>
	header {
		margin-bottom: 32px;
	}
	h1 {
		margin-bottom: 8px;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 16px;
		margin: 0 0 12px;
		font-size: 0.875rem;
	}
	.description {
		margin: 0 0 12px;
		white-space: pre-wrap;
		color: var(--text-2);
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin: 0 0 12px;
	}
	.linked {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0 0 12px;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-top: 20px;
	}
	section {
		margin: 0 0 24px;
	}
	.cards {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.cards li {
		position: relative;
		padding: 32px 20px 16px;
	}
	.sides {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 8px 24px;
		padding-right: 32px;
	}
	.sides > :global(:last-child) {
		color: var(--text-2);
	}
	.add-head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
	}
	.add-head h2 {
		margin: 0;
	}
	.tabs {
		display: inline-flex;
		padding: 2px;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
	}
	.tabs button {
		padding: 4px 12px;
		border: none;
		border-radius: calc(var(--radius-sm) - 2px);
		background: none;
		color: var(--text-2);
		font-size: 0.875rem;
		cursor: pointer;
	}
	.tabs button[aria-selected='true'] {
		background: var(--surface);
		color: var(--text);
		font-weight: 500;
		box-shadow: var(--shadow);
	}
	.card-menu {
		position: absolute;
		top: 8px;
		right: 8px;
	}
</style>

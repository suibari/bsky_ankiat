<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { currentUser } from '#lib/atproto/auth.svelte.js';
	import { resolveIdentity } from '#lib/atproto/identity.js';
	import { atUri, type Card } from '#lib/atproto/records.js';
	import { NSID } from '#lib/atproto/lexicons.js';
	import CardForm from '#lib/components/CardForm.svelte';
	import CardHtml from '#lib/components/CardHtml.svelte';
	import ConfirmButton from '#lib/components/ConfirmButton.svelte';
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
	import { listSubscriptions, subscribe, unsubscribe } from '#lib/study/data.js';

	const me = currentUser();

	let deck = $state<LoadedDeck | null>();
	let loadError = $state<string>();
	let author = $state<string>();
	let editingMeta = $state(false);
	let editingCard = $state<string>();
	let busy = $state(false);
	let actionError = $state<string>();
	let subscribed = $state<boolean>();

	const isOwner = $derived(deck?.did === me.did);
	const editable = $derived(isOwner && !deck?.record.source);
	const cards = $derived(deck ? deck.chunks.flat() : []);

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
		subscribed = undefined;
		if (did === me.did) return; // 自分のデッキは常にホームに表示される
		listSubscriptions(me.did)
			.then((subs) => (subscribed = subs.some((s) => s.deck === atUri(did, NSID.deck, rkey))))
			.catch(() => {});
	});

	async function toggleSubscription() {
		if (!deck) return;
		busy = true;
		actionError = undefined;
		try {
			if (subscribed) await unsubscribe(me.agent, me.did, deck.uri);
			else await subscribe(me.agent, me.did, deck.uri);
			subscribed = !subscribed;
		} catch (e) {
			actionError = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

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
			const next = await updateDeckMeta(me.agent, d, meta);
			editingMeta = false;
			return next;
		});

	const addCard = (input: { front: string; back: string }) =>
		run((d) =>
			saveCardChanges(me.agent, d, {
				upserts: [{ id: newCardId(), front: textToHtml(input.front), back: textToHtml(input.back) }]
			})
		);

	const updateCard = (card: Card, input: { front: string; back: string }) =>
		run(async (d) => {
			const next = await saveCardChanges(me.agent, d, {
				upserts: [{ ...card, front: textToHtml(input.front), back: textToHtml(input.back) }]
			});
			editingCard = undefined;
			return next;
		});

	const removeCard = (card: Card) =>
		run((d) => saveCardChanges(me.agent, d, { deletes: [card.id] })).catch(() => {});

	const removeDeck = () =>
		run(async (d) => {
			await deleteDeckAndSync(me.agent, me.did, d);
			await goto('/');
		}).catch(() => {});
</script>

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
				{#if deck.record.listed === false}<span class="tag">{t('deck.unlisted')}</span>{/if}
			</p>
			{#if deck.record.description}<p class="description">{deck.record.description}</p>{/if}
			{#if deck.record.tags?.length}
				<p class="tags">
					{#each deck.record.tags as tag (tag)}<span class="tag">{tag}</span>{/each}
				</p>
			{/if}
			{#if deck.record.source}<p class="muted">{t('deck.ankiLinked')}</p>{/if}
			<div class="actions">
				<a class="btn" href="/study/{deck.did}/{deck.rkey}">{t('study.start')}</a>
				{#if !isOwner && subscribed !== undefined}
					<button class="btn secondary" disabled={busy} onclick={toggleSubscription}>
						{subscribed ? t('study.remove') : t('study.add')}
					</button>
				{/if}
			</div>
			{#if isOwner}
				<div class="actions">
					<button class="btn secondary" onclick={() => (editingMeta = true)}>{t('deck.edit')}</button>
					<ConfirmButton
						label={t('deck.delete')}
						message={t('deck.deleteConfirm')}
						disabled={busy}
						onconfirm={removeDeck}
					/>
				</div>
			{/if}
		</header>
	{/if}

	{#if actionError}<p class="error" role="alert">{t('deck.saveError')}: {actionError}</p>{/if}

	{#if editable}
		<section class="panel">
			<h2>{t('card.add')}</h2>
			<CardForm submitLabel={t('card.add')} submittingLabel={t('card.adding')} onsubmit={addCard} />
		</section>
	{/if}

	{#if cards.length === 0}
		<p class="muted">{t('card.empty')}</p>
	{:else}
		<ol class="cards">
			{#each cards as card (card.id)}
				<li class="panel">
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
							<div class="actions">
								<button class="btn secondary" disabled={busy} onclick={() => (editingCard = card.id)}>
									{t('card.edit')}
								</button>
								<ConfirmButton
									label={t('card.delete')}
									message={t('card.deleteConfirm')}
									disabled={busy}
									onconfirm={() => removeCard(card)}
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
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem 0.75rem;
	}
	h1 {
		margin-bottom: 0;
	}
	.description {
		white-space: pre-wrap;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
	section {
		margin: 1.5rem 0;
	}
	h2 {
		font-size: 1rem;
		margin-top: 0;
	}
	.cards {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}
	.sides {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.5rem 1rem;
	}
	.sides > :global(:last-child) {
		color: var(--muted);
	}
</style>

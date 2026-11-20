<script lang="ts">
	import { page } from '$app/state';
	import { onDestroy } from 'svelte';
	import { currentUser } from '#lib/atproto/auth.svelte.js';
	import { atUri } from '#lib/atproto/records.js';
	import { NSID } from '#lib/atproto/lexicons.js';
	import type { Rating } from '#lib/atproto/records.js';
	import CardHtml from '#lib/components/CardHtml.svelte';
	import Consent from '#lib/components/Consent.svelte';
	import { loadDeck, type LoadedDeck } from '#lib/decks/service.js';
	import { stripAnswerPrefix } from '#lib/decks/sanitize.js';
	import { formatInterval } from '#lib/i18n/format.js';
	import { i18n, t } from '#lib/i18n/index.svelte.js';
	import {
		DEFAULT_NEW_CARDS_PER_DAY,
		getOutbox,
		getPreferences,
		loadReviewEntries,
		savePreferences
	} from '#lib/study/data.js';
	import { getScheduler, replay } from '#lib/study/scheduler.js';
	import { StudySession } from '#lib/study/session.svelte.js';
	import { syncAll } from '#lib/anki/state.svelte.js';
	import type { PreferencesRecord } from '#lib/atproto/records.js';

	/** 一定時間ごとにも未送信の回答を書き込む */
	const FLUSH_INTERVAL_MS = 5 * 60 * 1000;

	const me = currentUser();
	const outbox = getOutbox(me.agent, me.did);
	const { did, rkey } = page.params as { did: string; rkey: string };
	const deckUri = atUri(did, NSID.deck, rkey);

	let prefs = $state<PreferencesRecord>();
	let deck = $state<LoadedDeck | null>();
	let session = $state<StudySession>();
	let loadError = $state<string>();

	const ratings: { rating: Rating; key: 'study.again' | 'study.hard' | 'study.good' | 'study.easy' }[] = [
		{ rating: 1, key: 'study.again' },
		{ rating: 2, key: 'study.hard' },
		{ rating: 3, key: 'study.good' },
		{ rating: 4, key: 'study.easy' }
	];

	async function start() {
		try {
			const [p, d] = await Promise.all([getPreferences(me.did), loadDeck(did, rkey)]);
			prefs = p;
			deck = d ?? null;
			if (!d || !p.publicHistoryConsentAt) return;
			const [entries, scheduler] = await Promise.all([
				loadReviewEntries(me.agent, me.did),
				getScheduler()
			]);
			const deckEntries = entries.get(deckUri) ?? [];
			session = new StudySession({
				scheduler,
				deckUri,
				cards: d.chunks.flat(),
				states: replay(scheduler, deckEntries),
				entries: deckEntries,
				newLimit: p.newCardsPerDay ?? DEFAULT_NEW_CARDS_PER_DAY,
				record: (entry) => outbox.add(deckUri, entry),
				flush: async () => void (await outbox.flush())
			});
		} catch (e) {
			loadError = e instanceof Error ? e.message : String(e);
		}
	}
	start();

	async function accept() {
		prefs = await savePreferences(me.agent, me.did, {
			publicHistoryConsentAt: new Date().toISOString()
		});
		await start();
	}

	const preview = $derived(session?.revealed ? session.preview() : undefined);

	$effect(() => {
		// セッション終了時: 回答を PDS に書き、Anki 連携中なら同期する
		if (session?.done) void session.flush().then(() => syncAll());
	});

	const timer = setInterval(() => void session?.flush(), FLUSH_INTERVAL_MS);
	function onvisibility() {
		if (document.visibilityState === 'hidden') void session?.flush();
	}
	onDestroy(() => {
		clearInterval(timer);
		void session?.flush();
	});

	function onkeydown(e: KeyboardEvent) {
		if (!session || session.done || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
		if (!session.revealed && (e.key === ' ' || e.key === 'Enter')) {
			e.preventDefault();
			session.reveal();
		} else if (session.revealed && ['1', '2', '3', '4'].includes(e.key)) {
			e.preventDefault();
			void session.answer(Number(e.key) as Rating);
		}
	}
</script>

<svelte:window {onkeydown} />
<svelte:document onvisibilitychange={onvisibility} />

{#if loadError}
	<p class="error">{t('deck.loadError')}: {loadError}</p>
{:else if deck === undefined || prefs === undefined}
	<p class="muted">{t('common.loading')}</p>
{:else if deck === null}
	<p>{t('deck.notFound')}</p>
{:else if !prefs.publicHistoryConsentAt}
	<Consent onaccept={accept} />
{:else if !session}
	<p class="muted">{t('common.loading')}</p>
{:else}
	<div class="top">
		<a href="/deck/{did}/{rkey}" class="deck-name">{deck.record.name}</a>
		<span class="counts">
			<span class="new">{t('study.new', { count: String(session.counts.new) })}</span>
			<span class="learning">{t('study.learning', { count: String(session.counts.learning) })}</span>
			<span class="due">{t('study.due', { count: String(session.counts.due) })}</span>
		</span>
	</div>

	{#if session.flushError}<p class="error small" role="alert">{t('study.saveError')}</p>{/if}

	{#if session.current}
		<article class="panel card">
			<CardHtml html={session.current.front} />
			{#if session.revealed}
				<hr />
				<CardHtml html={deck.record.source ? stripAnswerPrefix(session.current.back) : session.current.back} />
			{/if}
		</article>

		<div class="answer-bar">
			{#if !session.revealed}
				<button class="btn wide" onclick={() => session?.reveal()}>{t('study.showAnswer')}</button>
			{:else}
				{#each ratings as r (r.rating)}
					<button class="btn rate rate-{r.rating}" onclick={() => session?.answer(r.rating)}>
						<span class="interval">
							{preview ? formatInterval(preview[r.rating].getTime() - Date.now(), i18n.locale) : ''}
						</span>
						<span>{t(r.key)}</span>
					</button>
				{/each}
			{/if}
		</div>
		<p class="muted small hint">{t('study.shortcuts')}</p>
	{:else}
		<section class="panel finished">
			<p>{t('study.done')}</p>
			<p class="muted">{t('study.reviewed', { count: String(session.reviewed) })}</p>
			<a class="btn" href="/">{t('study.backToHome')}</a>
		</section>
	{/if}
{/if}

<style>
	.top {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.5rem;
		align-items: baseline;
		margin-bottom: 1rem;
	}
	.deck-name {
		font-weight: 600;
		color: var(--text);
	}
	.counts {
		display: flex;
		gap: 0.75rem;
		font-variant-numeric: tabular-nums;
		font-size: 0.875rem;
	}
	.new {
		color: #2a6fdb;
	}
	.learning {
		color: #c2410c;
	}
	.due {
		color: var(--accent);
	}
	.card {
		min-height: 12rem;
		font-size: 1.25rem;
		text-align: center;
		display: grid;
		align-content: center;
		gap: 1rem;
	}
	hr {
		width: 100%;
		border: none;
		border-top: 1px solid var(--border);
		margin: 0;
	}
	.answer-bar {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
		margin-top: 1rem;
	}
	.wide {
		grid-column: 1 / -1;
		padding: 0.75rem;
	}
	.rate {
		display: grid;
		gap: 0.125rem;
		padding: 0.5rem 0.25rem;
		background: var(--surface);
		color: var(--text);
		border-color: var(--border);
	}
	.rate-1 {
		border-bottom: 3px solid var(--danger);
	}
	.rate-2 {
		border-bottom: 3px solid #c2410c;
	}
	.rate-3 {
		border-bottom: 3px solid var(--accent);
	}
	.rate-4 {
		border-bottom: 3px solid #2a6fdb;
	}
	.interval {
		font-size: 0.75rem;
		color: var(--muted);
	}
	.small {
		font-size: 0.875rem;
	}
	.hint {
		text-align: center;
	}
	.finished {
		text-align: center;
	}
</style>

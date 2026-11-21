<script lang="ts">
	import { page } from '$app/state';
	import { onDestroy } from 'svelte';
	import { openLogin, viewer } from '#lib/atproto/auth.svelte.js';
	import { guestReviews } from '#lib/guest/store.js';
	import { atUri } from '#lib/atproto/records.js';
	import { NSID } from '#lib/atproto/lexicons.js';
	import type { Rating } from '#lib/atproto/records.js';
	import { Check, Info } from '@lucide/svelte';
	import CardHtml from '#lib/components/CardHtml.svelte';
	import Consent from '#lib/components/Consent.svelte';
	import CelebrationModal from '#lib/components/CelebrationModal.svelte';
	import { computeStreak } from '#lib/study/streak.js';
	import { loadDeck, type LoadedDeck } from '#lib/decks/service.js';
	import { stripAnswerPrefix } from '#lib/decks/sanitize.js';
	import { formatInterval } from '#lib/i18n/format.js';
	import { i18n, t } from '#lib/i18n/index.svelte.js';
	import {
		DEFAULT_NEW_CARDS_PER_DAY,
		getOutbox,
		getPreferences,
		loadAnkiOverrides,
		loadReviewEntries,
		savePreferences
	} from '#lib/study/data.js';
	import { getScheduler, replay } from '#lib/study/scheduler.js';
	import { StudySession } from '#lib/study/session.svelte.js';
	import { syncAll } from '#lib/anki/state.svelte.js';
	import type { PreferencesRecord } from '#lib/atproto/records.js';

	/** 一定時間ごとにも未送信の回答を書き込む */
	const FLUSH_INTERVAL_MS = 5 * 60 * 1000;

	// 未ログインのときは、回答をこの端末にだけ保存する（docs/SPEC.md 3.7）
	const me = viewer();
	const outbox = me ? getOutbox(me.agent, me.did) : undefined;
	const { did, rkey } = page.params as { did: string; rkey: string };
	const deckUri = atUri(did, NSID.deck, rkey);

	let prefs = $state<PreferencesRecord>();
	let deck = $state<LoadedDeck | null>();
	let session = $state<StudySession>();
	let loadError = $state<string>();
	/** 連続日数の計算用: 学習開始時点の全デッキの回答時刻 */
	let pastReviews: string[] = [];
	let celebrate = $state(false);
	let celebration = $state({ streak: 0, reviewedToday: 0 });

	const ratings: { rating: Rating; key: 'study.again' | 'study.hard' | 'study.good' | 'study.easy' }[] = [
		{ rating: 1, key: 'study.again' },
		{ rating: 2, key: 'study.hard' },
		{ rating: 3, key: 'study.good' },
		{ rating: 4, key: 'study.easy' }
	];

	async function start() {
		try {
			const [p, d] = await Promise.all([
				me ? getPreferences(me.did) : Promise.resolve<PreferencesRecord>({}),
				loadDeck(did, rkey)
			]);
			prefs = p;
			deck = d ?? null;
			// 未ログインのときは PDS に何も書かないので、同意は求めない
			if (!d || (me && !p.publicHistoryConsentAt)) return;
			const [entries, scheduler] = await Promise.all([
				me ? loadReviewEntries(me.agent, me.did) : guestReviews.byDeck(),
				getScheduler()
			]);
			pastReviews = [...entries.values()].flat().map((e) => e.reviewedAt);
			const deckEntries = entries.get(deckUri) ?? [];
			const overrides = me ? await loadAnkiOverrides(me.did, d, deckEntries) : new Map();
			session = new StudySession({
				overrides,
				scheduler,
				deckUri,
				cards: d.chunks.flat(),
				states: replay(scheduler, deckEntries),
				entries: deckEntries,
				newLimit: p.newCardsPerDay ?? DEFAULT_NEW_CARDS_PER_DAY,
				record: outbox
					? (entry) => outbox.add(deckUri, entry)
					: async (entry) => {
							await guestReviews.add(deckUri, entry);
							return 0;
						},
				flush: async () => void (await outbox?.flush())
			});
		} catch (e) {
			loadError = e instanceof Error ? e.message : String(e);
		}
	}
	start();

	async function accept() {
		if (!me) return;
		prefs = await savePreferences(me.agent, me.did, {
			publicHistoryConsentAt: new Date().toISOString()
		});
		await start();
	}

	// Anki 連携デッキの次回間隔は Anki が決めるため、AnkiAt の FSRS による予測は表示しない
	const preview = $derived(
		session?.revealed && !deck?.record.source ? session.preview() : undefined
	);

	$effect(() => {
		// セッション終了時: 回答を PDS に書き、Anki 連携中なら同期する。1 枚以上答えていたら祝う
		if (!session?.done) return;
		if (!me) return;
		void session.flush().then(() => syncAll());
		if (session.reviewed > 0) {
			const now = new Date().toISOString();
			const s = computeStreak([...pastReviews, ...Array(session.reviewed).fill(now)]);
			celebration = { streak: s.current, reviewedToday: s.reviewedToday };
			celebrate = true;
		}
	});

	const remaining = $derived(
		session ? session.counts.new + session.counts.learning + session.counts.due : 0
	);
	const total = $derived((session?.reviewed ?? 0) + remaining);

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
{:else if me && !prefs.publicHistoryConsentAt}
	<Consent onaccept={accept} />
{:else if !session}
	<p class="muted">{t('common.loading')}</p>
{:else}
	<div class="top">
		<a href="/deck/{did}/{rkey}" class="deck-name">{deck.record.name}</a>
		<span class="counts">
			<span>{t('label.new')}<span class="num">{session.counts.new}</span></span>
			<span>{t('label.learning')}<span class="num">{session.counts.learning}</span></span>
			<span>{t('label.due')}<span class="num">{session.counts.due}</span></span>
		</span>
	</div>

	{#if total > 0}
		<div
			class="progress"
			role="progressbar"
			aria-valuemin="0"
			aria-valuemax={total}
			aria-valuenow={session.reviewed}
			aria-label={t('study.progress', { done: String(session.reviewed), total: String(total) })}
		>
			<div class="fill" style:transform="scaleX({session.reviewed / total})"></div>
		</div>
	{/if}

	{#if !me}
		<p class="guest-note small">
			<Info size={16} aria-hidden="true" />
			<span>{t('guest.studyNote')}</span>
			<button class="link" onclick={() => openLogin(t('login.reason.save'))}>{t('login.submit')}</button>
		</p>
	{/if}

	{#if session.flushError}<p class="error small" role="alert">{t('study.saveError')}</p>{/if}

	{#if session.current}
		<article class="index-card card" aria-live="polite">
			<div class="face front"><CardHtml html={session.current.front} /></div>
			{#if session.revealed}
				<div class="face back">
					<CardHtml html={deck.record.source ? stripAnswerPrefix(session.current.back) : session.current.back} />
				</div>
			{/if}
		</article>

		<div class="answer-bar">
			{#if !session.revealed}
				<button class="btn large wide" onclick={() => session?.reveal()}>
					{t('study.showAnswer')}
				</button>
			{:else}
				{#each ratings as r (r.rating)}
					<button class="rate" class:again={r.rating === 1} onclick={() => session?.answer(r.rating)}>
						{#if preview}
							<span class="interval num">
								{formatInterval(preview[r.rating].getTime() - Date.now(), i18n.locale)}
							</span>
						{/if}
						<span class="rate-label">{t(r.key)}</span>
						<span class="keycap">{r.rating}</span>
					</button>
				{/each}
			{/if}
		</div>
		<p class="hint">
			{#if !session.revealed}
				<span class="keycap">Space</span> {t('study.shortcuts')}
			{:else}
				<span class="keycap">1</span>–<span class="keycap">4</span> {t('study.shortcutsAnswer')}
			{/if}
		</p>
	{:else}
		<section class="panel finished">
			<span class="check" aria-hidden="true"><Check size={20} /></span>
			<p>{t('study.done')}</p>
			<p class="muted small">{t('study.reviewed', { count: String(session.reviewed) })}</p>
			{#if me}
				<a class="btn secondary" href="/">{t('study.backToHome')}</a>
			{:else}
				<p class="guest-done">{t('guest.doneBody')}</p>
				<div class="guest-actions">
					<button class="btn" onclick={() => openLogin(t('login.reason.save'))}>{t('guest.saveRecord')}</button>
					<a class="btn secondary" href="/search">{t('landing.findDecks')}</a>
				</div>
			{/if}
		</section>
	{/if}
	<CelebrationModal bind:open={celebrate} streak={celebration.streak} reviewedToday={celebration.reviewedToday} />
{/if}

<style>
	.top {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: baseline;
		gap: 4px 16px;
		margin-bottom: 12px;
	}
	.deck-name {
		color: var(--text-2);
		font-size: 0.875rem;
		text-decoration: none;
	}
	.deck-name:hover {
		color: var(--text);
		text-decoration: underline;
	}
	.counts {
		display: flex;
		gap: 16px;
		font-size: 0.8125rem;
		color: var(--muted);
	}
	.counts .num {
		margin-left: 4px;
		color: var(--text);
	}
	.progress {
		height: 4px;
		margin-bottom: 24px;
		border-radius: 2px;
		background: var(--surface-2);
		overflow: hidden;
	}
	.fill {
		height: 100%;
		background: var(--accent);
		transform-origin: left;
		transition: transform 0.3s var(--ease);
	}
	.card {
		display: grid;
		min-height: 300px;
		box-shadow: var(--shadow-card);
	}
	.face {
		display: grid;
		align-content: center;
		padding: 40px 32px;
		text-align: center;
		font-size: 1.375rem;
		line-height: 1.6;
	}
	.back {
		border-top: 1px dashed var(--border-strong);
		background: var(--paper);
		color: var(--text);
		font-size: 1.125rem;
		animation: reveal 0.3s var(--ease);
		border-radius: 0 0 var(--radius) var(--radius);
	}
	.answer-bar {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
		margin-top: 16px;
	}
	.wide {
		grid-column: 1 / -1;
	}
	.rate {
		display: grid;
		justify-items: center;
		align-content: center;
		gap: 4px;
		min-height: 64px;
		padding: 8px 4px;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm);
		background: var(--surface);
		cursor: pointer;
		transition:
			background-color 0.15s var(--ease),
			border-color 0.15s var(--ease),
			transform 0.12s var(--ease);
	}
	.rate:hover {
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	.rate:active {
		transform: scale(0.98);
	}
	.rate-label {
		font-weight: 500;
	}
	.again .rate-label {
		color: var(--danger);
	}
	.interval {
		min-height: 16px;
		font-size: 0.75rem;
		line-height: 16px;
		color: var(--muted);
	}
	.hint {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 4px;
		margin: 16px 0 0;
		font-size: 0.8125rem;
		color: var(--muted);
	}
	.finished {
		display: grid;
		justify-items: center;
		gap: 8px;
		padding: 40px 20px;
		text-align: center;
	}
	.finished p {
		margin: 0;
	}
	.guest-note {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin: 0 0 16px;
		padding: 8px 12px;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text-2);
	}
	.guest-note .link {
		padding: 0;
		border: none;
		background: none;
		color: var(--accent-ink);
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}
	.guest-done {
		max-width: 420px;
		margin-top: 8px !important;
		color: var(--text-2);
	}
	.guest-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px;
		margin-top: 8px;
	}
	.check {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 999px;
		background: var(--accent-soft);
		color: var(--accent-ink);
	}
	@keyframes reveal {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}
	@media (max-width: 560px) {
		.face {
			padding: 32px 20px;
			font-size: 1.25rem;
		}
		.rate .keycap {
			display: none;
		}
	}
</style>

<script lang="ts">
	import { ArrowRight, RotateCcw } from '@lucide/svelte';
	import type { Rating } from '#lib/atproto/records.js';
	import { SAMPLE_CARDS } from '#lib/guest/sample.js';
	import { formatInterval } from '#lib/i18n/format.js';
	import { i18n, t } from '#lib/i18n/index.svelte.js';
	import type { MessageKey } from '#lib/i18n/messages.js';
	import { getScheduler, previewDue } from '#lib/study/scheduler.js';

	/** LP の見本カード。めくって 4 段階で答えると、次に出る日を見せる（回答は保存しない） */
	let { onfinish }: { onfinish?: () => void } = $props();

	const ratings: { rating: Rating; key: MessageKey }[] = [
		{ rating: 1, key: 'study.again' },
		{ rating: 2, key: 'study.hard' },
		{ rating: 3, key: 'study.good' },
		{ rating: 4, key: 'study.easy' }
	];

	const cards = $derived(SAMPLE_CARDS[i18n.locale]);
	let index = $state(0);
	let revealed = $state(false);
	let feedback = $state<string>();
	let intervals = $state<Record<Rating, number>>();

	// 初めて見るカードの 4 段階それぞれの次回間隔（どのカードも同じ）
	getScheduler().then((s) => {
		const now = new Date();
		const due = previewDue(s, undefined, now);
		intervals = {
			1: due[1].getTime() - now.getTime(),
			2: due[2].getTime() - now.getTime(),
			3: due[3].getTime() - now.getTime(),
			4: due[4].getTime() - now.getTime()
		};
	});

	const done = $derived(index >= cards.length);
	const card = $derived(cards[index]);

	function rate(r: (typeof ratings)[number]) {
		const label = t(r.key);
		feedback = intervals
			? t('landing.demo.feedback', { rating: label, interval: formatInterval(intervals[r.rating], i18n.locale) })
			: undefined;
		revealed = false;
		index++;
		if (index >= cards.length) onfinish?.();
	}

	function restart() {
		index = 0;
		revealed = false;
		feedback = undefined;
	}

	function onkeydown(e: KeyboardEvent) {
		if (done || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
		if (!revealed && (e.key === ' ' || e.key === 'Enter') && e.target === document.body) {
			e.preventDefault();
			revealed = true;
		} else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
			e.preventDefault();
			rate(ratings[Number(e.key) - 1]);
		}
	}
</script>

<svelte:window {onkeydown} />

<div class="demo">
	<div class="index-card sheet behind" aria-hidden="true"></div>
	<section class="index-card sheet" aria-label={t('landing.demo.label')}>
		<span class="deck">{t('landing.demo.deck')} · {Math.min(index + 1, cards.length)}/{cards.length}</span>
		{#if !done}
			<p class="q" aria-live="polite">{card.front}</p>
			{#if revealed}
				<p class="a">{card.back}</p>
				<div class="rates">
					{#each ratings as r (r.rating)}
						<button class="rate" class:again={r.rating === 1} onclick={() => rate(r)}>
							{#if intervals}
								<span class="interval num">{formatInterval(intervals[r.rating], i18n.locale)}</span>
							{/if}
							<span>{t(r.key)}</span>
						</button>
					{/each}
				</div>
			{:else}
				<button class="btn" onclick={() => (revealed = true)}>{t('study.showAnswer')}</button>
			{/if}
		{:else}
			<p class="q">{t('landing.demo.done')}</p>
			<p class="muted small">{t('landing.demo.doneBody')}</p>
			<div class="end-actions">
				<a class="btn" href="/search">{t('landing.findDecks')}<ArrowRight size={16} aria-hidden="true" /></a>
				<button class="btn secondary" onclick={restart}>
					<RotateCcw size={16} aria-hidden="true" />{t('landing.demo.again')}
				</button>
			</div>
		{/if}
		<p class="feedback small" role="status">{feedback ?? ''}</p>
	</section>
</div>

<style>
	.demo {
		position: relative;
		min-height: 380px;
	}
	.sheet {
		position: absolute;
		inset: 24px 16px 24px 24px;
		display: grid;
		align-content: center;
		justify-items: center;
		gap: 16px;
		padding: 40px 24px 32px;
		box-shadow: var(--shadow-card);
		text-align: center;
		background-color: var(--paper);
	}
	.behind {
		transform: rotate(-4deg) translate(-12px, 8px);
		opacity: 0.6;
		box-shadow: none;
	}
	.deck {
		position: absolute;
		top: 12px;
		left: 56px;
		font-size: 0.75rem;
		color: var(--muted);
	}
	.q {
		margin: 0;
		font-size: 1.25rem;
		text-wrap: balance;
	}
	.a {
		margin: 0;
		padding-top: 16px;
		border-top: 1px dashed var(--border-strong);
		color: var(--text-2);
		animation: reveal 0.3s var(--ease);
	}
	.rates {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
		width: 100%;
		max-width: 360px;
	}
	.rate {
		display: grid;
		justify-items: center;
		gap: 2px;
		padding: 6px 4px;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--text);
		font-size: 0.8125rem;
		cursor: pointer;
		transition:
			background-color 0.15s var(--ease),
			border-color 0.15s var(--ease);
	}
	.rate:hover {
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	.again span:last-child {
		color: var(--danger);
	}
	.interval {
		font-size: 0.6875rem;
		color: var(--muted);
	}
	.feedback {
		position: absolute;
		bottom: 8px;
		left: 16px;
		right: 16px;
		min-height: 1.4em;
		margin: 0;
		color: var(--muted);
	}
	.end-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px;
	}
	@keyframes reveal {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}
	@media (max-width: 800px) {
		.demo {
			min-height: 340px;
		}
		.sheet {
			inset: 16px 8px 16px 16px;
			padding: 40px 12px 32px;
		}
	}
</style>

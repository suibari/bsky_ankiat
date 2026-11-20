<script lang="ts">
	import { Flame } from '@lucide/svelte';
	import { i18n, t } from '#lib/i18n/index.svelte.js';
	import type { Streak } from '#lib/study/streak.js';

	let { streak }: { streak: Streak } = $props();

	const weekday = (offset: number) => {
		const d = new Date();
		d.setDate(d.getDate() - (6 - offset));
		return new Intl.DateTimeFormat(i18n.locale, { weekday: 'narrow' }).format(d);
	};
</script>

<section class="streak panel" class:active={streak.activeToday}>
	<div class="figure">
		<Flame size={20} aria-hidden="true" />
		{#if streak.current > 0}
			<span class="label">
				{#each t('streak.days', { count: '\u0000' }).split('\u0000') as part, i (i)}
					{#if i > 0}<strong class="num">{streak.current}</strong>{/if}{part}
				{/each}
			</span>
		{:else}
			<span class="label">{t('streak.none')}</span>
		{/if}
	</div>
	<p class="sub">
		{streak.activeToday
			? t('streak.todayDone', { count: String(streak.reviewedToday) })
			: t('streak.todayPending')}
	</p>
	<ol class="week" aria-label={t('streak.week')}>
		{#each streak.lastWeek as active, i (i)}
			<li class:on={active} class:today={i === 6}>
				<span class="day">{weekday(i)}</span>
				<span class="mark"></span>
			</li>
		{/each}
	</ol>
</section>

<style>
	.streak {
		display: grid;
		grid-template-columns: 1fr auto;
		grid-template-areas: 'figure week' 'sub week';
		align-items: center;
		gap: 4px 24px;
		margin-bottom: 24px;
	}
	.figure {
		grid-area: figure;
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--muted);
	}
	.active .figure {
		color: var(--warn);
	}
	.label {
		color: var(--text);
		font-size: 1rem;
	}
	strong {
		margin: 0 2px;
		font-size: 2rem;
		font-weight: 500;
		line-height: 1;
	}
	.sub {
		grid-area: sub;
		margin: 0;
		color: var(--muted);
		font-size: 0.875rem;
	}
	.week {
		grid-area: week;
		display: flex;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.week li {
		display: grid;
		justify-items: center;
		gap: 4px;
	}
	.day {
		font-size: 0.75rem;
		color: var(--muted);
	}
	.mark {
		width: 20px;
		height: 24px;
		border: 1px solid var(--border-strong);
		border-radius: 4px;
		background: var(--surface);
	}
	.on .mark {
		border-color: var(--accent);
		background: var(--accent);
	}
	.today .day {
		color: var(--text);
		font-weight: 600;
	}
	@media (max-width: 560px) {
		.streak {
			grid-template-columns: 1fr;
			grid-template-areas: 'figure' 'sub' 'week';
			gap: 4px;
		}
		.week {
			margin-top: 12px;
		}
	}
</style>

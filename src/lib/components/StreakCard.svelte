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

<section class="panel streak" class:active={streak.activeToday}>
	<div class="flame" aria-hidden="true"><Flame size={28} /></div>
	<div class="text">
		<strong>{streak.current > 0 ? t('streak.days', { count: String(streak.current) }) : t('streak.none')}</strong>
		<span class="muted small">
			{streak.activeToday
				? t('streak.todayDone', { count: String(streak.reviewedToday) })
				: t('streak.todayPending')}
		</span>
	</div>
	<ol class="week" aria-label={t('streak.week')}>
		{#each streak.lastWeek as active, i (i)}
			<li class:on={active} class:today={i === 6}>
				<span class="dot"></span>
				<span class="day">{weekday(i)}</span>
			</li>
		{/each}
	</ol>
</section>

<style>
	.streak {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1rem;
		margin-bottom: 1.25rem;
	}
	.flame {
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--muted);
	}
	.active .flame {
		background: color-mix(in srgb, var(--warn) 16%, transparent);
		color: var(--warn);
	}
	.text {
		display: grid;
		flex: 1;
		min-width: 10rem;
	}
	strong {
		font-size: 1.125rem;
	}
	.week {
		display: flex;
		gap: 0.375rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.week li {
		display: grid;
		justify-items: center;
		gap: 0.125rem;
	}
	.dot {
		width: 0.875rem;
		height: 0.875rem;
		border-radius: 999px;
		background: var(--surface-2);
		border: 1px solid var(--border);
	}
	.on .dot {
		background: var(--accent);
		border-color: var(--accent);
	}
	.today .dot {
		outline: 2px solid var(--accent-soft);
		outline-offset: 1px;
	}
	.day {
		font-size: 0.6875rem;
		color: var(--muted);
	}
</style>

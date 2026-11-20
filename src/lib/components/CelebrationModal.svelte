<script lang="ts">
	import { Flame, PartyPopper } from '@lucide/svelte';
	import confetti from 'canvas-confetti';
	import { t } from '#lib/i18n/index.svelte.js';
	import Modal from './Modal.svelte';

	let {
		open = $bindable(false),
		streak,
		reviewedToday
	}: { open?: boolean; streak: number; reviewedToday: number } = $props();

	$effect(() => {
		if (!open) return;
		const colors = ['#2453c4', '#7ea4ff', '#f0b36a', '#6fd1a2', '#ffffff'];
		const fire = (x: number, angle: number) =>
			confetti({
				particleCount: 80,
				spread: 70,
				angle,
				origin: { x, y: 0.7 },
				colors,
				disableForReducedMotion: true,
				zIndex: 1000
			});
		fire(0.15, 60);
		fire(0.85, 120);
		const timer = setTimeout(() => fire(0.5, 90), 250);
		return () => clearTimeout(timer);
	});
</script>

<Modal bind:open title={t('celebrate.title')}>
	<div class="body">
		<div class="badge" aria-hidden="true"><PartyPopper size={36} /></div>
		<p class="streak">
			<Flame size={22} aria-hidden="true" />
			{streak > 1 ? t('celebrate.streak', { count: String(streak) }) : t('celebrate.first')}
		</p>
		<p class="muted">{t('celebrate.today', { count: String(reviewedToday) })}</p>
	</div>
	{#snippet footer()}
		<button class="btn secondary" onclick={() => (open = false)}>{t('celebrate.stay')}</button>
		<a class="btn" href="/">{t('celebrate.close')}</a>
	{/snippet}
</Modal>

<style>
	.body {
		display: grid;
		justify-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0 0.25rem;
		text-align: center;
	}
	.badge {
		display: grid;
		place-items: center;
		width: 4.5rem;
		height: 4.5rem;
		border-radius: 999px;
		background: var(--accent-soft);
		color: var(--accent);
	}
	.streak {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		margin: 0.5rem 0 0;
		font-size: 1.375rem;
		font-weight: 700;
		color: var(--warn);
	}
	p {
		margin: 0;
	}
</style>

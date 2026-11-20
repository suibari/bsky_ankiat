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
		<div class="badge" aria-hidden="true"><PartyPopper size={28} /></div>
		<p class="streak">
			<span class="flame"><Flame size={20} aria-hidden="true" /></span>
			{streak > 1 ? t('celebrate.streak', { count: String(streak) }) : t('celebrate.first')}
		</p>
		<p class="muted">{t('celebrate.today', { count: String(reviewedToday) })}</p>
	</div>
	{#snippet footer()}
		<button class="btn secondary" onclick={() => (open = false)}>{t('celebrate.stay')}</button>
		<!-- svelte-ignore a11y_autofocus -->
		<a class="btn" href="/" autofocus>{t('celebrate.close')}</a>
	{/snippet}
</Modal>

<style>
	.body {
		display: grid;
		justify-items: center;
		gap: 8px;
		padding: 8px 0 4px;
		text-align: center;
	}
	.badge {
		display: grid;
		place-items: center;
		width: 64px;
		height: 64px;
		border-radius: 999px;
		background: var(--accent-soft);
		color: var(--accent);
	}
	.streak {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin: 8px 0 0;
		font-size: 1.25rem;
		font-weight: 500;
		color: var(--text);
	}
	.flame {
		display: inline-flex;
		color: var(--warn);
	}
	p {
		margin: 0;
	}
</style>

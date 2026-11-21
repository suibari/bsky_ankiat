<script lang="ts">
	import { ArrowRight, CalendarClock, Database, Users } from '@lucide/svelte';
	import { openLogin } from '#lib/atproto/auth.svelte.js';
	import { t } from '#lib/i18n/index.svelte.js';
	import type { MessageKey } from '#lib/i18n/messages.js';
	import AppearanceSettings from './AppearanceSettings.svelte';
	import DemoCards from './DemoCards.svelte';
	import HelpModal from './HelpModal.svelte';

	/** 未ログインの `/`（docs/SPEC.md 3.7） */
	let { error }: { error?: string } = $props();
	let helpOpen = $state(false);

	const points: { icon: typeof Users; title: MessageKey; body: MessageKey }[] = [
		{ icon: CalendarClock, title: 'landing.p1.title', body: 'landing.p1.body' },
		{ icon: Users, title: 'landing.p2.title', body: 'landing.p2.body' },
		{ icon: Database, title: 'landing.p3.title', body: 'landing.p3.body' }
	];
</script>

<div class="landing">
	<section class="hero">
		<div class="intro">
			<h1>{t('app.tagline')}</h1>
			<p class="lead">{t('landing.lead')}</p>
			{#if error}<p class="error" role="alert">{t('login.error')}: {error}</p>{/if}
			<div class="cta">
				<a class="btn large" href="/search">{t('landing.findDecks')}<ArrowRight size={18} aria-hidden="true" /></a>
				<button class="btn large secondary" onclick={() => openLogin()}>{t('login.submit')}</button>
			</div>
			<p class="muted small">{t('landing.noLoginNeeded')}</p>
		</div>
		<DemoCards />
	</section>

	<ul class="points">
		{#each points as p (p.title)}
			{@const Icon = p.icon}
			<li>
				<span class="icon" aria-hidden="true"><Icon size={20} /></span>
				<h2>{t(p.title)}</h2>
				<p>{t(p.body)}</p>
			</li>
		{/each}
	</ul>

	<div class="bottom">
		<button class="about" onclick={() => (helpOpen = true)}>{t('help.about')}</button>
		<div class="prefs"><AppearanceSettings showTheme={false} /></div>
	</div>
	<HelpModal bind:open={helpOpen} />
</div>

<style>
	.landing {
		max-width: 1040px;
		margin: 0 auto;
		padding: 40px 32px 48px;
	}
	.hero {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		align-items: center;
		gap: 56px;
		min-height: min(560px, calc(100dvh - 56px - 81px));
	}
	h1 {
		margin: 0 0 20px;
		font-size: 2.25rem;
		font-weight: 500;
		line-height: 1.3;
		text-wrap: balance;
	}
	.lead {
		margin: 0 0 32px;
		color: var(--text-2);
		line-height: 1.8;
	}
	.cta {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 12px;
	}
	.points {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 32px;
		margin: 48px 0 0;
		padding: 40px 0 0;
		border-top: 1px solid var(--border);
		list-style: none;
	}
	.points h2 {
		margin: 12px 0 6px;
		font-size: 1rem;
		font-weight: 600;
	}
	.points p {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.7;
		color: var(--text-2);
	}
	.icon {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-sm);
		background: var(--accent-soft);
		color: var(--accent-ink);
	}
	.bottom {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: end;
		gap: 16px;
		margin-top: 48px;
	}
	.about {
		padding: 0;
		border: none;
		background: none;
		color: var(--accent-ink);
		font-size: 0.875rem;
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}
	.prefs {
		width: 240px;
	}
	@media (max-width: 800px) {
		.landing {
			padding: 24px 16px 40px;
		}
		.hero {
			grid-template-columns: 1fr;
			gap: 24px;
			min-height: 0;
		}
		h1 {
			font-size: 1.75rem;
		}
		.points {
			grid-template-columns: 1fr;
			gap: 24px;
			margin-top: 32px;
			padding-top: 32px;
		}
	}
</style>

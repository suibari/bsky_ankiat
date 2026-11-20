<script lang="ts">
	import { signIn } from '#lib/atproto/auth.svelte.js';
	import { t } from '#lib/i18n/index.svelte.js';
	import AppearanceSettings from './AppearanceSettings.svelte';
	import HandleInput from './HandleInput.svelte';
	import HelpModal from './HelpModal.svelte';

	let { error }: { error?: string } = $props();

	let handle = $state('');
	let submitting = $state(false);
	let submitError = $state<string | undefined>();
	let helpOpen = $state(false);

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!handle.trim()) return;
		submitting = true;
		submitError = undefined;
		try {
			await signIn(handle);
		} catch (err) {
			submitError = err instanceof Error ? err.message : String(err);
			submitting = false;
		}
	}
</script>

<main>
	<section class="intro">
		<div class="brand">
			<img src="/favicon.svg" alt="" width="40" height="40" />
			<span>AnkiAt</span>
		</div>
		<h1>{t('app.tagline')}</h1>

		<form {onsubmit}>
			<label for="handle">{t('login.handle')}</label>
			<div class="row">
				<HandleInput id="handle" bind:value={handle} placeholder={t('login.handlePlaceholder')} disabled={submitting} />
				<button class="btn" type="submit" disabled={submitting}>
					{submitting ? t('login.submitting') : t('login.submit')}
				</button>
			</div>
			<p class="note">{t('login.note')}</p>
			{#if submitError ?? error}
				<p class="error" role="alert">{t('login.error')}: {submitError ?? error}</p>
			{/if}
		</form>

		<button class="about" onclick={() => (helpOpen = true)}>{t('help.about')}</button>

		<div class="prefs"><AppearanceSettings showTheme={false} /></div>
	</section>

	<!-- 製品の見本: 単語帳のカード -->
	<div class="preview" aria-hidden="true">
		<div class="index-card sheet behind"></div>
		<div class="index-card sheet">
			<span class="deck">{t('login.preview.deck')}</span>
			<p class="q">{t('login.preview.front')}</p>
			<p class="a">{t('login.preview.back')}</p>
			<div class="rates">
				<span>{t('study.again')}</span>
				<span>{t('study.hard')}</span>
				<span class="on">{t('study.good')}</span>
				<span>{t('study.easy')}</span>
			</div>
		</div>
	</div>
	<HelpModal bind:open={helpOpen} />
</main>

<style>
	main {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		align-items: center;
		gap: 64px;
		max-width: 1040px;
		min-height: 100dvh;
		margin: 0 auto;
		padding: 48px 32px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 1.125rem;
		font-weight: 600;
	}
	h1 {
		margin: 32px 0 40px;
		font-size: 2.25rem;
		font-weight: 500;
		line-height: 1.3;
		text-wrap: balance;
	}
	label {
		display: block;
		margin-bottom: 8px;
		font-size: 0.875rem;
		color: var(--text-2);
	}
	.row {
		display: flex;
		gap: 8px;
	}
	.row .btn {
		height: 40px;
	}
	.note {
		margin: 8px 0 0;
		font-size: 0.8125rem;
		color: var(--muted);
	}
	.error {
		margin: 8px 0 0;
	}
	.about {
		margin-top: 24px;
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
		max-width: 240px;
		margin-top: 40px;
	}
	.preview {
		position: relative;
		height: 360px;
	}
	.sheet {
		position: absolute;
		inset: 24px 16px 24px 24px;
		display: grid;
		align-content: center;
		justify-items: center;
		gap: 16px;
		padding: 32px;
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
	}
	.a {
		margin: 0;
		padding-top: 16px;
		border-top: 1px dashed var(--border-strong);
		color: var(--text-2);
	}
	.rates {
		display: flex;
		gap: 8px;
		margin-top: 8px;
	}
	.rates span {
		white-space: nowrap;
		padding: 4px 10px;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm);
		background: var(--surface);
		font-size: 0.8125rem;
		color: var(--text-2);
	}
	.rates .on {
		border-color: var(--accent);
		color: var(--accent-ink);
		background: var(--accent-soft);
	}
	@media (max-width: 800px) {
		main {
			grid-template-columns: 1fr;
			gap: 32px;
			align-items: start;
			padding: 32px 16px;
		}
		h1 {
			margin: 24px 0 32px;
			font-size: 1.75rem;
		}
		.preview {
			height: 300px;
		}
		.sheet {
			padding: 48px 16px 24px;
		}
		.rates {
			gap: 4px;
		}
		.rates span {
			padding: 4px 8px;
			font-size: 0.75rem;
		}
	}
</style>

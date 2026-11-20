<script lang="ts">
	import { signIn } from '#lib/atproto/auth.svelte.js';
	import { t } from '#lib/i18n/index.svelte.js';
	import AppearanceSettings from './AppearanceSettings.svelte';

	let { error }: { error?: string } = $props();

	let handle = $state('');
	let submitting = $state(false);
	let submitError = $state<string | undefined>();

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
	<h1>AnkiAt</h1>
	<p class="muted">{t('app.tagline')}</p>

	<form {onsubmit}>
		<label for="handle">{t('login.handle')}</label>
		<input
			id="handle"
			class="field"
			bind:value={handle}
			placeholder={t('login.handlePlaceholder')}
			autocomplete="username"
			autocapitalize="off"
			spellcheck="false"
			required
		/>
		<button class="btn" type="submit" disabled={submitting}>
			{submitting ? t('login.submitting') : t('login.submit')}
		</button>
		<p class="muted small">{t('login.note')}</p>
		{#if submitError ?? error}
			<p class="error" role="alert">{t('login.error')}: {submitError ?? error}</p>
		{/if}
	</form>

	<AppearanceSettings showTheme={false} />
</main>

<style>
	main {
		max-width: 400px;
		margin: 12vh auto 0;
		padding: 0 16px;
	}
	h1 {
		margin-bottom: 0;
	}
	form {
		display: grid;
		gap: 0.5rem;
		margin: 2rem 0;
	}
	.small {
		font-size: 0.875rem;
		margin: 0;
	}
</style>

<script lang="ts">
	import { signIn } from '#lib/atproto/auth.svelte.js';
	import { t } from '#lib/i18n/index.svelte.js';
	import HandleInput from './HandleInput.svelte';

	let { error, id = 'handle' }: { error?: string; id?: string } = $props();

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

<form {onsubmit}>
	<label for={id}>{t('login.handle')}</label>
	<div class="row">
		<HandleInput {id} bind:value={handle} placeholder={t('login.handlePlaceholder')} disabled={submitting} />
		<button class="btn" type="submit" disabled={submitting}>
			{submitting ? t('login.submitting') : t('login.submit')}
		</button>
	</div>
	<p class="note">{t('login.note')}</p>
	{#if submitError ?? error}
		<p class="error" role="alert">{t('login.error')}: {submitError ?? error}</p>
	{/if}
</form>

<style>
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
</style>

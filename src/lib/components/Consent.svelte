<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.js';

	let { onaccept }: { onaccept: () => Promise<void> } = $props();
	let busy = $state(false);
	let error = $state<string>();

	async function accept() {
		busy = true;
		error = undefined;
		try {
			await onaccept();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
</script>

<section class="panel">
	<h1>{t('consent.title')}</h1>
	<p>{t('consent.body1')}</p>
	<p><strong>{t('consent.body2')}</strong></p>
	<p class="muted">{t('consent.body3')}</p>
	{#if error}<p class="error" role="alert">{t('deck.saveError')}: {error}</p>{/if}
	<button class="btn" disabled={busy} onclick={accept}>{t('consent.accept')}</button>
</section>

<style>
	h1 {
		font-size: 1.25rem;
		margin-top: 0;
	}
</style>

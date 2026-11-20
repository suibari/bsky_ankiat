<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.js';

	let {
		label,
		message,
		onconfirm,
		disabled = false
	}: { label: string; message: string; onconfirm: () => void; disabled?: boolean } = $props();

	let asking = $state(false);
</script>

{#if asking}
	<span class="confirm" role="alert">
		<span>{message}</span>
		<button
			class="btn danger"
			{disabled}
			onclick={() => {
				asking = false;
				onconfirm();
			}}>{label}</button
		>
		<button class="btn secondary" onclick={() => (asking = false)}>{t('deck.cancel')}</button>
	</span>
{:else}
	<button class="btn secondary danger-text" {disabled} onclick={() => (asking = true)}>{label}</button>
{/if}

<style>
	.confirm {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}
</style>

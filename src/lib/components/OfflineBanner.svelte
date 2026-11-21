<script lang="ts">
	import { WifiOff } from '@lucide/svelte';
	import { t } from '#lib/i18n/index.svelte.js';

	let online = $state(typeof navigator === 'undefined' ? true : navigator.onLine);
</script>

<svelte:window ononline={() => (online = true)} onoffline={() => (online = false)} />

{#if !online}
	<div class="offline" role="status">
		<WifiOff size={16} aria-hidden="true" />
		<span>{t('common.offline')}</span>
	</div>
{/if}

<style>
	.offline {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 8px 16px;
		background: var(--surface-2);
		border-bottom: 1px solid var(--border);
		color: var(--text-2);
		font-size: 0.875rem;
		text-align: center;
	}
	.offline :global(svg) {
		flex: none;
	}
</style>

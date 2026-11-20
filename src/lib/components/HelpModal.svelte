<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.js';
	import type { MessageKey } from '#lib/i18n/messages.js';
	import Modal from './Modal.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const sections = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
		title: `help.s${n}.title` as MessageKey,
		body: `help.s${n}.body` as MessageKey
	}));
</script>

<Modal bind:open title={t('help.title')}>
	{#each sections as s (s.title)}
		<section>
			<h3>{t(s.title)}</h3>
			<p>{t(s.body)}</p>
		</section>
	{/each}
	{#snippet footer()}
		<!-- svelte-ignore a11y_autofocus -->
		<button class="btn" onclick={() => (open = false)} autofocus>{t('help.close')}</button>
	{/snippet}
</Modal>

<style>
	section + section {
		margin-top: 20px;
	}
	h3 {
		margin: 0 0 4px;
		font-size: 0.9375rem;
		font-weight: 600;
	}
	p {
		margin: 0;
		font-size: 0.9375rem;
		color: var(--text-2);
	}
</style>

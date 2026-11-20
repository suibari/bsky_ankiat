<script lang="ts">
	import { sanitizeCardHtml } from '#lib/decks/sanitize.js';
	import { t } from '#lib/i18n/index.svelte.js';

	let { html }: { html: string } = $props();

	const safe = $derived(sanitizeCardHtml(html, { image: t('card.image'), audio: t('card.audio') }));
</script>

<div class="card-html">{@html safe}</div>

<style>
	.card-html {
		overflow-wrap: anywhere;
	}
	.card-html :global(.media-placeholder) {
		color: var(--muted);
		font-size: 0.875em;
	}
</style>

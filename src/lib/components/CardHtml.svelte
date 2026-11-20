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
	/* Anki の穴埋め（Cloze）: 答え・[...] の部分を強調する（Anki の CSS は取り込まないため） */
	.card-html :global(.cloze) {
		font-weight: 600;
		color: var(--accent-ink);
	}
	.card-html :global(.media-placeholder) {
		color: var(--muted);
		font-size: 0.875em;
	}
</style>

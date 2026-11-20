<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.js';
</script>

<footer>
	<span>AnkiAt</span>
	<span aria-hidden="true">·</span>
	<span>{t('footer.madeBy')} <a href="https://suibari.com" target="_blank" rel="noopener">suibari</a></span>
</footer>

<style>
	footer {
		display: flex;
		justify-content: center;
		gap: 8px;
		max-width: 760px;
		margin: 0 auto;
		padding: 24px 16px 32px;
		border-top: 1px solid var(--border);
		font-size: 0.8125rem;
		color: var(--muted);
	}
	a {
		color: var(--text-2);
	}
	a:hover {
		color: var(--accent-ink);
	}
</style>

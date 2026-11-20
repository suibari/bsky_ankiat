<script lang="ts">
	import { i18n, LOCALES, setLocale, t } from '#lib/i18n/index.svelte.js';
	import type { Locale } from '#lib/i18n/messages.js';

	const labels: Record<Locale, string> = { ja: '日本語', en: 'English' };
</script>

<label>
	{t('settings.language')}
	<select
		class="field"
		value={i18n.locale}
		onchange={(e) => setLocale(e.currentTarget.value as Locale)}
	>
		{#each LOCALES as locale (locale)}
			<option value={locale}>{labels[locale]}</option>
		{/each}
	</select>
</label>

<style>
	label {
		display: grid;
		gap: 0.25rem;
		max-width: 240px;
	}
</style>

<script lang="ts">
	import { i18n, LOCALES, setLocalePreference, t, type LocalePreference } from '#lib/i18n/index.svelte.js';
	import type { Locale } from '#lib/i18n/messages.js';
	import { setTheme, theme, type ThemePreference } from '#lib/theme.svelte.js';

	let { showTheme = true }: { showTheme?: boolean } = $props();

	const localeLabels: Record<Locale, string> = { ja: '日本語', en: 'English' };
	const themes: ThemePreference[] = ['system', 'light', 'dark'];
</script>

<div class="grid">
	{#if showTheme}
		<label>
			{t('settings.theme')}
			<select
				class="field"
				value={theme.preference}
				onchange={(e) => setTheme(e.currentTarget.value as ThemePreference)}
			>
				{#each themes as th (th)}
					<option value={th}>{t(`settings.theme.${th}`)}</option>
				{/each}
			</select>
		</label>
	{/if}
	<label>
		{t('settings.language')}
		<select
			class="field"
			value={i18n.preference}
			onchange={(e) => setLocalePreference(e.currentTarget.value as LocalePreference)}
		>
			<option value="system">{t('settings.language.system')}</option>
			{#each LOCALES as locale (locale)}
				<option value={locale}>{localeLabels[locale]}</option>
			{/each}
		</select>
	</label>
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.75rem;
	}
	label {
		display: grid;
		gap: 0.25rem;
		font-size: 0.875rem;
		color: var(--muted);
	}
	select {
		color: var(--text);
	}
</style>

<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import { ankiState } from '#lib/anki/state.svelte.js';
	import { currentUser, signOut } from '#lib/atproto/auth.svelte.js';
	import type { PreferencesRecord } from '#lib/atproto/records.js';
	import AppearanceSettings from '#lib/components/AppearanceSettings.svelte';
	import { formatDate } from '#lib/i18n/format.js';
	import { i18n, t } from '#lib/i18n/index.svelte.js';
	import { DEFAULT_NEW_CARDS_PER_DAY, getPreferences, savePreferences } from '#lib/study/data.js';

	const me = currentUser();
	let prefs = $state<PreferencesRecord>();
	let newCards = $state(DEFAULT_NEW_CARDS_PER_DAY);
	let saving = $state(false);
	let message = $state<string>();
	let error = $state<string>();

	getPreferences(me.did)
		.then((p) => {
			prefs = p;
			newCards = p.newCardsPerDay ?? DEFAULT_NEW_CARDS_PER_DAY;
		})
		.catch((e) => (error = e.message));

	async function save(e: SubmitEvent) {
		e.preventDefault();
		saving = true;
		message = error = undefined;
		try {
			prefs = await savePreferences(me.agent, me.did, {
				newCardsPerDay: Math.max(0, Math.min(9999, Math.round(newCards)))
			});
			message = t('settings.saved');
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			saving = false;
		}
	}
</script>

<h1>{t('nav.settings')}</h1>

<section class="panel">
	<h2>{t('settings.appearance')}</h2>
	<AppearanceSettings />
</section>

<section class="panel">
	<h2>{t('settings.study')}</h2>
	{#if prefs}
		<form onsubmit={save}>
			<label>
				{t('settings.newCardsPerDay')}
				<input class="field" type="number" min="0" max="9999" bind:value={newCards} />
			</label>
			<button class="btn" type="submit" disabled={saving}>
				{saving ? t('deck.saving') : t('deck.save')}
			</button>
			{#if message}<span class="muted small" role="status">{message}</span>{/if}
		</form>
	{:else}
		<p class="muted">{t('common.loading')}</p>
	{/if}
</section>

<a class="panel link-row" href="/settings/anki">
	<span>
		<strong>{t('settings.anki')}</strong>
		{#if ankiState.status === 'connected'}<span class="badge">{t('anki.connected')}</span>{/if}
		<span class="muted small block">{t('settings.ankiDescription')}</span>
	</span>
	<ChevronRight size={20} aria-hidden="true" />
</a>

<section class="panel">
	<h2>{t('settings.history')}</h2>
	<p class="small">{t('consent.body1')} {t('consent.body2')}</p>
	{#if prefs}
		<p class="muted small">
			{prefs.publicHistoryConsentAt
				? t('settings.consentAt', { date: formatDate(prefs.publicHistoryConsentAt, i18n.locale) })
				: t('settings.noConsent')}
		</p>
	{/if}
</section>

<section class="panel">
	<h2>{t('settings.account')}</h2>
	<p class="small muted">@{me.handle}</p>
	<button class="btn secondary" onclick={signOut}>{t('nav.signOut')}</button>
</section>

{#if error}<p class="error" role="alert">{t('deck.saveError')}: {error}</p>{/if}

<style>
	section,
	.link-row {
		margin: 0 0 1rem;
	}
	form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: end;
	}
	label {
		display: grid;
		gap: 0.25rem;
		font-size: 0.875rem;
		color: var(--muted);
	}
	input {
		width: 8rem;
		color: var(--text);
	}
	.link-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		color: var(--text);
		text-decoration: none;
	}
	.link-row:hover {
		border-color: var(--accent);
		color: var(--text);
	}
	.block {
		display: block;
	}
	.badge {
		margin-left: 0.5rem;
		font-size: 0.75rem;
		color: var(--success);
	}
	p {
		margin: 0 0 0.75rem;
	}
</style>

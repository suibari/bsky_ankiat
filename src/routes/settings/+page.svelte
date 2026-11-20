<script lang="ts">
	import { currentUser } from '#lib/atproto/auth.svelte.js';
	import type { PreferencesRecord } from '#lib/atproto/records.js';
	import LocaleSelect from '#lib/components/LocaleSelect.svelte';
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

<section>
	<LocaleSelect />
</section>

{#if prefs}
	<section>
		<form onsubmit={save}>
			<label>
				{t('settings.newCardsPerDay')}
				<input class="field" type="number" min="0" max="9999" bind:value={newCards} />
			</label>
			<button class="btn" type="submit" disabled={saving}>
				{saving ? t('deck.saving') : t('deck.save')}
			</button>
			{#if message}<span class="muted">{message}</span>{/if}
		</form>
	</section>

	<section>
		<h2>{t('settings.history')}</h2>
		<p>{t('consent.body1')} {t('consent.body2')}</p>
		<p class="muted">
			{prefs.publicHistoryConsentAt
				? t('settings.consentAt', { date: formatDate(prefs.publicHistoryConsentAt, i18n.locale) })
				: t('settings.noConsent')}
		</p>
	</section>
{/if}
{#if error}<p class="error" role="alert">{t('deck.saveError')}: {error}</p>{/if}

<style>
	section {
		margin: 1.5rem 0;
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
	}
	input {
		width: 8rem;
	}
	h2 {
		font-size: 1rem;
	}
</style>

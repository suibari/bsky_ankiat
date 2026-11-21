<script lang="ts">
	import { currentUser } from '#lib/atproto/auth.svelte.js';
	import { guestReviews } from '#lib/guest/store.js';
	import { importGuestReviews } from '#lib/guest/import.svelte.js';
	import { t } from '#lib/i18n/index.svelte.js';
	import { getPreferences } from '#lib/study/data.js';
	import Modal from './Modal.svelte';

	/** ログイン後、お試しの回答があれば引き継ぐか尋ねる（docs/SPEC.md 3.7） */
	const DISMISSED_KEY = 'ankiat.guestImportDismissed';

	const me = currentUser();
	let open = $state(false);
	let count = $state(0);
	let needsConsent = $state(true);
	let busy = $state(false);
	let error = $state<string>();

	async function check() {
		try {
			if (sessionStorage.getItem(DISMISSED_KEY)) return;
		} catch {
			// 保存できない環境では毎回尋ねる
		}
		const items = await guestReviews.all().catch(() => []);
		if (items.length === 0) return;
		count = items.length;
		needsConsent = !(await getPreferences(me.did).catch(() => ({}) as { publicHistoryConsentAt?: string }))
			.publicHistoryConsentAt;
		open = true;
	}
	check();

	async function accept() {
		busy = true;
		error = undefined;
		try {
			await importGuestReviews(me.agent, me.did);
			open = false;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	// 「今はしない」: このタブを閉じるまでは尋ねない。次にログインしたときにまた尋ねる
	$effect(() => {
		if (open) return;
		try {
			if (count > 0) sessionStorage.setItem(DISMISSED_KEY, '1');
		} catch {
			// 無視
		}
	});
</script>

<Modal bind:open title={t('guest.import.title')}>
	<p>{t('guest.import.body', { count: String(count) })}</p>
	{#if needsConsent}
		<div class="consent">
			<p><strong>{t('consent.title')}</strong></p>
			<p>{t('consent.body1')}</p>
			<p>{t('consent.body2')}</p>
			<p class="muted small">{t('consent.deletable')}</p>
		</div>
	{/if}
	{#if error}<p class="error" role="alert">{t('deck.saveError')}: {error}</p>{/if}
	{#snippet footer()}
		<button class="btn secondary" disabled={busy} onclick={() => (open = false)}>{t('guest.import.later')}</button>
		<button class="btn" disabled={busy} onclick={accept}>
			{busy ? t('guest.import.running') : needsConsent ? t('guest.import.acceptWithConsent') : t('guest.import.accept')}
		</button>
	{/snippet}
</Modal>

<style>
	.consent {
		margin-top: 16px;
		padding: 12px 16px;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
	}
	.consent p {
		margin: 0 0 8px;
	}
	.consent p:last-child {
		margin: 0;
	}
</style>

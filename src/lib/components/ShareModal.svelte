<script lang="ts">
	import { Copy, Download, Share2 } from '@lucide/svelte';
	import { APP_URL } from '#lib/atproto/config.js';
	import { currentUser } from '#lib/atproto/auth.svelte.js';
	import { getProfile } from '#lib/atproto/profile.js';
	import { loadAvatarBitmap } from '#lib/share/avatar.js';
	import { loadLogo, renderShareImage } from '#lib/share/card.js';
	import { blueskyComposeUrl, buildShareText } from '#lib/share/text.js';
	import { i18n, t } from '#lib/i18n/index.svelte.js';
	import type { Streak } from '#lib/study/streak.js';
	import Modal from './Modal.svelte';

	let {
		open = $bindable(false),
		streak,
		decks
	}: { open?: boolean; streak: Streak; decks: { name: string; count: number }[] } = $props();

	const me = currentUser();
	let blob = $state<Blob>();
	let previewUrl = $state<string>();
	let message = $state<string>();
	let error = $state<string>();

	const profileUrl = $derived(`${APP_URL || location.origin}/profile/${me.handle}`);
	const text = $derived(
		buildShareText({ reviewedToday: streak.reviewedToday, streak: streak.current, profileUrl }, i18n.locale)
	);
	const file = $derived(blob ? new File([blob], 'ankiat-today.png', { type: 'image/png' }) : undefined);
	const canShareFile = $derived(
		!!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
	);

	$effect(() => {
		if (!open) return;
		let cancelled = false;
		blob = undefined;
		message = error = undefined;
		(async () => {
			const [profile, avatar, logo] = await Promise.all([
				getProfile(me.did),
				loadAvatarBitmap(me.did),
				loadLogo()
			]);
			const image = await renderShareImage({
				dateLabel: new Intl.DateTimeFormat(i18n.locale, { dateStyle: 'full' }).format(new Date()),
				reviewedToday: streak.reviewedToday,
				unitLabel: t('share.unit'),
				streakLabel: streak.current >= 2 ? t('streak.days', { count: String(streak.current) }) : undefined,
				decks: [...decks].sort((a, b) => b.count - a.count),
				decksTitle: t('share.decksTitle'),
				displayName: profile?.displayName || me.handle,
				handle: me.handle,
				avatar,
				logo
			});
			if (cancelled) return;
			blob = image;
			previewUrl = URL.createObjectURL(image);
		})().catch((e) => (error = e instanceof Error ? e.message : String(e)));
		return () => {
			cancelled = true;
			if (previewUrl) URL.revokeObjectURL(previewUrl);
			previewUrl = undefined;
		};
	});

	async function share() {
		if (!file) return;
		try {
			await navigator.share({ files: [file], text });
		} catch (e) {
			// 共有シートを閉じただけ（AbortError）なら何もしない
			if ((e as Error).name !== 'AbortError') error = (e as Error).message;
		}
	}

	async function copyImage() {
		if (!blob) return;
		try {
			await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
			message = t('share.copied');
		} catch {
			error = t('share.copyFailed');
		}
	}

	async function copyText() {
		try {
			await navigator.clipboard.writeText(text);
			message = t('share.copied');
		} catch (e) {
			error = (e as Error).message;
		}
	}
</script>

<Modal bind:open title={t('share.title')}>
	<div class="preview">
		{#if previewUrl}
			<img src={previewUrl} alt={t('share.alt')} width="1200" height="630" />
		{:else if !error}
			<p class="muted small">{t('share.generating')}</p>
		{/if}
	</div>

	<textarea class="field text" readonly rows="3" value={text} aria-label={t('share.copyText')}></textarea>

	<div class="actions">
		{#if canShareFile}
			<button class="btn" onclick={share}><Share2 size={16} aria-hidden="true" />{t('share.share')}</button>
		{/if}
		<button class="btn secondary" disabled={!blob} onclick={copyImage}>
			<Copy size={16} aria-hidden="true" />{t('share.copyImage')}
		</button>
		{#if previewUrl}
			<a class="btn secondary" href={previewUrl} download="ankiat-today.png">
				<Download size={16} aria-hidden="true" />{t('share.save')}
			</a>
		{/if}
		<button class="btn secondary" onclick={copyText}>{t('share.copyText')}</button>
	</div>

	{#if !canShareFile && blob}
		<p class="hint muted small">
			{t('share.hint')}
			<a href={blueskyComposeUrl(text)} target="_blank" rel="noopener noreferrer">{t('share.bluesky')}</a>
		</p>
	{/if}
	{#if message}<p class="small" role="status">{message}</p>{/if}
	{#if error}<p class="error small" role="alert">{error}</p>{/if}
</Modal>

<style>
	.preview {
		display: grid;
		place-items: center;
		aspect-ratio: 1200 / 630;
		margin-bottom: 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		overflow: hidden;
	}
	img {
		width: 100%;
		height: auto;
		display: block;
	}
	.text {
		height: auto;
		padding: 8px 12px;
		resize: none;
		font-size: 0.875rem;
		color: var(--text-2);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 12px;
	}
	.hint {
		margin: 12px 0 0;
	}
	p {
		margin: 8px 0 0;
	}
</style>

<script lang="ts">
	import { Copy, Download } from '@lucide/svelte';
	import { APP_URL } from '#lib/atproto/config.js';
	import { currentUser } from '#lib/atproto/auth.svelte.js';
	import { getProfile } from '#lib/atproto/profile.js';
	import { loadAvatarBitmap } from '#lib/share/avatar.js';
	import { loadLogo, renderShareImage } from '#lib/share/card.js';
	import { buildShareText } from '#lib/share/text.js';
	import { i18n, t } from '#lib/i18n/index.svelte.js';
	import type { Streak } from '#lib/study/streak.js';
	import ShareDialog from './ShareDialog.svelte';

	/** 今日の学習のシェア（docs/SPEC.md 5章）。画像はブラウザ内で生成する */
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

	async function copyImage() {
		if (!blob) return;
		message = error = undefined;
		try {
			await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
			message = t('share.copied');
		} catch {
			error = t('share.copyFailed');
		}
	}
</script>

<ShareDialog
	bind:open
	bind:message
	bind:error
	title={t('share.title')}
	imageUrl={previewUrl}
	imageAlt={t('share.alt')}
	generating
	{text}
	copyValue={text}
	copyLabel={t('share.copyText')}
	{file}
	blueskyNote={t('share.blueskyNoImage')}
>
	{#snippet extra()}
		<button class="btn secondary" disabled={!blob} onclick={copyImage}>
			<Copy size={16} aria-hidden="true" />{t('share.copyImage')}
		</button>
		{#if previewUrl}
			<a class="btn secondary" href={previewUrl} download="ankiat-today.png">
				<Download size={16} aria-hidden="true" />{t('share.save')}
			</a>
		{/if}
	{/snippet}
</ShareDialog>

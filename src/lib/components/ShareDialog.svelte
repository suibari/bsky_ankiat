<script lang="ts">
	import { Copy, Share2 } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.js';
	import { blueskyComposeUrl } from '#lib/share/text.js';
	import Modal from './Modal.svelte';

	/**
	 * シェアの共通モーダル（docs/SPEC.md 5章「シェア」）。
	 * 画像のプレビュー・投稿する文章・ボタン（Bluesky に投稿 / 共有… / コピー）を同じ並びで出す。
	 * 追加の OAuth 権限は使わない。
	 */
	let {
		open = $bindable(false),
		title,
		imageUrl,
		imageAlt,
		fallbackImageUrl,
		generating = false,
		text,
		copyValue,
		copyLabel,
		file,
		blueskyNote,
		extra,
		message = $bindable<string | undefined>(),
		error = $bindable<string | undefined>()
	}: {
		open?: boolean;
		title: string;
		imageUrl?: string;
		imageAlt: string;
		/** 画像を読み込めなかったときに代わりに出す画像 */
		fallbackImageUrl?: string;
		generating?: boolean;
		/** 投稿する文章（Bluesky の投稿画面・共有メニューに渡す） */
		text: string;
		/** コピーボタンでコピーする文字列 */
		copyValue: string;
		copyLabel: string;
		/** 共有メニューに画像も渡すとき */
		file?: File;
		/** Bluesky に投稿するときの注意（画像が付かない場合など） */
		blueskyNote?: string;
		/** 画像のコピー・保存など、追加のボタン */
		extra?: Snippet;
		message?: string;
		error?: string;
	} = $props();

	let imageFailed = $state(false);
	$effect(() => {
		void imageUrl;
		imageFailed = false;
	});
	const shownImage = $derived(imageFailed ? fallbackImageUrl : imageUrl);

	const shareData = $derived<ShareData>(file ? { files: [file], text } : { text });
	const canShare = $derived(
		typeof navigator !== 'undefined' &&
			typeof navigator.share === 'function' &&
			(typeof navigator.canShare !== 'function' || navigator.canShare(shareData))
	);

	async function share() {
		try {
			await navigator.share(shareData);
		} catch (e) {
			// 共有メニューを閉じただけ（AbortError）なら何もしない
			if ((e as Error).name !== 'AbortError') error = (e as Error).message;
		}
	}

	async function copy() {
		error = message = undefined;
		try {
			await navigator.clipboard.writeText(copyValue);
			message = t('share.copied');
		} catch (e) {
			error = (e as Error).message;
		}
	}
</script>

<Modal bind:open {title}>
	<div class="preview">
		{#if shownImage}
			<img
				src={shownImage}
				alt={imageAlt}
				width="1200"
				height="630"
				onerror={() => {
					if (!imageFailed && fallbackImageUrl) imageFailed = true;
				}}
			/>
		{:else if generating && !error}
			<p class="muted small">{t('share.generating')}</p>
		{/if}
	</div>

	<textarea class="field text" readonly rows="4" value={text} aria-label={t('share.text')}></textarea>

	<div class="actions">
		<a class="btn" href={blueskyComposeUrl(text)} target="_blank" rel="noopener noreferrer">
			<svg viewBox="0 0 600 530" width="16" height="16" aria-hidden="true"
				><path
					fill="currentColor"
					d="M136 44c69 52 143 157 170 213 27-56 101-161 170-213 50-37 130-66 130 26 0 18-10 154-16 176-21 76-99 95-168 83 121 20 151 89 85 157-126 129-181-32-195-73l-6-17-6 17c-14 41-69 202-195 73-66-68-36-137 85-157-69 12-147-7-168-83C16 224 6 88 6 70c0-92 80-63 130-26z"
				/></svg
			>{t('share.bluesky')}
		</a>
		{#if canShare}
			<button class="btn secondary" onclick={share}><Share2 size={16} aria-hidden="true" />{t('share.share')}</button>
		{/if}
		{@render extra?.()}
		<button class="btn secondary" onclick={copy}><Copy size={16} aria-hidden="true" />{copyLabel}</button>
	</div>

	{#if blueskyNote}<p class="muted small">{blueskyNote}</p>{/if}
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
		display: block;
		width: 100%;
		height: auto;
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
	p {
		margin: 12px 0 0;
	}
</style>

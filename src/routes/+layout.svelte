<script lang="ts">
	import '../app.css';
	import { CircleHelp, House, Search, Settings } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { auth, initAuth, openLogin } from '#lib/atproto/auth.svelte.js';
	import { i18n, t } from '#lib/i18n/index.svelte.js';
	import Footer from '#lib/components/Footer.svelte';
	import GuestImportModal from '#lib/components/GuestImportModal.svelte';
	import HelpModal from '#lib/components/HelpModal.svelte';
	import Landing from '#lib/components/Landing.svelte';
	import LoginModal from '#lib/components/LoginModal.svelte';
	import LoginRequired from '#lib/components/LoginRequired.svelte';
	import OfflineBanner from '#lib/components/OfflineBanner.svelte';
	import UserChip from '#lib/components/UserChip.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	let helpOpen = $state(false);

	onMount(() => {
		document.documentElement.lang = i18n.locale;
		initAuth();
	});

	const memberNav = [
		{ href: '/', key: 'nav.home', icon: House },
		{ href: '/search', key: 'nav.search', icon: Search },
		{ href: '/settings', key: 'nav.settings', icon: Settings }
	] as const;
	const guestNav = [{ href: '/search', key: 'nav.search', icon: Search }] as const;

	/** 未ログインでも開ける画面（docs/SPEC.md 3.7） */
	const GUEST_PATHS = ['/search', '/deck/', '/study/', '/profile/', '/oauth/'];
	const guestAllowed = $derived(GUEST_PATHS.some((p) => page.url.pathname.startsWith(p)));

	const signedIn = $derived(auth.current.status === 'signedIn');
	const nav = $derived(signedIn ? memberNav : guestNav);

	const isCurrent = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
</script>

<OfflineBanner />

{#if auth.current.status === 'loading'}
	<main class="center"><p class="muted">{t('common.loading')}</p></main>
{:else}
	<header>
		<div class="bar">
			<a class="brand" href="/">
				<img src="/favicon.svg" alt="" width="28" height="28" />
				<span>AnkiAt</span>
			</a>
			<nav aria-label="main">
				{#each nav as item (item.href)}
					{@const Icon = item.icon}
					<a href={item.href} aria-current={isCurrent(item.href) ? 'page' : undefined}>
						<Icon size={18} aria-hidden="true" />
						<span class="label">{t(item.key)}</span>
					</a>
				{/each}
			</nav>
			<div class="me">
				<button class="icon-btn" onclick={() => (helpOpen = true)} aria-label={t('help.open')} title={t('help.open')}>
					<CircleHelp size={20} aria-hidden="true" />
				</button>
				{#if auth.current.status === 'signedIn'}
					<UserChip did={auth.current.did} handle={auth.current.handle} size={30} showName={false} />
				{:else}
					<button class="btn small" onclick={() => openLogin()}>{t('login.submit')}</button>
				{/if}
			</div>
		</div>
	</header>
	{#if auth.current.status === 'signedOut' && page.url.pathname === '/'}
		<Landing error={auth.current.error} />
	{:else}
		<main>
			{#if signedIn || guestAllowed}
				<!-- ログイン状態が変わったら画面を作り直す（各画面は初期化時に閲覧者を読む） -->
				{#key signedIn}{@render children()}{/key}
			{:else}
				<LoginRequired />
			{/if}
		</main>
	{/if}
	<Footer />
	<HelpModal bind:open={helpOpen} />
	{#if auth.current.status === 'signedIn'}
		{#key auth.current.did}<GuestImportModal />{/key}
	{:else}
		<LoginModal />
	{/if}
{/if}

<style>
	header {
		position: sticky;
		top: 0;
		z-index: 10;
		border-bottom: 1px solid var(--border);
		background: color-mix(in srgb, var(--surface) 92%, transparent);
		backdrop-filter: blur(8px);
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 16px;
		max-width: 760px;
		height: 56px;
		margin: 0 auto;
		padding: 0 16px;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-weight: 600;
		color: var(--text);
		text-decoration: none;
	}
	nav {
		display: flex;
		gap: 4px;
		margin-left: auto;
	}
	nav a {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 36px;
		padding: 0 12px;
		border-radius: var(--radius-sm);
		color: var(--text-2);
		text-decoration: none;
		font-size: 0.9375rem;
		transition:
			background-color 0.15s var(--ease),
			color 0.15s var(--ease);
	}
	nav a:hover {
		background: var(--surface-2);
		color: var(--text);
	}
	nav a[aria-current='page'] {
		color: var(--text);
		background: var(--surface-2);
		font-weight: 500;
	}
	.me {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	main {
		max-width: 760px;
		min-height: calc(100dvh - 56px - 81px);
		margin: 0 auto;
		padding: 32px 16px 64px;
	}
	.center {
		display: grid;
		place-items: center;
		min-height: 60vh;
	}
	@media (max-width: 560px) {
		.brand span,
		nav .label {
			display: none;
		}
		nav a {
			padding: 0 10px;
		}
	}
</style>

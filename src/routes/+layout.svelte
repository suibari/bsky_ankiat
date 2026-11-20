<script lang="ts">
	import '../app.css';
	import { CircleHelp, House, Search, Settings } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { auth, initAuth } from '#lib/atproto/auth.svelte.js';
	import { i18n, t } from '#lib/i18n/index.svelte.js';
	import HelpModal from '#lib/components/HelpModal.svelte';
	import Login from '#lib/components/Login.svelte';
	import UserChip from '#lib/components/UserChip.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const HELP_SEEN_KEY = 'ankiat.helpSeen';
	let helpOpen = $state(false);

	// 初めてログインしたときに一度だけヘルプを開く
	$effect(() => {
		if (auth.current.status !== 'signedIn') return;
		try {
			if (!localStorage.getItem(HELP_SEEN_KEY)) {
				helpOpen = true;
				localStorage.setItem(HELP_SEEN_KEY, '1');
			}
		} catch {
			// 保存できない環境では自動では開かない
		}
	});

	onMount(() => {
		document.documentElement.lang = i18n.locale;
		initAuth();
	});

	const nav = [
		{ href: '/', key: 'nav.home', icon: House },
		{ href: '/search', key: 'nav.search', icon: Search },
		{ href: '/settings', key: 'nav.settings', icon: Settings }
	] as const;

	const isCurrent = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
</script>

{#if auth.current.status === 'loading'}
	<main class="center"><p class="muted">{t('common.loading')}</p></main>
{:else if auth.current.status === 'signedOut'}
	<Login error={auth.current.error} />
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
				<UserChip did={auth.current.did} handle={auth.current.handle} size={30} showName={false} />
			</div>
		</div>
	</header>
	<main>
		{@render children()}
	</main>
	<HelpModal bind:open={helpOpen} />
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
		gap: 1rem;
		max-width: 760px;
		margin: 0 auto;
		padding: 0.5rem 16px;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 700;
		color: var(--text);
		text-decoration: none;
	}
	nav {
		display: flex;
		gap: 0.25rem;
		margin-left: auto;
	}
	nav a {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.625rem;
		border-radius: var(--radius-sm);
		color: var(--muted);
		text-decoration: none;
		font-size: 0.9375rem;
	}
	nav a:hover {
		background: var(--surface-2);
		color: var(--text);
	}
	nav a[aria-current='page'] {
		color: var(--accent);
		background: var(--accent-soft);
		font-weight: 600;
	}
	.me {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	main {
		max-width: 760px;
		margin: 0 auto;
		padding: 1.5rem 16px 4rem;
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
			padding: 0.5rem;
		}
	}
</style>

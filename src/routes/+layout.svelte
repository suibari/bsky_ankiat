<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { auth, initAuth } from '#lib/atproto/auth.svelte.js';
	import { i18n, t } from '#lib/i18n/index.svelte.js';
	import Login from '#lib/components/Login.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	onMount(() => {
		document.documentElement.lang = i18n.locale;
		initAuth();
	});

	const nav = [
		{ href: '/', key: 'nav.home' },
		{ href: '/search', key: 'nav.search' },
		{ href: '/settings', key: 'nav.settings' }
	] as const;
</script>


{#if auth.current.status === 'loading'}
	<main class="center"><p class="muted">{t('common.loading')}</p></main>
{:else if auth.current.status === 'signedOut'}
	<Login error={auth.current.error} />
{:else}
	<header>
		<a class="brand" href="/">AnkiAt</a>
		<nav>
			{#each nav as item (item.href)}
				<a href={item.href} aria-current={(item.href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(item.href)) ? 'page' : undefined}>
					{t(item.key)}
				</a>
			{/each}
		</nav>
	</header>
	<main>
		{@render children()}
	</main>
{/if}

<style>
	header {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.5rem;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 16px;
		border-bottom: 1px solid var(--border);
		background: var(--surface);
	}
	.brand {
		font-weight: 700;
		color: var(--text);
		text-decoration: none;
	}
	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
	}
	nav a {
		color: var(--muted);
		text-decoration: none;
	}
	nav a[aria-current='page'] {
		color: var(--text);
		font-weight: 600;
	}
	main {
		max-width: 720px;
		margin: 0 auto;
		padding: 1.5rem 16px;
	}
	.center {
		display: grid;
		place-items: center;
		min-height: 60vh;
	}
</style>

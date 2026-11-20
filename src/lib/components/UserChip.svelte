<script lang="ts">
	import { getProfile, profileUrl, type Profile } from '#lib/atproto/profile.js';

	let {
		did,
		handle,
		size = 24,
		showName = true
	}: { did: string; handle?: string; size?: number; showName?: boolean } = $props();

	let profile = $state<Profile>();
	$effect(() => {
		profile = undefined;
		getProfile(did).then((p) => (profile = p));
	});

	const shownHandle = $derived(profile?.handle ?? handle);
	const name = $derived(profile?.displayName || (shownHandle ? `@${shownHandle}` : did));
	const initial = $derived((profile?.displayName || shownHandle || '?').slice(0, 1).toUpperCase());
</script>

<a
	class="chip"
	href={profileUrl(shownHandle ?? did)}
	target="_blank"
	rel="noopener noreferrer"
	title={shownHandle ? `@${shownHandle}` : did}
>
	{#if profile?.avatar}
		<img src={profile.avatar} alt="" width={size} height={size} style:width="{size}px" style:height="{size}px" loading="lazy" />
	{:else}
		<span class="fallback" style:width="{size}px" style:height="{size}px" style:font-size="{size * 0.5}px" aria-hidden="true">{initial}</span>
	{/if}
	{#if showName}<span class="name">{name}</span>{/if}
</a>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 0;
		color: inherit;
		text-decoration: none;
	}
	.chip:hover .name {
		text-decoration: underline;
	}
	img,
	.fallback {
		flex: none;
		border-radius: 999px;
		object-fit: cover;
		background: var(--surface-2);
	}
	.fallback {
		display: grid;
		place-items: center;
		color: var(--muted);
		font-weight: 600;
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>

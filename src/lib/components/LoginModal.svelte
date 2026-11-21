<script lang="ts">
	import { loginPrompt } from '#lib/atproto/auth.svelte.js';
	import { t } from '#lib/i18n/index.svelte.js';
	import LoginForm from './LoginForm.svelte';
	import Modal from './Modal.svelte';
</script>

<Modal bind:open={loginPrompt.open} title={t('login.title')}>
	<p class="reason">{loginPrompt.reason ?? t('login.modalBody')}</p>
	{#if loginPrompt.open}<LoginForm id="modal-handle" />{/if}
	<p class="bluesky muted small">{t('login.noAccount')}</p>
</Modal>

<style>
	.reason {
		margin: 0 0 20px;
	}
	.bluesky {
		margin: 20px 0 0;
	}
</style>

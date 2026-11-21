<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.js';
	import LoginForm from './LoginForm.svelte';

	/** 未ログインでログインが必要な画面を開いたとき（docs/SPEC.md 3.7） */
</script>

<section class="panel">
	<h1>{t('login.required')}</h1>
	<p class="muted">{t('login.requiredBody')}</p>
	<LoginForm id="required-handle" />
</section>

<style>
	h1 {
		margin: 0 0 8px;
		font-size: 1.25rem;
	}
	p {
		margin: 0 0 20px;
	}
</style>

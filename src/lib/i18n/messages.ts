export const messages = {
	ja: {
		'app.tagline': 'AT Protocol で共有する暗記カード',
		'login.title': 'ログイン',
		'login.handle': 'ハンドル',
		'login.handlePlaceholder': 'example.bsky.social',
		'login.submit': 'ログイン',
		'login.submitting': 'リダイレクト中…',
		'login.note': 'お使いの PDS の認可画面に移動します。',
		'login.error': 'ログインに失敗しました',
		'nav.home': 'ホーム',
		'nav.search': 'デッキ検索',
		'nav.myDecks': 'マイデッキ',
		'nav.anki': 'Anki 連携',
		'nav.settings': '設定',
		'nav.signOut': 'ログアウト',
		'home.welcome': 'ようこそ、{handle} さん',
		'home.empty': '学習中のデッキはまだありません。',
		'common.loading': '読み込み中…',
		'settings.language': '表示言語'
	},
	en: {
		'app.tagline': 'Flashcards shared over the AT Protocol',
		'login.title': 'Sign in',
		'login.handle': 'Handle',
		'login.handlePlaceholder': 'example.bsky.social',
		'login.submit': 'Sign in',
		'login.submitting': 'Redirecting…',
		'login.note': "You'll be taken to your PDS to authorize AnkiAt.",
		'login.error': 'Sign-in failed',
		'nav.home': 'Home',
		'nav.search': 'Find decks',
		'nav.myDecks': 'My decks',
		'nav.anki': 'Anki sync',
		'nav.settings': 'Settings',
		'nav.signOut': 'Sign out',
		'home.welcome': 'Welcome, {handle}',
		'home.empty': "You aren't studying any decks yet.",
		'common.loading': 'Loading…',
		'settings.language': 'Language'
	}
} as const;

export type Locale = keyof typeof messages;
export type MessageKey = keyof (typeof messages)['ja'];

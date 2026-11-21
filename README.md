# AnkiAt

AT Protocol 上の暗記学習アプリ。デッキと回答履歴はすべて自分の PDS に保存され、AnkiAt のユーザー同士でデッキを共有できます。AnkiConnect 経由で Anki のデッキを取り込み、学習結果を双方向に同期します。独自のバックエンドサーバーや DB はありません（静的 SPA）。デッキの URL の OGP だけは Cloudflare Pages Functions で返します（`functions/`、状態は持たない）。

- 仕様書: [docs/SPEC.md](docs/SPEC.md)
- Lexicon: [lexicons/com/suibari/ankiat/](lexicons/com/suibari/ankiat/)
- 公開 URL: https://ankiat.suibari.com

## 開発

```sh
pnpm install
pnpm dev        # http://127.0.0.1:5173 （localhost ではなく 127.0.0.1 で開く）
pnpm test       # ユニットテスト・結合テスト（vitest）
pnpm check      # 型チェック（Functions も含む）
pnpm pages:dev  # ビルドして Pages Functions つきで動かす（http://127.0.0.1:8788、OGP の確認用）
```

開発中は OAuth のループバッククライアントとして動作します（`PUBLIC_APP_URL` が未設定のとき）。

## ビルドとデプロイ

```sh
pnpm build      # build/ に静的ファイルを出力
```

- `.env.production` の `PUBLIC_APP_URL` から `build/client-metadata.json` が生成されます。
- Cloudflare Pages にデプロイします。ビルド出力は `build/`、`functions/` は Pages が自動で Functions としてデプロイします（デッキの OGP 用。docs/SPEC.md 3.8）。
- 存在しないパスは `index.html` を返します（SPA のフォールバック。Pages は `404.html` がなければ自動でそうなります）。

| 環境変数 | 説明 |
|---|---|
| `PUBLIC_APP_URL` | 本番の公開 URL（末尾スラッシュなし）。OAuth の `client_id` に使う |
| `PUBLIC_HANDLE_RESOLVER` | ハンドル解決に使う XRPC サービス（既定: `https://bsky.social`） |

## 技術メモ

- SvelteKit 3（adapter-static）。`$lib` ではなく `#lib/...`（package.json の subpath imports）を使い、`.ts` は `.js` 拡張子で import する。
- 環境変数は `src/env.ts` の `defineEnvVars` で定義し、`$app/env/public` から読む。
- FSRS は ts-fsrs v6（FSRS-7、fuzz なし）。学習状態は回答履歴を再生して求める。
- AnkiConnect は旧 API（version 6）。Chrome の Local Network Access のため fetch に `targetAddressSpace: 'loopback'` を指定している。

# アイコン・OGP 画像の生成

`static/favicon.svg` が原本です（PWA の maskable アイコンだけは `scripts/icons/maskable.svg`）。PNG（favicon / apple-touch-icon / PWA）と OGP 画像は Playwright で書き出します。

```sh
cp static/favicon.svg scripts/icons/
node scripts/icons/render.mjs "$PWD/scripts/icons" "$PWD/static"   # PNG アイコン（maskable を含む）と og.png
```

Playwright はこのリポジトリの依存関係に含めていないので、実行する環境に別途用意してください。

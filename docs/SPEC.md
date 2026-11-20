# AnkiAt 仕様書（v1.0）

AT Protocol 上で動作する暗記学習アプリ。デッキ・回答履歴はすべてユーザーの PDS に保存し、独自のバックエンドサーバー・DB は持たない。

- 状態: **v1.0 確定**（2026-11-20）
- 最終更新: 2026-11-20

---

## 1. 確定済みの方針

| 項目 | 決定 |
|---|---|
| 提供形態 | 静的 Web アプリ（SPA）。公開 URL は `https://ankiat.suibari.com`（ホスティング先は未定） |
| 技術スタック | SvelteKit（adapter-static, SPA モード）+ TypeScript + Vite |
| 認証 | AT Protocol OAuth（`@atproto/oauth-client-browser`） |
| Lexicon NSID | `com.suibari.ankiat.*` |
| デッキ検索 | リレーの `com.atproto.sync.listReposByCollection` で所有者を列挙し、各 PDS から取得してクライアント側で検索 |
| 回答履歴の公開性 | 公開を許容。初回利用時に「回答履歴は公開されます」と明示して同意を取る |
| 復習アルゴリズム | FSRS（`ts-fsrs`） |
| カード内容 | テキスト/HTML（表・裏）のみ。画像・音声・Cloze 専用処理・ノートタイプ再現は対象外 |
| Anki ノート変換 | AnkiConnect `cardsInfo` が返すレンダリング済みの問題/解答 HTML を保存（ノートタイプは問わない） |
| 内容の同期方向 | Anki → PDS の一方向。Anki 連携デッキは AnkiAt 上で編集不可 |
| 回答結果の同期 | AnkiAt → Anki（`answerCards`）、Anki → AnkiAt（復習ログ取り込み）の双方向 |
| Anki 未接続時の回答 | PDS に保存し、次回 AnkiConnect 接続時に Anki へまとめて反映 |
| 過去の Anki 復習履歴 | 連携開始時にすべて取り込む |
| 他人のデッキ | AnkiAt 上で学習するのみ（自分の Anki への取り込み・フォークはしない） |
| カードの格納 | チャンクレコード（複数カードを 1 レコードに格納） |
| 回答履歴の格納 | セッション単位でまとめた 1 レコード |
| FSRS 状態 | PDS には保存しない。回答履歴から再計算して端末にキャッシュする |
| ネイティブデッキの入力 | プレーンテキスト（改行のみ反映、保存時にエスケープ済み HTML へ変換） |
| Anki サブデッキ | カードを直接持つデッキごとに、別々の AnkiAt デッキにする |
| Anki 連携デッキの出題順 | Anki が計算した期日を同期のたびに `ankiSync` に保存し、それで出題する（未接続時も）。保存後に AnkiAt で回答したカードは、次の同期まで AnkiAt の FSRS で期日を求める（2026-11-20 に変更。旧: 常に AnkiAt の FSRS） |
| 連携解除 | 解除時に「ネイティブデッキとして残す」か「削除する」かを選ぶ |
| 自動同期の頻度 | 起動時・接続時・接続中は 5 分ごと・学習セッション終了時・手動 |
| 検索非掲載 | `listed: false` で検索結果から外せる（データ自体は公開のまま、URL を知っていれば開ける） |
| UI 言語 | 日本語と英語（最初から i18n 対応） |
| 統計画面 | MVP には含めない（ホームに今日の件数だけを表示） |
| AnkiConnect API | 旧 API（version 6, ルートエンドポイント） |

---

## 2. 前提・制約

### 2.1 バックエンドなし
- サーバーで行う処理は一切ない。常駐プロセスもないため、「自動同期」は **AnkiAt をブラウザで開いている間だけ** 動く。
- 端末側のキャッシュは IndexedDB に置く。正（source of truth）は常に PDS。

### 2.2 PDS の書き込みレート制限（Bluesky 公式 PDS）
- 1 時間 5,000 ポイント／1 日 35,000 ポイント。作成 3・更新 2・削除 1 ポイント。
- `applyWrites` は 1 回あたり最大 200 操作で、アトミックに実行される。
- `applyWrites` / `createRecord` / `putRecord` のリクエストボディは最大 1,000,000 バイト（PDS 実装の `jsonLimit`）。レコード単体のサイズ上限は PDS 側には設けられていない。
- 設計上、書き込み回数を最小化する（チャンク化・セッション単位の履歴）。

### 2.3 AnkiConnect
- `http://127.0.0.1:8765`。Anki デスクトップが起動しているときだけ利用できる。
- AnkiConnect の旧 API（ルートエンドポイント、`version: 6`）を使う（→ 8 章 C1）。古い Anki / AnkiConnect のユーザーにも対応するため。
- **オリジンの許可**: `requestPermission` を呼ぶと Anki 側に許可ダイアログが出て、許可するとオリジンが `webCorsOriginList` に自動で追加される。ユーザーが設定ファイルを手で編集する必要はない。
- **API キー**: `requestPermission` の返り値 `requireApikey` が true なら、API キーの入力を求める。キーはリクエストボディの `key` で送る。端末のローカル（IndexedDB）にのみ保存し、PDS には保存しない。
- **Chrome の Local Network Access**: https のページから 127.0.0.1 に通信するには、ブラウザの `loopback-network` 権限が必要（初回にブラウザが許可を求める）。fetch には `targetAddressSpace: 'loopback'` を指定する（これにより混在コンテンツとしてのブロックも回避される）。権限が拒否された場合は、ブラウザ設定から許可する手順を案内する。
- 「AnkiConnect 認証」の実体は、ブラウザの権限 → `requestPermission` → （必要なら）API キーの入力 → `version` で接続確認、という一連の手順になる。
- Safari は https ページから `http://127.0.0.1` への通信をブロックするため、Anki 連携は **PC の Chrome / Firefox / Edge のみ対応**。それ以外のブラウザでは連携 UI を無効にして理由を表示する。

---

## 3. 機能一覧

### 3.1 認証
- ハンドル（または PDS の URL）を入力して OAuth でログインする。
- `client-metadata.json` を静的ファイルとしてホストする（`client_id` = `https://ankiat.suibari.com/client-metadata.json`、リダイレクト先 = `/oauth/callback`）。
- 開発時は OAuth のループバッククライアント（`http://127.0.0.1:5173`）として動作する。
- ハンドル解決には `https://bsky.social` の `resolveHandle` を使う（環境変数 `PUBLIC_HANDLE_RESOLVER` で変更可能）。公式のサンプルや他のアプリでも一般的な構成。ただし、ログイン時に入力したハンドルとユーザーの IP アドレスが Bluesky に送られる点は受け入れる。
- 要求するスコープは `atproto` に加えて、使用するコレクションごとの granular scope（`repo:com.suibari.ankiat.deck`、`repo:com.suibari.ankiat.cardChunk` など）。
- 将来は permission set（`include:com.suibari.ankiat.<名前>`）への移行を検討する。そのためには、`suibari.com` 側で Lexicon を公開する（DNS の `_lexicon` TXT レコードと `com.atproto.lexicon.schema` レコード）必要がある。
- granular scope に対応していない PDS では、`transition:generic` にフォールバックする。

### 3.2 デッキ管理（ネイティブデッキ）
- 作成・編集・削除: 名前・説明・タグ・言語。
- カードの追加・編集・削除: 表・裏はプレーンテキストで入力する。保存時に HTML エスケープして改行を `<br>` に変換し、HTML として保存する（Anki 由来のカードと同じ表示処理を通すため）。
- `listed` を切り替えられる（デフォルトは true）。
- 削除するとデッキレコードとすべてのチャンクを削除する。他ユーザーの回答履歴は残るが、AnkiAt 上では「削除されたデッキ」と表示する。

### 3.3 デッキ検索・閲覧
1. リレーの `com.atproto.sync.listReposByCollection?collection=com.suibari.ankiat.deck` で、デッキを持つ DID を列挙する（ページングあり）。
2. 各 DID の DID ドキュメントを解決して PDS のエンドポイントを得る（did:plc は plc.directory、did:web は `/.well-known/did.json`）。
3. 各 PDS の `com.atproto.repo.listRecords`（collection = deck）でデッキのメタデータを取得する。
4. 結果を IndexedDB にキャッシュし（TTL は暫定で 1 時間、手動で再読み込み可）、`listed: false` のデッキを除外したうえで、名前・説明・タグ・作者ハンドルに対してクライアント側で部分一致検索する。
5. デッキを開くとカードのチャンクを取得してプレビューし、「学習する」で自分の学習対象に追加する（→ 3.6 の `subscription`）。

### 3.4 学習
- 学習キューは「期日を過ぎた復習カード」と「新規カード（1 日の上限あり）」で構成する。
- 回答は 4 段階（Again / Hard / Good / Easy）で、FSRS の Rating 1〜4 と Anki の ease 1〜4 にそのまま対応させる。
- FSRS のパラメータは ts-fsrs のデフォルト値を使う（デッキ単位の最適化は将来の検討事項）。モデルは FSRS-7（ts-fsrs v6 のデフォルト）。
- 学習状態は回答履歴の再生で求めるため、**fuzz（間隔のランダム化）は無効** にする。有効にすると同じ履歴から同じ結果が得られなくなる。
- 実装上の暫定値（Anki の既定に合わせた）:
  - 1 日の区切りは午前 4 時（ローカル時刻）
  - 復習カードは、次の区切り（翌朝 4 時）より前に期日が来れば「今日の復習」に数える（Anki と同じ）
  - 1 日の新規カード上限はデッキごとに適用する
  - 学習ステップ中のカードは、期日の 20 分前から先取りして出題できる
  - 出題順: 期日の来た復習カード（期日順）→ 新規カード（デッキ内の順）。学習ステップのカードは期日が来たら割り込む
- 自分のデッキ（作成・取り込み）はホームに常に表示する。subscription は他人のデッキをホームに追加するためだけに使う。
- アウトボックスは送信前に reviewLog の rkey（TID）を割り当てて端末に保存し、再送時は同じ rkey で作成する（二重書き込みの防止）。
- 回答はまず IndexedDB のアウトボックスに入れ、以下のいずれかのタイミングで `reviewLog` レコードとして PDS に書き込む。
  - 未送信が 20 件たまったとき
  - セッションを終了したとき
  - `visibilitychange` でページが hidden になったとき
  - 最後の書き込みから 5 分経ったとき
- 1 レコードの上限は 500 件。超える場合は分割する。

### 3.5 HTML の表示
- 表示前に DOMPurify でサニタイズする（`script`、イベントハンドラ属性、外部リソースの読み込みを除去）。
- `<img>`・`<audio>`・`[sound:...]` は対象外のメディアなので「[画像]」「[音声]」というプレースホルダーに置き換える。
- Anki の `<style>` は除去し、AnkiAt 側の共通スタイルで表示する。容量を節約するため、Anki から取り込む時点でも `<style>` を除去して保存する。
- 解答 HTML に含まれる `<hr id=answer>` より前（問題部分）は、裏面を表示するときに表面と重複するため、表示時に区切って扱う（保存はレンダリング済み HTML をそのまま保存する）。

### 3.6 Anki 連携
#### 接続
- 設定画面で 2.3 の手順（ブラウザ権限 → `requestPermission` → API キー → `version`）を案内付きで実行する。
- `version` が 6 以上であることを確認する。必要な action（`answerCards` など）が使えない場合は、AnkiConnect の更新を促す。

#### インポート（連携開始）
1. `deckNamesAndIds` で Anki のデッキ一覧を表示し、ユーザーが選ぶ（複数選択可）。サブデッキはそれぞれ別の AnkiAt デッキとして扱い、`findCards` には `deck:"名前" -deck:"名前::*"` を指定して、そのデッキが直接持つカードだけを取得する。
2. `findCards` → `cardsInfo` でカードを取得し、問題/解答 HTML・cardId・note（noteId）・mod を得る。続けて `notesModTime` でノートの mod も取得する。
3. デッキレコードとチャンクレコードを `applyWrites` で作成する。
4. 過去の復習ログを `cardReviews(deck, 0)` で取得し、`reviewLog`（source = `anki`）として保存する（取り込むログの条件は手順「Anki 復習ログの取り込み」と同じ）。
5. `ankiSync` レコードに同期の基準点（watermark）を記録する。

#### 補足（実装上の決定）
- 取り込んだデッキの名前は、Anki のデッキ名の最後の階層（`英語::TOEIC` → `TOEIC`）。完全な名前は `source.ankiDeckName` に持つ。
- 自動での接続・同期は、**その端末で一度 Anki 連携を設定した場合だけ** 行う（設定済みのフラグと API キーを IndexedDB に保存）。未設定の端末で、Anki の許可ダイアログやブラウザの許可プロンプトが勝手に出ないようにするため。
- `cardReviews` は対象デッキ以外（サブデッキ）のログを含む可能性があるため、取り込むカードの ID で絞り込む。

#### 自動同期（AnkiConnect 接続中に定期実行）
実行タイミング: アプリ起動時・AnkiConnect 接続時・接続中は 5 分ごと・学習セッション終了時・手動実行ボタン。同時に複数の同期が走らないように、排他制御をする（複数タブで開いている場合も含め、Web Locks API を使う）。

デッキごとに以下の順で処理する。

0. **デッキの確認**: `deckNamesAndIds` で `ankiDeckId` から現在のデッキ名を求める（名前変更に追従するため）。デッキが見つからなければ、そのデッキの同期を中止してユーザーに知らせる。`cardReviews` と `getLatestReviewID` は存在しないデッキ名を渡すとデッキを作ってしまうため、この確認は必須。
1. **内容の同期（Anki → PDS）**: `findCards` で cardId の一覧を取り、`cardsInfo`（`fields: ["cardId","note","mod"]` で、レンダリングをしない軽い呼び出し）と `notesModTime` で、カードとノートそれぞれの mod を得る。ノートを編集してもカードの mod は変わらないため、両方と比較する必要がある。追加・変更があったカードだけ `cardsInfo` で完全に取得し直し、変更のあったチャンクとデッキレコードだけを `applyWrites` で書き換える。
2. **Anki 復習ログの取り込み**: `cardReviews(deck, lastImportedRevlogId)` で差分を取得し、`reviewLog`（source = `anki`）として保存する。行の形式は `[id, cid, usn, ease, ivl, lastIvl, factor, time, type]`。
   - 取り込むのは ease が 1〜4 のものだけ。ease 0 のもの（手動での期日変更・リセット）と、type が 4 以上のもの（Manual / Rescheduled）は FSRS の入力にならないので取り込まない。
   - `id` を `ankiRevlogId` と `reviewedAt` に、`time`（ミリ秒）を `durationMs` に、`cid` を `"a{cid}"` に変換する。
3. **AnkiAt 回答の反映**: `reviewLog` のうち rkey が `lastPushedReviewLogRkey` より大きく、かつ source = `ankiat` のエントリを、時系列順に `answerCards` で Anki に送る。
4. **基準点の更新**: `getLatestReviewID(deck)` で得た Anki の最新 revlog id を `lastImportedRevlogId` に、処理した最後の rkey を `lastPushedReviewLogRkey` にして `ankiSync` を更新する。手順 3 で Anki 側に生じた revlog は手順 4 で基準点より前になるため、再度取り込まれることはない。

制約事項（仕様として受け入れるもの）:
- `answerCards` は「いま回答した」ものとして Anki に記録される。そのため Anki 上の回答時刻と復習間隔は、実際に回答した時刻ではなく反映した時刻を基準に計算される。
- AnkiAt の FSRS と Anki のスケジューラ（SM-2 / FSRS の別、学習ステップ、卒業間隔などの設定）は一致しない。そのため Anki 連携デッキは、下記「Anki の期日」で Anki の計算結果を使う。
- Anki 連携デッキの回答ボタンには、次回の間隔を表示しない（間隔は Anki が決めるため）。
- 手順 3 と手順 4 の間（ミリ秒単位）に Anki 本体で回答したログは取り込まれない可能性がある。

#### Anki の期日（手順 5）
- 同期・インポートの最後に、各カードの期日を求めて `ankiSync.schedule` に保存する（`scheduleUpdatedAt` に計算時刻）。
- 期日は `getReviewsOfCards` の最後のログから求める: `ivl > 0` は「回答した日（午前 4 時区切り）+ ivl 日」の午前 4 時、`ivl < 0` は「回答時刻 + |ivl| 秒」（学習ステップ）。`cardsInfo` の `due` はコレクション作成日からの日数で絶対日付に直せないため使わない。
- `cardsInfo` の `queue` で、新規（0）は新規扱い、一時停止（-1）は出題しない、延期（-2 / -3）は翌日まで出題しない。
- 出題時は、自分の Anki 連携デッキに限り `schedule` を AnkiAt の FSRS より優先する。ただし `scheduleUpdatedAt` より後に AnkiAt で回答したカードは除く（次の同期で Anki が計算し直した期日に置き換わる）。

#### 連携解除
- ユーザーが「ネイティブデッキとして残す」か「削除する」かを選ぶ。
- 残す場合: デッキレコードから `source` を外し、`ankiSync` レコードを削除する。カード ID（`a{cardId}`）はそのまま残すので、既存の回答履歴は引き続き有効。以降は AnkiAt 上で編集できる。
- 削除する場合: 3.2 のデッキ削除と同じ処理をし、`ankiSync` も削除する。

---

## 4. データモデル（Lexicon）

レコードキー（rkey）の方針: デッキと回答履歴は TID。チャンクはデッキの rkey から決まる決定的なキー。

### 4.1 `com.suibari.ankiat.deck`（key: tid）
```jsonc
{
  "$type": "com.suibari.ankiat.deck",
  "name": "string (max 200 graphemes)",
  "description": "string (max 3000 graphemes, optional)",
  "tags": ["string"],            // max 10
  "langs": ["ja"],               // BCP-47, optional
  "listed": true,                // false なら検索結果に出さない（省略時は true）
  "cardCount": 1234,
  "chunkCount": 5,
  "source": {                    // optional。ない場合はネイティブデッキ
    "type": "anki",
    "ankiDeckId": 1700000000000, // Anki 側のデッキ ID（名前変更に追従するため）
    "ankiDeckName": "英単語::TOEIC"
  },
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### 4.2 `com.suibari.ankiat.cardChunk`（key: `{deckRkey}-{index}`）
```jsonc
{
  "$type": "com.suibari.ankiat.cardChunk",
  "deck": "at-uri",
  "index": 0,
  "cards": [
    {
      "id": "string",            // デッキ内で一意かつ再利用しない ID。ネイティブ: TID、Anki: "a{cardId}"
      "front": "string (HTML)",
      "back": "string (HTML)",
      "tags": ["string"],        // optional
      "anki": { "cardId": 0, "noteId": 0, "mod": 0, "noteMod": 0 }  // optional。mod / noteMod は Unix 秒
    }
  ],
  "updatedAt": "datetime"
}
```
- 1 チャンクの JSON は約 100KB 以下を目安とし、超えたら新しいチャンクを作る。
- 新しいカードは末尾のチャンクに追加する。削除しても他のチャンクへ詰め直しはしない（書き込みを最小化するため）。空になったチャンクは残す（`chunkCount` の連番を保つため）。
- チャンクとデッキレコード（cardCount / chunkCount / updatedAt）は、可能な限り同じ `applyWrites` でアトミックに更新する。
- ただし 1 回のリクエストは最大 1,000,000 バイトなので、1 回で書けるチャンクは約 8 個まで。それを超える場合（大きなデッキの初回インポートなど）は複数回に分け、**チャンクを先に、デッキレコードを最後に** 書く。読む側は `chunkCount` を信頼するので、書き込みの途中で読まれても、まだ書き終えていないチャンクは見えない。
- 読む側は deck.chunkCount をもとに `getRecord` を並列に呼び出して取得する。

### 4.3 `com.suibari.ankiat.reviewLog`（key: tid）
```jsonc
{
  "$type": "com.suibari.ankiat.reviewLog",
  "deck": "at-uri",              // 他人のデッキでもよい
  "source": "ankiat" | "anki",
  "entries": [
    {
      "cardId": "string",        // cardChunk.cards[].id
      "rating": 3,               // 1=Again 2=Hard 3=Good 4=Easy
      "reviewedAt": "datetime",
      "durationMs": 5200,        // optional
      "ankiRevlogId": 0          // source=anki のときのみ。重複排除に使う
    }
  ],                             // max 500
  "createdAt": "datetime"
}
```
- FSRS 状態は、自分の全 `reviewLog` をカードごとに reviewedAt 順で再生して計算し、IndexedDB にキャッシュする。
- 同じ ankiRevlogId が重複していたら 1 件として扱う（再送などに備えた安全策）。

### 4.4 `com.suibari.ankiat.subscription`（key: tid）
ホームに追加した他人のデッキ（自分のデッキは subscription なしで常にホームに表示する）。
```jsonc
{ "$type": "com.suibari.ankiat.subscription", "deck": "at-uri", "createdAt": "datetime" }
```

### 4.5 `com.suibari.ankiat.ankiSync`（key: `{deckRkey}`）
Anki 連携デッキごとの同期状態。
```jsonc
{
  "$type": "com.suibari.ankiat.ankiSync",
  "deck": "at-uri",
  "lastImportedRevlogId": 0,
  "lastPushedReviewLogRkey": "tid",
  "lastSyncedAt": "datetime"
}
```

### 4.6 `com.suibari.ankiat.preferences`（key: `self`）
```jsonc
{
  "$type": "com.suibari.ankiat.preferences",
  "newCardsPerDay": 20,
  "publicHistoryConsentAt": "datetime"
}
```

---

## 5. 画面構成

UI の文字列はすべて i18n の辞書（ja / en）で管理する。初期言語はブラウザの言語設定に従い、設定画面で切り替えられる。

1. ログイン: ハンドル入力時に、Bluesky の公開 AppView（`app.bsky.actor.searchActorsTypeahead`）でアカウントの候補を表示する（入力中の文字列が Bluesky に送られる）
2. ホーム: 自分のデッキと、ホームに追加した他人のデッキの一覧。それぞれ今日の新規・復習数と「学習する」。新しいデッキの作成、自分のデッキの削除、他人のデッキを「ホームから外す」もここで行う（2026-11-20 に「マイデッキ」画面を廃止して統合）
3. 学習画面: カードを表示 → 裏面を表示 → 4 段階で回答
4. デッキ検索
5. デッキ詳細: メタデータ、カード一覧、学習する。自分のデッキはメタデータ・カードの編集と削除、他人のデッキは「ホームに追加 / ホームから外す」
6. 新しいデッキ
7. Anki 連携: 接続設定、デッキのインポート、同期状態、手動同期、連携解除
8. 設定: 表示（テーマ・言語。既定はシステム設定に従う）、1 日の新規カード上限、Anki 連携（`/settings/anki`）、回答履歴の公開についての説明、アカウント（ログアウト、AnkiAt のデータの削除）
9. プロフィール（`/profile/{ハンドルまたは DID}`）: 公開された回答履歴から計算したスタッツ（総回答数・学習日数・連続日数・最長連続・学習したカード数・正答率）、直近 30 日の回答数のグラフ、よく学習しているデッキ、作成したデッキ。アバターをクリックするとこのページを開く
10. ヘルプ: 初回ログイン時に一度だけ自動で開く

#### AnkiAt のデータの削除
- 確認のためハンドルの入力を求める。
- PDS の `com.suibari.ankiat.*` の全レコードを削除する（デッキを最初に削除）。端末の IndexedDB と AnkiAt の localStorage も消し（テーマと言語は残す）、ログアウトする。
- Bluesky のアカウントや投稿には触れない。ほかのサービスがすでに取得した写しは残る場合がある旨を表示する。

## 6. MVP の範囲外（将来の検討事項）
- 統計画面（学習量グラフ・正答率）
- 画像・音声などのメディア
- Cloze 専用の出題処理、ノートタイプの再現
- 他人のデッキのフォーク、自分の Anki への取り込み
- デッキごとの FSRS パラメータ最適化
- スマホ向け PWA 化

## 7. 検証結果（2026-11-20）
| # | 内容 | 結果 |
|---|---|---|
| V1 | リレーの `listReposByCollection` をブラウザから呼べるか | ✅ bsky.network / relay1.us-east / relay1.us-west のいずれも 200 で、`Access-Control-Allow-Origin: *`。plc.directory と PDS の `listRecords` も同じく CORS で許可されており、`applyWrites` の preflight も `authorization, content-type, dpop` ヘッダーを許可している |
| V2 | PDS のレコードサイズ上限 | ✅ レコード単体の上限はない。書き込み系 API のリクエストボディが最大 1,000,000 バイト（`applyWrites` は最大 200 操作）。チャンクの目安は 100KB のまま、1 回の `applyWrites` で約 8 チャンクまでとする（4.2 に反映） |
| V3 | AnkiConnect の API | ✅ 必要な action はすべて存在する。ただし設計を 3 点修正した: ① ノートの編集はカードの mod に反映されないので `notesModTime` も使う、② 履歴の差分取得は `cardReviews(deck, startID)` と `getLatestReviewID` を使う（存在しないデッキ名だとデッキを作ってしまうので、事前に確認が必要）、③ オリジンの許可は `requestPermission` で自動化できる |
| V4 | OAuth の granular scope | ✅ `repo:<collection>` 形式の granular scope と、permission set（`include:`）が仕様化されている。MVP では `repo:` を列挙し、未対応の PDS では `transition:generic` にフォールバックする。主要な PDS での実際の動作は、実装の最初の段階で確かめる |
| V5 | Chrome のローカル通信制限 | ⚠️ Chrome の Local Network Access により、`loopback-network` 権限の許可（初回に表示されるプロンプト）と、fetch での `targetAddressSpace: 'loopback'` の指定が必要（2.3 に反映） |

## 8. 決定事項の記録
- **C1** AnkiConnect は 2026 年に作り直され、Anki 26.08 以降が必要になった。新しい v1 API（JSON-RPC, `/api/v1`）が推奨されている一方、旧 API（version 6）も引き続きサポートされている。→ **決定: 旧 API（version 6）を採用する**。古い Anki / AnkiConnect を使っているユーザーにも対応するため。

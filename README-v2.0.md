# Engineer OS v2.0 — Mastery Edition

Engineer OS v2.0 は、資格合格だけを目的にせず、実務・障害対応・設計判断まで含めて学習するための完成基礎版です。

## v2.0 の主な強化

- 14分野 / 98単元 / Level 1〜5
- 5,870問の問題バンク
- Level 1: 40問/単元、Level 2: 50問/単元、Level 3: 60問/単元、Level 4: 75問/単元、Level 5: 90問/単元を目安に収録
- 通常演習もLevelに応じて10〜20問を出題
- 未定着・復習期限・弱点を優先しながらランダム出題
- 選択肢シャッフル
- 正解/不正解に関係なく詳細解説
- 実務判断、トラブルシュート、設計、セキュリティ、面接、高難度試験向け問題を混在
- 既存のMastery、復習、学習時間、Glossary、Career OS、Tech Radar、PWA/offline基盤を維持
- 大規模問題バンク同期のためcontent:syncをバッチ化

## 問題設計の考え方

Engineer OSのREADYは「資格試験の丸暗記」ではなく、以下を説明・判断できる状態を目標にします。

1. What — 何か
2. Why — なぜそうなるか
3. When — いつ使うか
4. Failure — 壊れたら何を見るか
5. Trade-off — 何を犠牲にするか
6. Security — どんなリスクがあるか
7. Operations — どう監視・復旧するか
8. Design — どう設計判断するか

※ 実際の資格合格や市場価値を保証するものではありません。試験ガイドやクラウド仕様は更新されるため、Tech Radarと公式情報確認を併用してください。

## 更新手順

1. 既存の `.env.local` をv2.0へコピー
2. `npm.cmd install`
3. `npm.cmd run content:sync`
4. `npm.cmd run dev`
5. 確認後GitHubへpush → Vercel自動デプロイ

v1.2のSQLを実行済みなら、v2.0専用の追加SQLは不要です。

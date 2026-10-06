# 登山裝備重量試算 App

勾選這次要帶的裝備，即時算出總重；可存成歷史紀錄、匯出圖片。手機、電腦都能用，登入 Google 後紀錄自動同步。

**App 網址：** https://zzpowertw.github.io/gear-tracker/

## 安裝到手機主畫面

- **iPhone（Safari）**：打開網址 → 下方「分享」按鈕 → 「加入主畫面」
- **Android（Chrome）**：打開網址 → 右上角「⋮」 → 「安裝應用程式」或「加到主畫面」
- **電腦（Chrome / Edge）**：網址列右邊的「安裝」小圖示

裝好之後就像一般 App 一樣從主畫面打開，沒網路也能開。

## 檔案說明

| 檔案 | 用途 |
|---|---|
| `gear-data.js` | **裝備清單**：品名、顏色、重量、預設勾選。要新增/修改裝備改這裡 |
| `app.jsx` | 畫面與計算邏輯 |
| `storage.js` | 紀錄存取（本機 / Firebase 雲端） |
| `firebase-config.js` | 雲端同步設定；留空 = 只存在這台裝置 |
| `firestore.rules` | 雲端資料庫的權限規則（只有你自己能讀寫） |
| `index.html` / `manifest.webmanifest` / `sw.js` / `icons/` | 讓它成為可安裝、可離線使用的 App |
| `CHANGELOG.md` | 版本紀錄 |

## 更新流程

改好檔案 → commit → push 到 `main`，GitHub Pages 約 1 分鐘後自動更新網站。
手機上的 App 下次打開（有網路時）就會拿到新版。

## 本機預覽

```bash
python -m http.server 8765
```

然後打開 http://localhost:8765

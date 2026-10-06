# 登山裝備重量試算 App

自己建立裝備清單（像記帳 App：選類別 → 填名稱、附註、重量），勾選這次要帶的裝備即時算出總重；可存成歷史紀錄、匯出圖片、備份。手機、電腦都能用，每個人用自己的 Google 帳號登入，清單和紀錄各自同步。

**App 網址：** https://zzpowertw.github.io/gear-tracker/

## 安裝到手機主畫面

- **iPhone（Safari）**：打開網址 → 下方「分享」按鈕 → 「加入主畫面」
- **Android（Chrome）**：打開網址 → 右上角「⋮」 → 「安裝應用程式」或「加到主畫面」
- **電腦（Chrome / Edge）**：網址列右邊的「安裝」小圖示

裝好之後就像一般 App 一樣從主畫面打開，沒網路也能開。

## 檔案說明

| 檔案 | 用途 |
|---|---|
| `gear-data.js` | 預設大類別、範例裝備清單（裝備本身在 App 內新增/修改） |
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

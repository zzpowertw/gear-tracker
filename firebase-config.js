// ============================================================
// Firebase 雲端同步設定
// 留空 = 本機模式（紀錄只存在這台裝置）
// 填入 Firebase 專案設定後 = 用 Google 登入，手機/電腦自動同步
// 這些值不是密碼，放在公開網站上是正常的；資料安全由 firestore.rules 保護
// ============================================================
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

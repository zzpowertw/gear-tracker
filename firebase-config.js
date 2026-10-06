// ============================================================
// Firebase 雲端同步設定
// 留空 = 本機模式（紀錄只存在這台裝置）
// 填入 Firebase 專案設定後 = 用 Google 登入，手機/電腦自動同步
// 這些值不是密碼，放在公開網站上是正常的；資料安全由 firestore.rules 保護
// ============================================================
export const firebaseConfig = {
  apiKey: "AIzaSyBPE4sRN5J4ZVHfn-K-bB_QOa1VMjT-miU",
  authDomain: "gear-tracker-897b9.firebaseapp.com",
  projectId: "gear-tracker-897b9",
  storageBucket: "gear-tracker-897b9.firebasestorage.app",
  messagingSenderId: "179318252097",
  appId: "1:179318252097:web:a7eebe9a60747077831cc0",
  measurementId: "G-CW3VB97CCL",
};

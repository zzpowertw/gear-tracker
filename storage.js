// ============================================================
// 資料存取層
// 三種資料，每個帳號各自一份：
//   gear     — 裝備清單        users/{uid}/gear/{id}
//   records  — 歷史紀錄        users/{uid}/records/{id}
//   meta     — 設定（自訂類別、目標重量、上次備份時間） users/{uid}/meta/settings
// - 沒登入 → 存在這台裝置的 localStorage（本機模式）
// - 已登入 → Firestore，各裝置即時同步；開了離線快取，沒網路也能存，連線後自動補傳
// ============================================================
import { firebaseConfig } from "./firebase-config.js";

const FIREBASE_VER = "11.10.0";
// records 沿用 v1.x 的 key，舊的本機紀錄才讀得到
const LOCAL_KEYS = {
  records: "gear-weight-records",
  gear: "gear-reckoner-gear",
  meta: "gear-reckoner-meta",
};
export const COLLECTIONS = Object.keys(LOCAL_KEYS);

export const cloudEnabled = Boolean(firebaseConfig && firebaseConfig.apiKey);

// Firestore 不接受 undefined，用 JSON 來回轉一次清掉
const clean = (obj) => JSON.parse(JSON.stringify(obj));

// ---------- 本機 ----------
function readLocal(name) {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEYS[name])) || [];
  } catch (e) {
    return [];
  }
}

function writeLocal(name, docs) {
  localStorage.setItem(LOCAL_KEYS[name], JSON.stringify(docs));
  window.dispatchEvent(new Event("local-data-changed"));
}

// ---------- Firebase（只有啟用時才下載） ----------
let fbPromise = null;
function loadFirebase() {
  if (!fbPromise) {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VER}`;
    fbPromise = Promise.all([
      import(`${base}/firebase-app.js`),
      import(`${base}/firebase-auth.js`),
      import(`${base}/firebase-firestore.js`),
    ]).then(async ([appMod, authMod, fsMod]) => {
      const app = appMod.initializeApp(firebaseConfig);
      const auth = authMod.getAuth(app);
      const db = fsMod.initializeFirestore(app, {
        localCache: fsMod.persistentLocalCache({
          tabManager: fsMod.persistentMultipleTabManager(),
        }),
      });
      // 若之前走「整頁跳轉」登入，回來時在這裡接收結果
      authMod.getRedirectResult(auth).catch((e) => console.warn("redirect result", e));
      return { authMod, fsMod, auth, db };
    });
  }
  return fbPromise;
}

function col(fb, user, name) {
  return fb.fsMod.collection(fb.db, "users", user.uid, name);
}

// ---------- 登入 ----------

/** 監聽登入狀態。cb(user|null)。回傳取消監聽的函式。 */
export function watchAuth(cb) {
  if (!cloudEnabled) {
    cb(null);
    return () => {};
  }
  let unsub = () => {};
  let cancelled = false;
  loadFirebase()
    .then((fb) => {
      if (!cancelled) unsub = fb.authMod.onAuthStateChanged(fb.auth, cb);
    })
    .catch((e) => {
      console.error("Firebase 載入失敗", e);
      cb(null);
    });
  return () => {
    cancelled = true;
    unsub();
  };
}

export async function signIn() {
  const fb = await loadFirebase();
  const provider = new fb.authMod.GoogleAuthProvider();
  try {
    await fb.authMod.signInWithPopup(fb.auth, provider);
  } catch (e) {
    // 彈出視窗被擋（部分手機/安裝成 App 時）→ 改用整頁跳轉登入
    if (
      e.code === "auth/popup-blocked" ||
      e.code === "auth/operation-not-supported-in-this-environment"
    ) {
      await fb.authMod.signInWithRedirect(fb.auth, provider);
    } else if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") {
      throw e;
    }
  }
}

export async function signOut() {
  const fb = await loadFirebase();
  await fb.authMod.signOut(fb.auth);
}

// ---------- 資料 ----------

/** 監聽一種資料的全部文件。cb(docs)。回傳取消監聽的函式。 */
export function watch(user, name, cb) {
  if (!user) {
    const emit = () => cb(readLocal(name));
    emit();
    window.addEventListener("local-data-changed", emit);
    window.addEventListener("storage", emit); // 同一台電腦其他分頁的變動
    return () => {
      window.removeEventListener("local-data-changed", emit);
      window.removeEventListener("storage", emit);
    };
  }

  let unsub = () => {};
  let cancelled = false;
  loadFirebase().then((fb) => {
    if (cancelled) return;
    migrateLocalToCloud(fb, user, name);
    unsub = fb.fsMod.onSnapshot(
      col(fb, user, name),
      (snap) => cb(snap.docs.map((d) => d.data())),
      (e) => console.error(`讀取雲端 ${name} 失敗`, e)
    );
  });
  return () => {
    cancelled = true;
    unsub();
  };
}

/** 新增或覆寫多筆文件（每筆要有 id） */
export async function putMany(user, name, docs) {
  if (docs.length === 0) return;
  if (!user) {
    const ids = new Set(docs.map((d) => d.id));
    writeLocal(name, [...readLocal(name).filter((d) => !ids.has(d.id)), ...docs.map(clean)]);
    return;
  }
  const fb = await loadFirebase();
  // Firestore 一批最多 500 筆
  for (let i = 0; i < docs.length; i += 400) {
    const batch = fb.fsMod.writeBatch(fb.db);
    docs.slice(i, i + 400).forEach((d) => batch.set(fb.fsMod.doc(col(fb, user, name), d.id), clean(d)));
    // 不等待伺服器回應：離線時寫入會先進本機快取，畫面立即更新，連線後自動上傳
    batch.commit().catch((e) => console.error(`雲端儲存 ${name} 失敗`, e));
  }
}

export const put = (user, name, doc) => putMany(user, name, [doc]);

export async function remove(user, name, id) {
  if (!user) {
    writeLocal(name, readLocal(name).filter((d) => d.id !== id));
    return;
  }
  const fb = await loadFirebase();
  fb.fsMod
    .deleteDoc(fb.fsMod.doc(col(fb, user, name), id))
    .catch((e) => console.error(`雲端刪除 ${name} 失敗`, e));
}

// 第一次登入時，把這台裝置在本機模式存的資料搬上雲端
function migrateLocalToCloud(fb, user, name) {
  const local = readLocal(name);
  if (local.length === 0) return;
  const batch = fb.fsMod.writeBatch(fb.db);
  local.forEach((d) => batch.set(fb.fsMod.doc(col(fb, user, name), d.id), clean(d), { merge: true }));
  writeLocal(name, []);
  batch.commit().catch((e) => {
    console.error(`本機 ${name} 上傳失敗，已還原`, e);
    writeLocal(name, local);
  });
}

// ============================================================
// 紀錄存取層
// - 沒填 firebase-config.js → 本機模式，存在瀏覽器 localStorage
// - 有填且已登入 → 存在 Firestore 的 users/{uid}/records，各裝置即時同步
//   Firestore 開了離線快取：沒網路也能存，連線後自動補傳
// ============================================================
import { firebaseConfig } from "./firebase-config.js";

const FIREBASE_VER = "11.10.0";
const LOCAL_KEY = "gear-weight-records";

export const cloudEnabled = Boolean(firebaseConfig && firebaseConfig.apiKey);

// ---------- 本機 ----------
function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function writeLocal(records) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event("local-records-changed"));
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

function recordsCol(fb, user) {
  return fb.fsMod.collection(fb.db, "users", user.uid, "records");
}

// ---------- 對外介面 ----------

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

/** 監聽紀錄清單（新到舊）。cb(records)。回傳取消監聽的函式。 */
export function watchRecords(user, cb) {
  if (!user) {
    const emit = () => cb(readLocal());
    emit();
    window.addEventListener("local-records-changed", emit);
    window.addEventListener("storage", emit); // 同一台電腦其他分頁的變動
    return () => {
      window.removeEventListener("local-records-changed", emit);
      window.removeEventListener("storage", emit);
    };
  }

  let unsub = () => {};
  let cancelled = false;
  loadFirebase().then((fb) => {
    if (cancelled) return;
    migrateLocalToCloud(fb, user);
    const q = fb.fsMod.query(recordsCol(fb, user), fb.fsMod.orderBy("date", "desc"));
    unsub = fb.fsMod.onSnapshot(
      q,
      (snap) => cb(snap.docs.map((d) => d.data())),
      (e) => console.error("讀取雲端紀錄失敗", e)
    );
  });
  return () => {
    cancelled = true;
    unsub();
  };
}

/** 新增或覆寫一筆紀錄 */
export async function saveRecord(user, record) {
  if (!user) {
    writeLocal([record, ...readLocal().filter((r) => r.id !== record.id)]);
    return;
  }
  const fb = await loadFirebase();
  // 不等待伺服器回應：離線時寫入會先進本機快取，畫面立即更新，連線後自動上傳
  fb.fsMod
    .setDoc(fb.fsMod.doc(recordsCol(fb, user), record.id), record)
    .catch((e) => console.error("雲端儲存失敗", e));
}

export async function deleteRecord(user, id) {
  if (!user) {
    writeLocal(readLocal().filter((r) => r.id !== id));
    return;
  }
  const fb = await loadFirebase();
  fb.fsMod
    .deleteDoc(fb.fsMod.doc(recordsCol(fb, user), id))
    .catch((e) => console.error("雲端刪除失敗", e));
}

// 第一次登入時，把這台裝置在本機模式存的紀錄搬上雲端
function migrateLocalToCloud(fb, user) {
  const local = readLocal();
  if (local.length === 0) return;
  const batch = fb.fsMod.writeBatch(fb.db);
  local.forEach((r) => batch.set(fb.fsMod.doc(recordsCol(fb, user), r.id), r));
  writeLocal([]);
  batch.commit().catch((e) => {
    console.error("本機紀錄上傳失敗，已還原", e);
    writeLocal(local);
  });
}

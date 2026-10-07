import React, { useState, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Footprints,
  Shirt,
  Backpack,
  Tent,
  CookingPot,
  Droplet,
  Flashlight,
  Glasses,
  Cross,
  Package,
  Tag,
  Info,
  Plus,
  Trash2,
  Save,
  Download,
  Upload,
  Loader2,
  History,
  FolderOpen,
  Cloud,
  CloudOff,
  LogIn,
  LogOut,
  HardDrive,
  Pencil,
  X,
  ShieldCheck,
  Target,
  RefreshCw,
  Smartphone,
  ArrowUpDown,
  Check,
  GripVertical,
  Mountain,
  Waves,
  Snowflake,
  LifeBuoy,
  Wind,
  Watch,
  Weight,
  MountainSnow,
  HardHat,
  Armchair,
  BedDouble,
  Layers,
  LayoutGrid,
  Library,
  ListChecks,
  Settings,
  Star,
  Bath,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Palette,
  PartyPopper,
  RotateCcw,
} from "lucide-react";
import {
  ACTIVITIES,
  DEFAULT_ACTIVITY,
  PRESET_CATEGORIES,
  CATEGORY_ALIASES,
  TEMP_CATEGORY_TITLE,
  DEFAULT_TARGET_G,
  SAMPLE_GEAR,
  SAMPLE_DEFAULT_ON,
  normalizeGear,
  normalizeRecord,
} from "./gear-data.js";
import * as store from "./storage.js";

// 版本號：每次更新記得同步修改 sw.js 的 CACHE_VERSION 與 CHANGELOG.md
const APP_VERSION = "3.6.3";
// 備份檔格式版本：備份檔結構有變才加 1，並在 normalizeBackup 處理舊格式
// 3：裝備多了 activities、紀錄多了 activity（舊備份讀進來會自動補成登山）
const BACKUP_SCHEMA = 3;
// 編輯中的內容（每個活動各自的勾選、標題、臨時品項）：本機存一份；登入時也存到雲端 meta/draft，跨裝置同步
const DRAFT_KEY = "gear-draft";
const DRAFT_PUSH_DELAY_MS = 600; // 停手多久後才上傳，避免打字時每個字都上傳
const BACKUP_REMIND_DAYS = 30;
const VIEW_KEY = "gear-view"; // 目前看的活動（只存這台裝置）
const THEME_KEY = "gear-theme"; // 佈景主題（也存在帳號設定裡，跨裝置同步）
const ALL = "all"; // 「全部裝備」：管理裝備庫

const ICONS = {
  Footprints, Shirt, Backpack, Tent, CookingPot, Droplet, Flashlight, Smartphone, Glasses, Cross, Package, Tag,
  Mountain, Waves, Snowflake, LifeBuoy, Wind, Watch, Weight, MountainSnow, HardHat, Armchair, BedDouble, Layers,
  Star, Bath,
};

const hasWeight = (w) => typeof w === "number" && w > 0;

function formatWeight(g) {
  if (!hasWeight(g)) return "—";
  return g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${Math.round(g * 10) / 10} g`;
}

function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(
    d.getDate()
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

// ------------------------------------------------------------
// 佈景主題：在「設定」裡選，整個 App 用同一套顏色
// amber = 主色（按鈕、重點數字）、moss = 輔色（圖示、進度條）、onAccent = 主色按鈕上的文字
// ⚠ key 不可改名：使用者的選擇存的是 key
// ------------------------------------------------------------
const THEMES = {
  purple: {
    bg: "#131417", panel: "#1C1E23", panelAlt: "#24262D", line: "#363944",
    amber: "#AE9CF5", moss: "#8E96B0", onAccent: "#131417",
    text: "#ECECF1", textMuted: "#9A9EAE", textFaint: "#5F6372", warn: "#E0675A",
  },
  green: {
    bg: "#10161A", panel: "#1A2420", panelAlt: "#212D27", line: "#324139",
    amber: "#E3A542", moss: "#7FA88F", onAccent: "#10161A",
    text: "#EDEDE6", textMuted: "#93A69A", textFaint: "#5D6E64", warn: "#D9634B",
  },
  khaki: {
    bg: "#16110D", panel: "#211913", panelAlt: "#2A2019", line: "#44362A",
    amber: "#D99A5B", moss: "#B5A27A", onAccent: "#16110D",
    text: "#F2EADF", textMuted: "#B39F8A", textFaint: "#6F5E4F", warn: "#E0674D",
  },
};
const THEME_OPTIONS = [
  { key: "purple", title: "薰衣草紫" },
  { key: "green", title: "森林綠" },
  { key: "khaki", title: "卡其咖啡" },
];
const DEFAULT_THEME = "green";

// 畫面上用 CSS 變數，切換主題時所有地方自動換色
const palette = Object.fromEntries(Object.keys(THEMES[DEFAULT_THEME]).map((k) => [k, `var(--${k})`]));
const themeVars = (key) =>
  Object.fromEntries(Object.entries(THEMES[key] || THEMES[DEFAULT_THEME]).map(([k, v]) => [`--${k}`, v]));

const fontStack =
  '"PingFang TC", "Microsoft JhengHei", "Noto Sans TC", "Helvetica Neue", Arial, sans-serif';

const activityOf = (key) => ACTIVITIES.find((a) => a.key === key) || ACTIVITIES[0];
// 畫面上顯示的活動（hidden 的暫時不顯示，資料保留）
const VISIBLE_ACTIVITIES = ACTIVITIES.filter((a) => !a.hidden);

// ------------------------------------------------------------
// 匯出成 PNG 圖片：純 Canvas 繪製，不依賴外部套件
// sections: [{ title, lines: [{ name, weight }] }]
// mode: "weight" 顯示總重；"list" 顯示件數
// ------------------------------------------------------------
function drawSnapshotToPng({ owner, title, date, sections, total, mode, count, theme }) {
  const palette = THEMES[theme] || THEMES[DEFAULT_THEME];
  const width = 760;
  const rowH = 30;
  const lineCount = sections.reduce((n, s) => n + 1 + s.lines.length, 0);
  const headerH = 150;
  const totalBlockH = 110;
  const footerH = 50;
  const bodyH = lineCount * rowH + sections.length * 14 + 40;
  const height = headerH + bodyH + totalBlockH + footerH;

  const canvas = document.createElement("canvas");
  const scale = 2; // 高解析度輸出
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = palette.moss;
  ctx.font = `600 12px ${fontStack}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`${owner} · GEAR RECKONER`, 32, 40);

  ctx.fillStyle = palette.text;
  ctx.font = `700 28px ${fontStack}`;
  ctx.fillText(title || "裝備紀錄", 32, 78);

  ctx.fillStyle = palette.textMuted;
  ctx.font = `400 13px ${fontStack}`;
  ctx.fillText(date, 32, 102);

  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(32, 122);
  ctx.lineTo(width - 32, 122);
  ctx.stroke();

  let y = headerH;
  sections.forEach((sec) => {
    ctx.fillStyle = palette.moss;
    ctx.font = `600 13px ${fontStack}`;
    ctx.fillText(sec.title, 32, y);
    y += 24;
    sec.lines.forEach((line) => {
      ctx.fillStyle = palette.text;
      ctx.font = `400 14px ${fontStack}`;
      ctx.fillText(mode === "list" ? `☐  ${line.name}` : line.name, 44, y);
      if (hasWeight(line.weight)) {
        ctx.textAlign = "right";
        ctx.fillStyle = palette.textMuted;
        ctx.font = `600 14px ${fontStack}`;
        ctx.fillText(formatWeight(line.weight), width - 32, y);
        ctx.textAlign = "left";
      }
      y += rowH;
    });
    y += 10;
  });

  ctx.strokeStyle = palette.line;
  ctx.beginPath();
  ctx.moveTo(32, y);
  ctx.lineTo(width - 32, y);
  ctx.stroke();
  y += 44;

  ctx.fillStyle = palette.textMuted;
  ctx.font = `500 13px ${fontStack}`;
  ctx.fillText(mode === "list" ? "裝備件數" : "總重量", 32, y);
  y += 40;
  ctx.fillStyle = palette.amber;
  ctx.font = `700 40px ${fontStack}`;
  ctx.fillText(mode === "list" ? `${count} 件` : `${(total / 1000).toFixed(2)} kg`, 32, y);
  ctx.fillStyle = palette.textMuted;
  ctx.font = `500 14px ${fontStack}`;
  if (mode !== "list") ctx.fillText(`${total.toLocaleString()} g`, 32, y + 22);
  else if (total > 0) ctx.fillText(`參考重量 ${(total / 1000).toFixed(2)} kg`, 32, y + 22);

  ctx.fillStyle = palette.textFaint;
  ctx.font = `400 11px ${fontStack}`;
  ctx.fillText("小可 · Gear Reckoner 產出", 32, height - 22);

  return canvas;
}

// 紀錄的 items → 圖片用的分段（依類別分組，保留原順序）
function itemsToSections(items) {
  const sections = [];
  items.forEach((it) => {
    let sec = sections.find((s) => s.title === it.cat);
    if (!sec) sections.push((sec = { title: it.cat, lines: [] }));
    sec.lines.push({ name: it.note ? `${it.name} · ${it.note}` : it.name, weight: it.weight });
  });
  return sections;
}

// 存檔：手機用系統「分享」選單（可存相簿/檔案、傳 LINE），電腦直接下載
async function saveFile(blob, filename, title) {
  const file = new File([blob], filename, { type: blob.type });
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return true;
    } catch (e) {
      if (e.name === "AbortError") return false; // 使用者取消分享
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

const safeFilename = (s) => s.replace(/[\\/:*?"<>|]/g, "_");

function exportImage(snapshot) {
  const canvas = drawSnapshotToPng(snapshot);
  canvas.toBlob((blob) => blob && saveFile(blob, `${safeFilename(snapshot.title)}.png`, snapshot.title), "image/png");
}

// 草稿：v3 起每個活動各一份 { byActivity: { hiking: { checked, title, tempItems }, ... } }
// v2.x 只有一份（登山），讀進來時自動放到 hiking
function upgradeDraft(d) {
  if (!d) return {};
  if (d.byActivity) return d.byActivity;
  if (d.checked || d.title || d.tempItems || d.customItems) {
    return {
      [DEFAULT_ACTIVITY]: { checked: d.checked || {}, title: d.title || "", tempItems: d.tempItems || d.customItems || [] },
    };
  }
  return {};
}

function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function loadTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return THEMES[t] ? t : DEFAULT_THEME;
  } catch (e) {
    return DEFAULT_THEME;
  }
}

function loadView() {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === ALL || VISIBLE_ACTIVITIES.some((a) => a.key === v) ? v : DEFAULT_ACTIVITY;
  } catch (e) {
    return DEFAULT_ACTIVITY;
  }
}

// 這台裝置的代號：用來分辨雲端的編輯內容是不是自己剛傳的
const DEVICE_ID = (() => {
  try {
    let id = localStorage.getItem("gear-device-id");
    if (!id) localStorage.setItem("gear-device-id", (id = Math.random().toString(36).slice(2, 10)));
    return id;
  } catch (e) {
    return Math.random().toString(36).slice(2, 10);
  }
})();

const formatClock = (ts) =>
  `${String(new Date(ts).getHours()).padStart(2, "0")}:${String(new Date(ts).getMinutes()).padStart(2, "0")}`;

const newId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

/** 讀進來的備份檔 → 統一成目前格式。未來備份格式改版時在這裡加轉換 */
function normalizeBackup(data) {
  if (!data || data.app !== "gear-reckoner") throw new Error("這不是裝備試算 App 的備份檔");
  if (data.schema > BACKUP_SCHEMA) throw new Error("這個備份檔來自更新的 App 版本，請先重新整理 App 更新到最新版");
  return {
    gear: (Array.isArray(data.gear) ? data.gear : []).map(normalizeGear),
    records: (Array.isArray(data.records) ? data.records : []).map(normalizeRecord),
    settings: data.settings || {},
  };
}

// packed：打包模式裡已經裝進包包的裝備 id；packing：目前是否在打包畫面（關掉 App 再打開會回到這裡）
const EMPTY_DRAFT = { checked: {}, title: "", tempItems: [], packed: {}, packing: false };

function GearReckoner() {
  const [initialDraft] = useState(loadDraft);

  // 登入狀態：undefined = 確認中、null = 未登入/本機模式、物件 = 已登入
  const [user, setUser] = useState(undefined);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncInfo, setSyncInfo] = useState({}); // 每種資料的 { pending, fromCache }
  const [lastConfirmed, setLastConfirmed] = useState(null); // 最後一次跟雲端確認的時間
  const [syncing, setSyncing] = useState(false);

  // 雲端（或本機）資料
  const [rawGear, setGear] = useState([]);
  const [rawRecords, setRecords] = useState([]);
  const [metaDocs, setMetaDocs] = useState([]);
  const [loaded, setLoaded] = useState({});

  // 目前看的活動（或「全部裝備」）
  const [view, setView] = useState(loadView);
  const isLibrary = view === ALL;
  const activity = isLibrary ? null : activityOf(view);
  const isWeightMode = activity?.mode === "weight";

  // 每個活動各自的編輯內容（存在這台裝置，登入時也跨裝置同步）
  const [drafts, setDrafts] = useState(() => upgradeDraft(initialDraft));
  const cur = (!isLibrary && drafts[view]) || EMPTY_DRAFT;
  const checked = cur.checked || {};
  const title = cur.title || "";
  const tempItems = cur.tempItems || [];
  const updateDraft = (field, updater, act = view) =>
    setDrafts((prev) => {
      const d = { ...EMPTY_DRAFT, ...prev[act] };
      return { ...prev, [act]: { ...d, [field]: typeof updater === "function" ? updater(d[field]) : updater } };
    });
  const setChecked = (u, act) => updateDraft("checked", u, act);
  const setTitle = (u) => updateDraft("title", u);
  const setTempItems = (u) => updateDraft("tempItems", u);
  const packed = cur.packed || {};
  const packing = !isLibrary && !!cur.packing;
  const setPacked = (u) => updateDraft("packed", u);
  const setPacking = (v) => updateDraft("packing", v);

  const [newTempName, setNewTempName] = useState("");
  const [newTempWeight, setNewTempWeight] = useState("");

  const [localTheme, setLocalTheme] = useState(loadTheme);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editor, setEditor] = useState(null); // null 或 { item }（item.id 不存在代表新增）
  const [picker, setPicker] = useState(false); // 「從裝備庫加入」面板
  const [saving, setSaving] = useState(false);
  const importInput = useRef(null);
  const upgradedIds = useRef(new Set());
  const draftStamp = useRef(initialDraft.updatedAt || 0); // 目前編輯內容的時間戳記
  const skipDraftPush = useRef(true); // 第一次顯示、或剛套用其他裝置的內容時，不要再傳回去
  const draftTimer = useRef(null);
  const pushDraftRef = useRef(() => {});

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch (e) {
      // 不影響使用
    }
  }, [view]);

  useEffect(() => store.watchAuth(setUser), []);

  useEffect(() => {
    if (user === undefined) return;
    setLoaded({});
    setSyncInfo({});
    const setters = { gear: setGear, records: setRecords, meta: setMetaDocs };
    const unsubs = store.COLLECTIONS.map((name) =>
      store.watch(user, name, (docs, info) => {
        setters[name](docs);
        setLoaded((prev) => ({ ...prev, [name]: true }));
        setSyncInfo((prev) => ({ ...prev, [name]: info }));
        if (user && !info.fromCache && !info.pending) setLastConfirmed(Date.now());
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [user]);

  // v1.x 舊格式紀錄 → 自動轉成新格式並存回去（v2 → v3 只是補 activity，讀取時處理即可）
  useEffect(() => {
    const legacy = rawRecords.filter((r) => !Array.isArray(r.items) && !upgradedIds.current.has(r.id));
    if (legacy.length === 0) return;
    legacy.forEach((r) => upgradedIds.current.add(r.id));
    store.putMany(user, "records", legacy.map(normalizeRecord));
  }, [rawRecords, user]);

  // 已合併的類別（例如舊的「電子設備」devices）→ 自動把裝備搬到新類別
  useEffect(() => {
    if (!loaded.gear) return;
    const stale = rawGear.filter((g) => CATEGORY_ALIASES[g.category]);
    if (stale.length === 0) return;
    store.putMany(user, "gear", stale.map((g) => ({ ...g, category: CATEGORY_ALIASES[g.category] })));
  }, [rawGear, loaded.gear, user]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // 其他裝置更新了編輯內容 → 套用到這台（比較新的才套用）
  useEffect(() => {
    const remote = metaDocs.find((d) => d.id === "draft");
    if (!remote || remote.deviceId === DEVICE_ID) return;
    if ((remote.updatedAt || 0) <= draftStamp.current) return;
    draftStamp.current = remote.updatedAt;
    skipDraftPush.current = true;
    if (remote.byActivity) setDrafts(remote.byActivity);
    // 還沒更新的舊版 App 只會傳登山那一份 → 只蓋登山，其他活動保留
    else setDrafts((prev) => ({ ...prev, ...upgradeDraft(remote) }));
  }, [metaDocs]);

  // 編輯內容有變 → 存本機，登入時稍等一下再上傳雲端
  useEffect(() => {
    const isRemoteOrInitial = skipDraftPush.current;
    skipDraftPush.current = false;
    if (!isRemoteOrInitial) draftStamp.current = Date.now();
    const snapshot = { byActivity: drafts, updatedAt: draftStamp.current };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot));
    } catch (e) {
      // 本機儲存空間不可用（例如無痕模式），不影響使用
    }
    if (isRemoteOrInitial || !user) return;
    // 同時寫一份舊格式（登山）給還沒更新的舊版 App 看
    const hiking = { ...EMPTY_DRAFT, ...drafts[DEFAULT_ACTIVITY] };
    const push = () => {
      clearTimeout(draftTimer.current);
      pushDraftRef.current = () => {};
      store.put(user, "meta", { ...snapshot, ...hiking, id: "draft", deviceId: DEVICE_ID });
    };
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(push, DRAFT_PUSH_DELAY_MS);
    pushDraftRef.current = push;
  }, [drafts]);

  // 立即同步：先把還沒上傳的編輯內容送出，再跟雲端重新連線
  const syncNow = async ({ quiet = false } = {}) => {
    if (!user || syncing) return;
    pushDraftRef.current();
    setSyncing(true);
    try {
      await store.syncNow();
      setLastConfirmed(Date.now());
    } catch (e) {
      if (!quiet) alert(navigator.onLine ? "同步逾時，請確認網路後再試一次。" : "目前沒有網路，連線後會自動同步。");
    } finally {
      setSyncing(false);
    }
  };

  // 切到別的 App 前先上傳；切回來時自動同步一次
  useEffect(() => {
    const onHide = () => pushDraftRef.current();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHide();
      else syncNow({ quiet: true });
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
    };
  });

  // 讓同步時間之類的顯示會自己更新
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // ---------- 衍生資料 ----------
  const meta = metaDocs.find((d) => d.id === "settings") || {};
  const syncValues = Object.values(syncInfo);
  const syncState = !online
    ? "offline"
    : syncing
    ? "syncing"
    : syncValues.some((i) => i.pending)
    ? "uploading"
    : syncValues.length < store.COLLECTIONS.length || syncValues.some((i) => i.fromCache)
    ? "connecting"
    : "synced";
  const saveMeta = (changes) => store.put(user, "meta", { ...meta, ...changes, id: "settings" });

  // 佈景主題：帳號設定裡的優先（跨裝置同步），本機記一份讓下次打開不閃色
  const themeKey = THEMES[meta.theme] ? meta.theme : localTheme;
  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, themeKey);
    } catch (e) {
      // 不影響使用
    }
    // 主題色也掛到最外層 <html>，整頁捲軸才吃得到
    const root = document.documentElement;
    Object.entries(themeVars(themeKey)).forEach(([k, v]) => root.style.setProperty(k, v));
    const bg = THEMES[themeKey].bg;
    document.body.style.background = bg;
    root.style.background = bg;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute("content", bg);
  }, [themeKey]);
  const chooseTheme = (key) => {
    setLocalTheme(key);
    saveMeta({ theme: key });
  };

  const gear = useMemo(() => rawGear.map(normalizeGear), [rawGear]);
  const records = useMemo(() => rawRecords.filter((r) => Array.isArray(r.items)).map(normalizeRecord), [rawRecords]);

  // 這個畫面要顯示的裝備：全部裝備 = 整個裝備庫；活動 = 貼了這個活動標籤的
  const viewGear = useMemo(
    () => (isLibrary ? gear : gear.filter((g) => g.activities.includes(view))),
    [gear, view, isLibrary]
  );

  // 類別依使用者排好的順序（meta.categoryOrder）；沒排到的（例如新類別）接在後面
  const categories = useMemo(() => {
    const all = [
      ...PRESET_CATEGORIES,
      ...(meta.customCategories || []).map((c) => ({ ...c, icon: "Tag", custom: true })),
    ];
    const merged = (meta.categoryOrder || []).filter((k) => all.some((c) => c.key === k));
    // 還沒排過的類別（例如新版加的預設類別）：插在它在預設清單裡前一個類別的後面，不打亂使用者排好的順序
    all.forEach((c, i) => {
      if (merged.includes(c.key)) return;
      const prev = all.slice(0, i).reverse().find((p) => merged.includes(p.key));
      merged.splice(prev ? merged.indexOf(prev.key) + 1 : 0, 0, c.key);
    });
    return merged.map((k) => all.find((c) => c.key === k));
  }, [meta.customCategories, meta.categoryOrder]);

  const gearByCat = useMemo(() => {
    // 手動排過的用 order，還沒排過的（例如新增的）依建立時間排在後面
    const sortKey = (g) => (g.order != null ? g.order : g.createdAt || 0);
    const sorted = [...viewGear].sort((a, b) => sortKey(a) - sortKey(b));
    const known = new Set(categories.map((c) => c.key));
    return categories
      .map((cat) => ({
        ...cat,
        // 類別被刪掉的裝備歸到「其他」
        items: sorted.filter((g) => g.category === cat.key || (cat.key === "other" && !known.has(g.category))),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [viewGear, categories]);

  const sortedRecords = useMemo(
    () =>
      records
        .filter((r) => isLibrary || r.activity === view)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [records, view, isLibrary]
  );

  const weightOf = (w) => (hasWeight(w) ? w : 0);
  const catTotals = gearByCat.map((cat) => ({
    key: cat.key,
    label: cat.title,
    value: cat.items.reduce((sum, g) => sum + (checked[g.id] ? weightOf(g.weight) : 0), 0),
    count: cat.items.filter((g) => checked[g.id]).length,
    total: cat.items.length,
  }));
  const tempChecked = tempItems.filter((t) => t.checked);
  const tempTotal = tempChecked.reduce((sum, it) => sum + weightOf(it.weight), 0);
  const grandTotal = Math.round((catTotals.reduce((s, c) => s + c.value, 0) + tempTotal) * 10) / 10;
  const checkedCount = catTotals.reduce((s, c) => s + c.count, 0) + tempChecked.length;
  const itemCount = viewGear.length + tempItems.length;

  const targetG = meta.targetG || DEFAULT_TARGET_G;
  const maxScaleG = Math.ceil(Math.max(targetG * 1.3, grandTotal) / 1000) * 1000;
  const fillPercent = Math.min(100, (grandTotal / maxScaleG) * 100);
  const targetPercent = Math.min(100, (targetG / maxScaleG) * 100);
  const overTarget = grandTotal > targetG;
  const deltaFromTarget = Math.abs(grandTotal - targetG);

  const owner = user?.displayName ? `${user.displayName} 的裝備清單` : "我的裝備清單";
  const dataReady = user !== undefined && loaded.gear && loaded.records && loaded.meta;

  const daysSinceBackup = meta.lastBackupAt
    ? Math.floor((Date.now() - new Date(meta.lastBackupAt)) / 86400000)
    : null;
  const backupDue = (gear.length > 0 || records.length > 0) && (daysSinceBackup === null || daysSinceBackup >= BACKUP_REMIND_DAYS);

  // 還沒貼上這個活動標籤的裝備（給「從裝備庫加入」用）
  const notInView = isLibrary ? [] : gear.filter((g) => !g.activities.includes(view));

  // ---------- 動作 ----------
  const toggle = (id) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleSignIn = async () => {
    try {
      await store.signIn();
    } catch (e) {
      alert(`登入失敗：${e.message}`);
    }
  };

  const handleSignOut = async () => {
    if (confirm("要登出嗎？登出後這台裝置看不到雲端資料，重新登入就會回來。")) {
      await store.signOut();
    }
  };

  // 新增裝備統一在「全部裝備」做；在活動頁按新增會先切到全部裝備
  const openNewGear = (extra = {}) => {
    if (!isLibrary) setView(ALL);
    setEditor({ item: { activities: [], ...extra } });
  };

  const handleSaveGear = (item) => {
    if (item.id) {
      store.put(user, "gear", item);
    } else {
      const created = { ...item, id: newId("g"), createdAt: Date.now() };
      store.put(user, "gear", created);

    }
    setEditor(null);
  };

  const handleDeleteGear = (item) => {
    if (!confirm(`確定要從裝備庫刪除「${item.name}」嗎？\n所有活動都會移除這件裝備（已存的歷史紀錄不受影響）。`)) return;
    store.remove(user, "gear", item.id);
    setDrafts((prev) => {
      const next = {};
      Object.entries(prev).forEach(([k, d]) => {
        const c = { ...(d.checked || {}) };
        delete c[item.id];
        next[k] = { ...d, checked: c };
      });
      return next;
    });
    setEditor(null);
  };

  // 從裝備庫挑選 → 貼上目前活動的標籤
  const handleAddFromLibrary = (ids) => {
    const picked = gear.filter((g) => ids.includes(g.id));
    store.putMany(user, "gear", picked.map((g) => ({ ...g, activities: [...g.activities, view] })));
    setChecked((prev) => {
      const next = { ...prev };
      ids.forEach((id) => (next[id] = true));
      return next;
    });
    setPicker(false);
  };

  const handleAddCategory = () => {
    const name = (prompt("新類別名稱（例如：攀登器材、攝影）") || "").trim();
    if (!name) return null;
    if (categories.some((c) => c.title === name)) {
      alert("已經有這個類別了");
      return null;
    }
    const cat = { key: newId("c"), title: name };
    saveMeta({ customCategories: [...(meta.customCategories || []), cat] });
    return cat.key;
  };

  const handleDeleteCategory = (key) => {
    if (gear.some((g) => g.category === key)) {
      alert("這個類別裡還有裝備，請先把裝備移到其他類別或刪除。");
      return false;
    }
    saveMeta({ customCategories: (meta.customCategories || []).filter((c) => c.key !== key) });
    return true;
  };

  // 拖曳類別（在設定裡）：第 from 個類別移到第 to 個位置
  const reorderCategories = (from, to) => {
    const keys = categories.map((c) => c.key);
    const [moved] = keys.splice(from, 1);
    keys.splice(to, 0, moved);
    saveMeta({ categoryOrder: keys });
  };

  // 長按拖曳裝備：在同一類別裡移動，並把整個類別重新編號
  const reorderGear = (cat, from, to) => {
    const items = [...cat.items];
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    store.putMany(user, "gear", items.map((g, idx) => ({ ...g, order: idx })));
  };

  const handleLoadSample = () => {
    if (!confirm("要載入範例裝備清單（登山）嗎？載入後可以自由修改或刪除。")) return;
    const existing = new Set(gear.map((g) => g.id));
    const base = Date.now();
    store.putMany(
      user,
      "gear",
      SAMPLE_GEAR.filter((g) => !existing.has(g.id)).map((g, i) => ({
        ...g,
        activities: [DEFAULT_ACTIVITY],
        createdAt: base + i,
      }))
    );
    setChecked((prev) => {
      const next = { ...prev, speedgoat7: true };
      SAMPLE_DEFAULT_ON.forEach((id) => (next[id] = true));
      return next;
    }, DEFAULT_ACTIVITY);
    setView(DEFAULT_ACTIVITY);
  };

  const handleEditTarget = () => {
    const input = prompt("舒適重量目標（公斤）", String(targetG / 1000));
    if (input === null) return;
    const kg = parseFloat(input);
    if (isNaN(kg) || kg <= 0) return alert("請輸入大於 0 的數字");
    saveMeta({ targetG: Math.round(kg * 1000) });
  };

  const addTempItem = () => {
    const name = newTempName.trim();
    const w = parseFloat(newTempWeight);
    if (!name) return;
    if (newTempWeight.trim() && (isNaN(w) || w < 0)) return;
    setTempItems((prev) => [
      ...prev,
      { id: newId("t"), name, weight: hasWeight(w) ? Math.round(w * 10) / 10 : null, checked: true },
    ]);
    setNewTempName("");
    setNewTempWeight("");
  };

  // 目前勾選內容的完整快照（紀錄、圖片共用）
  const currentItems = () => [
    ...gearByCat.flatMap((cat) =>
      cat.items
        .filter((g) => checked[g.id])
        .map((g) => ({ id: g.id, cat: cat.title, name: g.name, note: g.note || "", weight: hasWeight(g.weight) ? g.weight : null }))
    ),
    ...tempChecked.map((t) => ({ id: t.id, cat: TEMP_CATEGORY_TITLE, name: t.name, note: "", weight: hasWeight(t.weight) ? t.weight : null })),
  ];

  const defaultTitle = () => `${activity.title}裝備紀錄`;

  const handleExportImage = () => {
    const items = currentItems();
    exportImage({
      owner,
      title: title.trim() || defaultTitle(),
      date: formatDate(new Date().toISOString()),
      sections: itemsToSections(items),
      total: grandTotal,
      mode: activity.mode,
      count: items.length,
      theme: themeKey,
    });
  };

  const handleSaveRecord = async () => {
    setSaving(true);
    try {
      await store.put(user, "records", {
        id: newId("rec"),
        activity: view,
        title: title.trim() || defaultTitle(),
        date: new Date().toISOString(),
        items: currentItems(),
        total: grandTotal,
      });
      // 存好紀錄 = 這趟出門準備完成 → 清掉打包進度，下次重新開始
      setDrafts((prev) => ({ ...prev, [view]: { ...EMPTY_DRAFT, ...prev[view], packed: {}, packing: false } }));
      return true;
    } catch (e) {
      alert(`儲存失敗：${e.message}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleLoadRecord = (record) => {
    const act = record.activity;
    const actGear = gear.filter((g) => g.activities.includes(act));
    const actIds = new Set(actGear.map((g) => g.id));
    const inRecord = new Set(record.items.map((i) => i.id));
    setDrafts((prev) => ({
      ...prev,
      [act]: {
        title: record.title,
        checked: Object.fromEntries(actGear.map((g) => [g.id, inRecord.has(g.id)])),
        // 紀錄裡有、但目前這個活動已經沒有的裝備 → 放到臨時品項
        tempItems: record.items
          .filter((i) => !actIds.has(i.id))
          .map((i) => ({ id: i.id, name: i.note ? `${i.name} · ${i.note}` : i.name, weight: i.weight, checked: true })),
      },
    }));
    setView(act);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleExportRecordImage = (record) =>
    exportImage({
      owner,
      title: record.title,
      date: formatDate(record.date),
      sections: itemsToSections(record.items),
      total: record.total,
      mode: activityOf(record.activity).mode,
      count: record.items.length,
      theme: themeKey,
    });

  const handleDeleteRecord = (record) => {
    if (!confirm(`確定要刪除「${record.title}」這筆紀錄嗎？`)) return;
    store.remove(user, "records", record.id);
  };

  const handleExportBackup = async () => {
    const data = {
      app: "gear-reckoner",
      schema: BACKUP_SCHEMA,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      account: user?.email || "本機模式",
      gear,
      records,
      settings: {
        customCategories: meta.customCategories || [],
        categoryOrder: meta.categoryOrder || null,
        targetG: meta.targetG || null,
      },
    };
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const done = await saveFile(blob, `裝備備份-${stamp}.json`, "裝備試算備份");
    if (done) saveMeta({ lastBackupAt: new Date().toISOString() });
  };

  const handleImportBackup = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = normalizeBackup(JSON.parse(await file.text()));
      const msg =
        `要匯入這個備份嗎？\n\n裝備 ${data.gear.length} 件、紀錄 ${data.records.length} 筆\n\n` +
        "同一件裝備/紀錄會以備份檔內容為準；你現有、但備份裡沒有的資料會保留，不會被刪除。";
      if (!confirm(msg)) return;
      store.putMany(user, "gear", data.gear);
      store.putMany(user, "records", data.records);
      const cats = [...(meta.customCategories || [])];
      (data.settings.customCategories || []).forEach((c) => {
        if (!cats.some((x) => x.key === c.key)) cats.push(c);
      });
      saveMeta({
        customCategories: cats,
        categoryOrder: data.settings.categoryOrder || meta.categoryOrder || null,
        targetG: data.settings.targetG || meta.targetG || null,
      });
      alert("匯入完成！");
    } catch (err) {
      alert(`匯入失敗：${err.message}`);
    }
  };

  // ---------- 畫面 ----------
  const panelStyle = {
    background: palette.panel,
    borderRadius: 12,
    padding: "10px 12px",
    border: `1px solid ${palette.line}`,
  };
  const headingStyle = { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15 };
  const monoStyle = { fontFamily: "'JetBrains Mono', monospace" };
  const ViewIcon = isLibrary ? LayoutGrid : ICONS[activity.icon];

  const pageTitle = isLibrary ? "全部裝備" : `${activity.title}${isWeightMode ? "裝備重量試算" : "裝備清單"}`;
  const pageHint = isLibrary
    ? "你擁有的所有裝備都在這裡，每件可以貼上多個活動標籤。點 ✎ 修改，長按可拖曳排序。"
    : isWeightMode
    ? "勾選這次要帶的裝備，即時算出總重。點 ✎ 修改，長按可拖曳排序。"
    : "勾選這次要帶的裝備，出門前確認沒有漏帶。點 ✎ 修改，長按可拖曳排序。";

  return (
    <div
      className="page"
      style={{
        ...themeVars(themeKey),
        transition: "background-color 0.25s",
        background: palette.bg,
        color: palette.text,
        fontFamily: "'Inter', 'PingFang TC', 'Microsoft JhengHei', 'Noto Sans TC', sans-serif",
        minHeight: "100vh",
        padding: "14px 12px",
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        button { font-family: inherit; }
        html { scrollbar-width: thin; scrollbar-color: ${palette.line} transparent; }
        .sheet { scrollbar-width: thin; scrollbar-color: ${palette.line} transparent; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${palette.line}; border-radius: 8px; border: 2px solid transparent; background-clip: padding-box; }
        ::-webkit-scrollbar-thumb:hover { background: ${palette.textFaint}; background-clip: padding-box; }
        .sheet::-webkit-scrollbar-track { margin: 14px 0; }
        .item-row {
          display: flex; align-items: center; gap: 10px;
          padding: 5px 8px; border-radius: 7px;
          border: 1px solid transparent;
          cursor: pointer; transition: background 0.15s, border-color 0.15s;
        }
        .item-row:hover { background: ${palette.panelAlt}; }
        .item-row { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
        .item-row.drag-chosen { border-color: ${palette.amber}; background: ${palette.panelAlt}; }
        .item-row.static { cursor: default; }
        .checkbox {
          width: 16px; height: 16px; border-radius: 4px;
          border: 1.5px solid ${palette.textFaint};
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: all 0.15s;
        }
        .checkbox.on { background: ${palette.amber}; border-color: ${palette.amber}; }
        .title-input {
          background: ${palette.panelAlt};
          border: 1.5px solid ${palette.line};
          border-radius: 8px;
          padding: 9px 12px;
          color: ${palette.text};
          font-size: 15px;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 600;
          width: 100%;
          outline: none;
        }
        .title-input:focus { border-color: ${palette.amber}; }
        .action-btn {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          border-radius: 8px; padding: 9px 14px;
          font-size: 13px; font-weight: 600; cursor: pointer;
          border: 1.5px solid ${palette.line};
          background: ${palette.panelAlt}; color: ${palette.text};
          transition: all 0.15s; white-space: nowrap;
        }
        .action-btn:hover { border-color: ${palette.amber}; }
        .action-btn.primary { background: ${palette.amber}; border-color: ${palette.amber}; color: ${palette.onAccent}; }
        .action-btn.pack { background: ${palette.moss}; border-color: ${palette.moss}; color: ${palette.onAccent}; }
        .action-btn.pack:hover { filter: brightness(1.08); }
        .action-btn.danger { color: ${palette.warn}; }
        .action-btn.danger:hover { border-color: ${palette.warn}; }
        .action-btn:disabled { opacity: 0.5; cursor: default; }
        .icon-btn {
          background: none; border: none; cursor: pointer; padding: 6px;
          display: flex; color: ${palette.textFaint}; border-radius: 6px;
        }
        .icon-btn:hover { color: ${palette.amber}; background: ${palette.panelAlt}; }
        .mini-input {
          background: ${palette.bg};
          border: 1.5px solid ${palette.line};
          border-radius: 6px;
          padding: 7px 9px;
          color: ${palette.text};
          font-size: 13px;
          outline: none;
          min-width: 0;
        }
        .mini-input:focus { border-color: ${palette.amber}; }
        .record-card {
          border: 1px solid ${palette.line}; border-radius: 9px;
          padding: 8px 10px; background: ${palette.panelAlt};
        }
        .text-link {
          background: none; border: none; padding: 0; cursor: pointer;
          color: ${palette.textMuted}; font-size: 12px; text-decoration: underline;
          text-underline-offset: 3px;
        }
        .text-link:hover { color: ${palette.amber}; }
        input[type="number"] { -moz-appearance: textfield; }
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none; margin: 0;
        }
        .layout-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
        @media (min-width: 900px) {
          .layout-grid { grid-template-columns: 1fr 320px; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        .mobile-total-bar {
          position: fixed; left: 0; right: 0; bottom: 0; z-index: 10;
          display: flex; align-items: center; gap: 10px;
          padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
          background: ${palette.panel};
          border-top: 1px solid ${palette.line};
        }
        .page { padding-bottom: 90px !important; }
        @media (min-width: 900px) {
          .mobile-total-bar { display: none; }
          .page { padding-bottom: 28px !important; }
        }
        .sheet-backdrop {
          position: fixed; inset: 0; z-index: 20;
          background: rgba(0,0,0,0.55);
          display: flex; align-items: flex-end; justify-content: center;
        }
        .sheet {
          background: ${palette.panel}; border: 1px solid ${palette.line};
          border-radius: 16px 16px 0 0; width: 100%; max-width: 520px;
          max-height: 92vh; overflow-y: auto;
          padding: 18px 16px calc(18px + env(safe-area-inset-bottom));
        }
        /* 面板底部固定的按鈕列：往下延伸蓋住面板的下留白，捲動的清單才不會從下面透出來 */
        .sheet-footer {
          position: sticky; z-index: 1;
          bottom: calc(-18px - env(safe-area-inset-bottom));
          display: flex; justify-content: flex-end; gap: 8px;
          margin: 8px -16px calc(-18px - env(safe-area-inset-bottom));
          padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
          background: ${palette.panel}; border-top: 1px solid ${palette.line};
        }
        @media (min-width: 600px) {
          .sheet-backdrop { align-items: center; }
          .sheet { border-radius: 16px; }
        }
        .cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 8px; }
        .cat-chip {
          display: flex; flex-direction: column; align-items: center; gap: 5px;
          padding: 10px 4px; border-radius: 10px; cursor: pointer;
          border: 1.5px solid ${palette.line}; background: ${palette.panelAlt};
          color: ${palette.textMuted}; font-size: 12px; text-align: center;
        }
        .cat-chip.selected { border-color: ${palette.amber}; color: ${palette.amber}; }
        .cat-chip.add { border-style: dashed; }
        .act-bar { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; margin: 0 -12px 10px; padding-left: 12px; padding-right: 12px; scrollbar-width: none; }
        .act-bar::-webkit-scrollbar { display: none; }
        .act-tab {
          display: flex; align-items: center; gap: 6px; flex-shrink: 0;
          padding: 6px 12px; border-radius: 20px; cursor: pointer;
          border: 1.5px solid ${palette.line}; background: ${palette.panel};
          color: ${palette.textMuted}; font-size: 13.5px; font-weight: 600;
        }
        .act-tab.active { border-color: ${palette.amber}; color: ${palette.onAccent}; background: ${palette.amber}; }
        .act-tab .count { font-family: 'JetBrains Mono', monospace; font-size: 11px; opacity: 0.75; }
        .act-chip {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 7px 12px; border-radius: 20px; cursor: pointer;
          border: 1.5px solid ${palette.line}; background: ${palette.panelAlt};
          color: ${palette.textMuted}; font-size: 13px; font-weight: 600;
        }
        .act-chip.selected { border-color: ${palette.amber}; color: ${palette.amber}; }
        .act-badge {
          display: inline-flex; align-items: center; gap: 3px;
          padding: 1px 7px; border-radius: 20px; font-size: 10.5px; font-weight: 600;
          border: 1px solid ${palette.line}; color: ${palette.textMuted}; white-space: nowrap;
        }
        .act-dots { display: flex; gap: 3px; flex-shrink: 0; }
        .act-dot {
          width: 20px; height: 20px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid ${palette.line}; background: ${palette.panelAlt}; color: ${palette.moss};
        }
        .act-dot.none { border-style: dashed; color: ${palette.textFaint}; font-size: 11px; font-weight: 700; }
        .drag-row {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 8px; border-radius: 7px;
          border: 1px solid ${palette.line}; background: ${palette.panelAlt};
        }
        .drag-handle {
          display: flex; padding: 4px; margin: -4px 0 -4px -4px;
          color: ${palette.textMuted}; cursor: grab; touch-action: none;
        }
        .drag-ghost { opacity: 0.3; }
        .drag-chosen { border-color: ${palette.amber}; }
        .sortable-fallback { opacity: 0.95 !important; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
        .tab-btn {
          background: none; border: none; cursor: pointer; padding: 6px 10px;
          border-radius: 6px; font-size: 13px; font-weight: 600; color: ${palette.textMuted};
        }
        .tab-btn.active { background: ${palette.panelAlt}; color: ${palette.amber}; }
        .fullpage {
          position: fixed; inset: 0; z-index: 30; overflow-y: auto;
          background: ${palette.bg}; color: ${palette.text};
        }
        .fullpage-head {
          position: sticky; top: 0; z-index: 2; background: ${palette.bg};
          display: flex; align-items: center; gap: 8px;
          max-width: 640px; margin: 0 auto;
          padding: calc(8px + env(safe-area-inset-top)) 12px 8px;
          border-bottom: 1px solid ${palette.line};
        }
        .fullpage-title {
          flex: 1; text-align: center; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 16px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .fullpage-body { max-width: 640px; margin: 0 auto; padding: 12px 12px calc(24px + env(safe-area-inset-bottom)); }
        .back-btn {
          display: flex; align-items: center; gap: 2px; min-width: 70px;
          background: none; border: none; cursor: pointer; padding: 6px 4px 6px 0;
          color: ${palette.amber}; font-size: 14px; font-weight: 600;
        }
        .pack-progress {
          background: ${palette.panel}; border: 1px solid ${palette.line}; border-radius: 12px;
          padding: 10px 12px; margin-bottom: 12px;
        }
        .pack-cat {
          display: flex; align-items: center; gap: 4px;
          font-size: 12.5px; font-weight: 600; color: ${palette.moss}; margin: 0 0 4px 2px;
        }
        .pack-toggle { background: none; border: none; cursor: pointer; padding: 6px 0; }
        .pack-row {
          display: flex; align-items: center; gap: 12px; cursor: pointer;
          padding: 11px 12px; margin-bottom: 4px; border-radius: 10px; font-size: 15px; font-weight: 500;
          background: ${palette.panel}; border: 1px solid ${palette.line};
          -webkit-user-select: none; user-select: none;
        }
        .pack-row:active { transform: scale(0.99); }
        .pack-row.packed { opacity: 0.55; text-decoration: line-through; }
        .pack-done {
          text-align: center; padding: 18px 12px; margin-bottom: 14px; border-radius: 12px;
          background: ${palette.panel}; border: 1.5px solid ${palette.amber};
          animation: pop 0.35s ease-out;
        }
        @keyframes pop { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .menu-row {
          display: flex; align-items: center; gap: 10px; cursor: pointer;
          padding: 11px 10px; border-radius: 9px;
          border: 1px solid ${palette.line}; background: ${palette.panelAlt};
        }
        .menu-row:hover { border-color: ${palette.amber}; }
        .field-label { font-size: 12px; color: ${palette.textMuted}; margin: 14px 0 6px; display: block; }
      `}</style>

      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 10,
            }}
          >
            <div style={{ ...monoStyle, fontSize: 12, letterSpacing: "0.12em", color: palette.moss }}>
              {owner} · GEAR RECKONER
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <SyncStatus
                user={user}
                syncState={syncState}
                lastConfirmed={lastConfirmed}
                onSync={() => syncNow()}
                onSignIn={handleSignIn}
                onSignOut={handleSignOut}
              />
              <button className="action-btn" style={{ padding: "5px 8px" }} onClick={() => setSettingsOpen(true)} title="設定">
                <Settings size={14} />
              </button>
            </div>
          </div>

          {/* 活動切換 */}
          <div className="act-bar">
            <div className={`act-tab ${isLibrary ? "active" : ""}`} onClick={() => setView(ALL)}>
              <LayoutGrid size={15} /> 全部裝備{" "}
              <span className="count">{gear.length}</span>
            </div>
            {VISIBLE_ACTIVITIES.map((a) => {
              const Icon = ICONS[a.icon];
              const n = gear.filter((g) => g.activities.includes(a.key)).length;
              return (
                <div key={a.key} className={`act-tab ${view === a.key ? "active" : ""}`} onClick={() => setView(a.key)}>
                  <Icon size={15} /> {a.title}{" "}
                  <span className="count">{n}</span>
                </div>
              );
            })}
          </div>

          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 22,
              fontWeight: 700,
              margin: 0,
              letterSpacing: "-0.01em",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <ViewIcon size={21} style={{ color: palette.amber }} />
            {pageTitle}
          </h1>
          <p style={{ color: palette.textMuted, fontSize: 12.5, marginTop: 4, marginBottom: 10 }}>{pageHint}</p>

          {!isLibrary && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: "1 1 260px", minWidth: 200 }}>
                <input
                  className="title-input"
                  placeholder={
                    isWeightMode ? "幫這次紀錄取個標題，例如：台北大縱走 Day1" : `幫這次紀錄取個標題，例如：${activity.title}之旅`
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <button className="action-btn" onClick={handleExportImage}>
                <Download size={14} /> 匯出圖片
              </button>
              <button
                className="action-btn pack"
                onClick={() => setPacking(true)}
                disabled={checkedCount === 0}
                title={checkedCount === 0 ? "先勾選要帶的裝備" : undefined}
              >
                <Backpack size={14} />
                {currentItems().some((i) => packed[i.id]) ? "繼續打包" : "開始打包"}
              </button>
              <button className="action-btn primary" onClick={handleSaveRecord} disabled={saving}>
                {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                儲存
              </button>
            </div>
          )}
        </div>

        <div className="layout-grid">
          {/* Left: checklist */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {!dataReady ? (
              <div style={{ ...panelStyle, display: "flex", alignItems: "center", gap: 8, color: palette.textMuted, fontSize: 13 }}>
                <Loader2 size={14} className="spin" /> 讀取裝備清單中…
              </div>
            ) : viewGear.length === 0 ? (
              <section style={{ ...panelStyle, textAlign: "center", padding: "32px 20px" }}>
                <ViewIcon size={32} style={{ color: palette.moss }} />
                <div style={{ ...headingStyle, fontSize: 17, marginTop: 10 }}>
                  {isLibrary ? "裝備庫是空的" : `${activity.title}還沒有裝備`}
                </div>
                <p style={{ color: palette.textMuted, fontSize: 13, margin: "8px 0 18px", lineHeight: 1.6 }}>
                  {!isLibrary ? (
                    <>
                      從裝備庫挑要用在{activity.title}的裝備。
                      <br />
                      還沒建的裝備，請到「全部裝備」新增。
                    </>
                  ) : (
                    <>
                      先選類別，再填名稱、附註、重量，並勾選用在哪些活動。
                      {(isLibrary || view === DEFAULT_ACTIVITY) && gear.length === 0 && (
                        <>
                          <br />
                          也可以先載入範例清單，再改成自己的裝備。
                        </>
                      )}
                    </>
                  )}
                </p>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  {notInView.length > 0 && (
                    <button className="action-btn primary" onClick={() => setPicker(true)}>
                      <Library size={14} /> 從裝備庫加入
                    </button>
                  )}
                  <button className={`action-btn ${notInView.length > 0 ? "" : "primary"}`} onClick={() => openNewGear()}>
                    <Plus size={14} /> {isLibrary ? "新增裝備" : "到全部裝備新增"}
                  </button>
                  {(isLibrary || view === DEFAULT_ACTIVITY) && gear.length === 0 && (
                    <button className="action-btn" onClick={handleLoadSample}>
                      <FolderOpen size={14} /> 載入範例清單
                    </button>
                  )}
                </div>
              </section>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {isLibrary ? (
                    <button
                      className="action-btn"
                      style={{ borderStyle: "dashed", padding: 9, flex: "1 1 120px" }}
                      onClick={() => openNewGear()}
                    >
                      <Plus size={15} /> 新增裝備
                    </button>
                  ) : (
                    <button
                      className="action-btn"
                      style={{ borderStyle: "dashed", padding: 9, flex: "1 1 120px" }}
                      onClick={() => setPicker(true)}
                      disabled={notInView.length === 0}
                      title={notInView.length === 0 ? "裝備庫的裝備都已經在這個活動了" : undefined}
                    >
                      <Library size={15} /> 從裝備庫加入
                    </button>
                  )}
                </div>

                {gearByCat.map((cat) => {
                  const Icon = ICONS[cat.icon] || Tag;
                  const t = catTotals.find((c) => c.key === cat.key);
                  return (
                    <section key={cat.key} style={panelStyle}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Icon size={16} style={{ color: palette.moss }} />
                          <span style={headingStyle}>{cat.title}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ ...monoStyle, fontSize: 13, color: palette.textMuted }}>
                            {isLibrary
                              ? `${cat.items.length} 件`
                              : isWeightMode
                              ? formatWeight(t.value) === "—"
                                ? "0 g"
                                : formatWeight(t.value)
                              : `${t.count} / ${t.total}`}
                          </span>
                          {isLibrary && (
                            <button
                              className="icon-btn"
                              style={{ padding: 4 }}
                              title={`在「${cat.title}」新增裝備`}
                              onClick={() => openNewGear({ category: cat.key })}
                            >
                              <Plus size={15} />
                            </button>
                          )}
                        </div>
                      </div>

                      <SortableList
                        longPress
                        onMove={(from, to) => reorderGear(cat, from, to)}
                        style={{ display: "flex", flexDirection: "column", gap: 2 }}
                      >
                        {cat.items.map((it) => (
                          <div
                            key={it.id}
                            className={`item-row ${isLibrary ? "static" : checked[it.id] ? "on" : ""}`}
                            onClick={() => !isLibrary && !justDragged() && toggle(it.id)}
                          >
                            {!isLibrary && <CheckBox on={checked[it.id]} />}
                            <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 500 }}>
                              {it.name}
                              {it.note && <span style={{ color: palette.textFaint }}> · {it.note}</span>}
                            </div>
                            {isLibrary && <ActivityDots activities={it.activities} />}
                            {(isWeightMode || isLibrary || hasWeight(it.weight)) && (
                              <div
                                style={{
                                  ...monoStyle,
                                  fontSize: isWeightMode ? 13.5 : 12,
                                  fontWeight: 600,
                                  minWidth: 50,
                                  textAlign: "right",
                                  color: isWeightMode && checked[it.id] ? palette.text : palette.textFaint,
                                }}
                              >
                                {formatWeight(it.weight)}
                              </div>
                            )}
                            <button
                              className="icon-btn"
                              title="修改或刪除"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditor({ item: it });
                              }}
                            >
                              <Pencil size={13} />
                            </button>
                          </div>
                        ))}
                      </SortableList>
                    </section>
                  );
                })}
              </>
            )}

            {/* 臨時品項 */}
            {!isLibrary && (
              <section style={panelStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Plus size={16} style={{ color: palette.moss }} />
                    <span style={headingStyle}>{TEMP_CATEGORY_TITLE}</span>
                    <span style={{ fontSize: 11.5, color: palette.textFaint }}>（借用、租的、只帶這次的）</span>
                  </div>
                  {tempItems.length > 0 && (
                    <span style={{ ...monoStyle, fontSize: 13, color: palette.textMuted }}>
                      {isWeightMode ? formatWeight(tempTotal) : `${tempChecked.length} / ${tempItems.length}`}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: tempItems.length > 0 ? 12 : 0 }}>
                  {tempItems.map((it) => (
                    <div key={it.id} className="item-row on" style={{ cursor: "default" }}>
                      <div
                        style={{ cursor: "pointer" }}
                        onClick={() =>
                          setTempItems((prev) => prev.map((t) => (t.id === it.id ? { ...t, checked: !t.checked } : t)))
                        }
                      >
                        <CheckBox on={it.checked} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 500 }}>{it.name}</div>
                      {(isWeightMode || hasWeight(it.weight)) && (
                        <div
                          style={{
                            ...monoStyle,
                            fontSize: isWeightMode ? 13.5 : 12,
                            fontWeight: 600,
                            minWidth: 50,
                            textAlign: "right",
                            color: isWeightMode && it.checked ? palette.text : palette.textFaint,
                          }}
                        >
                          {formatWeight(it.weight)}
                        </div>
                      )}
                      <button
                        className="icon-btn"
                        title="移除"
                        onClick={() => setTempItems((prev) => prev.filter((t) => t.id !== it.id))}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    className="mini-input"
                    style={{ flex: "2 1 160px" }}
                    placeholder={isWeightMode ? "品項名稱，例如：租借頭盔" : "品項名稱，例如：租的雪板"}
                    value={newTempName}
                    onChange={(e) => setNewTempName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTempItem()}
                  />
                  <input
                    className="mini-input"
                    style={{ flex: "1 1 80px" }}
                    placeholder={isWeightMode ? "重量 (g)" : "重量 (可不填)"}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={newTempWeight}
                    onChange={(e) => setNewTempWeight(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTempItem()}
                  />
                  <button className="action-btn" onClick={addTempItem}>
                    <Plus size={14} /> 加入
                  </button>
                </div>
              </section>
            )}

            {/* 歷史紀錄 */}
            <section style={panelStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <History size={16} style={{ color: palette.moss }} />
                <span style={headingStyle}>{isLibrary ? "所有歷史紀錄" : `${activity.title}歷史紀錄`}</span>
              </div>

              {!dataReady ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: palette.textMuted, fontSize: 13 }}>
                  <Loader2 size={14} className="spin" /> 讀取紀錄中…
                </div>
              ) : sortedRecords.length === 0 ? (
                <div style={{ color: palette.textFaint, fontSize: 13 }}>
                  還沒有任何儲存紀錄，填好標題後按「儲存」就會出現在這裡。
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sortedRecords.map((r) => {
                    const ra = activityOf(r.activity);
                    const RIcon = ICONS[ra.icon];
                    return (
                      <div key={r.id} className="record-card">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</div>
                            <div style={{ fontSize: 11.5, color: palette.textFaint, marginTop: 3, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                              {isLibrary && (
                                <span className="act-badge">
                                  <RIcon size={10} /> {ra.title}
                                </span>
                              )}
                              {formatDate(r.date)} · {r.items.length} 件
                            </div>
                          </div>
                          <div style={{ ...monoStyle, fontSize: 15, fontWeight: 700, color: palette.amber, whiteSpace: "nowrap" }}>
                            {ra.mode === "weight" ? `${(r.total / 1000).toFixed(2)} kg` : `${r.items.length} 件`}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          <button className="action-btn" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => handleLoadRecord(r)}>
                            <FolderOpen size={12} /> 載入
                          </button>
                          <button className="action-btn" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => handleExportRecordImage(r)}>
                            <Download size={12} /> 圖片
                          </button>
                          <button
                            className="action-btn"
                            style={{ padding: "6px 10px", fontSize: 12, marginLeft: "auto" }}
                            onClick={() => handleDeleteRecord(r)}
                          >
                            <Trash2 size={12} /> 刪除
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 資料備份 */}
            <section style={panelStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <ShieldCheck size={16} style={{ color: palette.moss }} />
                <span style={headingStyle}>資料備份</span>
              </div>
              <p style={{ fontSize: 12.5, color: palette.textMuted, margin: "0 0 12px", lineHeight: 1.6 }}>
                把整個裝備庫和所有活動的紀錄存成一個備份檔，放在電腦、雲端硬碟或 LINE Keep。萬一資料出問題，用「匯入備份」就能救回來。
              </p>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  marginBottom: 12,
                  color: backupDue ? palette.amber : palette.moss,
                }}
              >
                {daysSinceBackup === null
                  ? "還沒備份過"
                  : daysSinceBackup === 0
                  ? "今天已備份 ✓"
                  : `上次備份：${daysSinceBackup} 天前`}
                {backupDue && "，建議現在備份一次"}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="action-btn primary" onClick={handleExportBackup} disabled={!dataReady}>
                  <Download size={14} /> 匯出備份
                </button>
                <button className="action-btn" onClick={() => importInput.current.click()} disabled={!dataReady}>
                  <Upload size={14} /> 匯入備份
                </button>
                <input
                  ref={importInput}
                  type="file"
                  accept=".json,application/json"
                  style={{ display: "none" }}
                  onChange={handleImportBackup}
                />
              </div>
            </section>
          </div>

          {/* Right: summary */}
          <div style={{ position: "sticky", top: 12, alignSelf: "start" }}>
            {isLibrary ? (
              <LibrarySummary gear={gear} panelStyle={panelStyle} />
            ) : isWeightMode ? (
              <div style={{ ...panelStyle, padding: 16 }}>
                <div style={{ fontSize: 12, letterSpacing: "0.08em", color: palette.textMuted, marginBottom: 6 }}>
                  目前裝備總重
                </div>
                <div
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 38,
                    fontWeight: 700,
                    lineHeight: 1.1,
                    color: overTarget ? palette.warn : palette.amber,
                  }}
                >
                  {(grandTotal / 1000).toFixed(2)}
                  <span style={{ fontSize: 18, color: palette.textMuted }}> kg</span>
                </div>
                <div style={{ ...monoStyle, fontSize: 13, color: palette.textMuted, marginTop: 2 }}>
                  {grandTotal.toLocaleString()} g · {checkedCount} 件
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: overTarget ? palette.warn : palette.moss,
                    marginTop: 6,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {overTarget
                    ? `超出舒適重量 ${targetG / 1000}kg 目標 ${formatWeight(deltaFromTarget)}`
                    : `距離舒適重量 ${targetG / 1000}kg 目標還有 ${formatWeight(deltaFromTarget)}`}
                  <button className="text-link" onClick={handleEditTarget}>
                    <Target size={11} style={{ verticalAlign: -1 }} /> 調整目標
                  </button>
                </div>

                {/* Mountain gauge */}
                <div style={{ marginTop: 18, marginBottom: 4 }}>
                  <svg viewBox="0 0 200 180" width="100%" height="150">
                    <defs>
                      <linearGradient id="fillGrad" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" style={{ stopColor: palette.amber }} />
                        <stop offset="100%" style={{ stopColor: palette.moss }} />
                      </linearGradient>
                      <clipPath id="mountainClip">
                        <path d="M10 160 L60 70 L85 100 L120 40 L150 90 L190 160 Z" />
                      </clipPath>
                    </defs>
                    {[40, 75, 110, 145].map((y, i) => (
                      <line key={i} x1="8" y1={y} x2="192" y2={y} style={{ stroke: palette.line }} strokeWidth="1" strokeDasharray="2 4" />
                    ))}
                    <path
                      d="M10 160 L60 70 L85 100 L120 40 L150 90 L190 160 Z"
                      fill="none"
                      style={{ stroke: palette.textFaint }}
                      strokeWidth="1.5"
                    />
                    <g clipPath="url(#mountainClip)">
                      <rect
                        x="0"
                        y={160 - (fillPercent / 100) * 130}
                        width="200"
                        height="180"
                        fill="url(#fillGrad)"
                        opacity="0.85"
                      />
                    </g>
                    <line x1="10" y1="160" x2="190" y2="160" style={{ stroke: palette.textFaint }} strokeWidth="1.5" />
                    <line
                      x1="6"
                      y1={160 - (targetPercent / 100) * 130}
                      x2="194"
                      y2={160 - (targetPercent / 100) * 130}
                      style={{ stroke: palette.warn }}
                      strokeWidth="1.5"
                      strokeDasharray="5 3"
                    />
                    <text
                      x="196"
                      y={160 - (targetPercent / 100) * 130 + 4}
                      fontSize="9"
                      style={{ fill: palette.warn }}
                      textAnchor="end"
                      fontFamily="'JetBrains Mono', monospace"
                    >
                      {targetG / 1000}kg 目標
                    </text>
                  </svg>
                  <div
                    style={{
                      ...monoStyle,
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 10,
                      color: palette.textFaint,
                      marginTop: -6,
                    }}
                  >
                    <span>0 kg</span>
                    <span>量規滿刻度 {maxScaleG / 1000} kg</span>
                  </div>
                </div>

                <Breakdown
                  rows={[...catTotals, { key: "temp", label: TEMP_CATEGORY_TITLE, value: tempTotal }]
                    .filter((row) => row.value > 0)
                    .map((row) => ({ key: row.key, label: row.label, text: formatWeight(row.value), ratio: grandTotal > 0 ? row.value / grandTotal : 0 }))}
                />
              </div>
            ) : (
              <div style={{ ...panelStyle, padding: 16 }}>
                <div style={{ fontSize: 12, letterSpacing: "0.08em", color: palette.textMuted, marginBottom: 6 }}>
                  已準備的裝備
                </div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 38, fontWeight: 700, lineHeight: 1.1, color: palette.amber }}>
                  {checkedCount}
                  <span style={{ fontSize: 18, color: palette.textMuted }}> / {itemCount} 件</span>
                </div>
                {grandTotal > 0 && (
                  <div style={{ ...monoStyle, fontSize: 12, color: palette.textFaint, marginTop: 4 }}>
                    參考重量 {formatWeight(grandTotal)}（有填重量的才算）
                  </div>
                )}
                <div style={{ height: 8, borderRadius: 4, background: palette.panelAlt, overflow: "hidden", marginTop: 14 }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${itemCount > 0 ? (checkedCount / itemCount) * 100 : 0}%`,
                      background: palette.moss,
                      borderRadius: 4,
                      transition: "width 0.2s",
                    }}
                  />
                </div>
                <Breakdown
                  rows={[
                    ...catTotals.map((c) => ({ key: c.key, label: c.label, text: `${c.count} / ${c.total}`, ratio: c.total ? c.count / c.total : 0 })),
                    ...(tempItems.length
                      ? [{ key: "temp", label: TEMP_CATEGORY_TITLE, text: `${tempChecked.length} / ${tempItems.length}`, ratio: tempChecked.length / tempItems.length }]
                      : []),
                  ]}
                />
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 12,
                padding: "10px 12px",
                background: palette.panelAlt,
                borderRadius: 10,
                fontSize: 11.5,
                color: palette.textMuted,
                border: `1px solid ${palette.line}`,
                lineHeight: 1.6,
              }}
            >
              <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                {isLibrary
                  ? "點裝備可以修改名稱、重量和活動標籤。刪除裝備會從所有活動移除。"
                  : "儲存的紀錄會保留當下完整的品名與重量，之後修改或刪除裝備，不會影響舊紀錄。每個活動的勾選內容各自分開。"}
                {user
                  ? "資料存在你的 Google 帳號雲端空間，手機和電腦登入同一帳號即自動同步，僅你可見。"
                  : "目前資料只存在這台裝置，登入後會自動搬上雲端。"}
              </span>
            </div>
          </div>
        </div>

        <div style={{ ...monoStyle, textAlign: "center", fontSize: 11, color: palette.textFaint, marginTop: 16 }}>
          Gear Reckoner v{APP_VERSION}
        </div>
      </div>

      {/* 手機版：底部固定顯示總重 / 件數 */}
      <div className="mobile-total-bar">
        {isLibrary ? (
          <span style={{ fontSize: 13, color: palette.textMuted }}>
            裝備庫 <b style={{ color: palette.amber, fontSize: 18 }}>{gear.length}</b> 件
          </span>
        ) : isWeightMode ? (
          <>
            <span style={{ fontSize: 12, color: palette.textMuted }}>總重</span>
            <span
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 22,
                fontWeight: 700,
                color: overTarget ? palette.warn : palette.amber,
              }}
            >
              {(grandTotal / 1000).toFixed(2)}
              <span style={{ fontSize: 13, color: palette.textMuted }}> kg</span>
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: overTarget ? palette.warn : palette.moss }}>
              {overTarget ? `超標 ${formatWeight(deltaFromTarget)}` : `餘裕 ${formatWeight(deltaFromTarget)}`}
            </span>
          </>
        ) : (
          <>
            <ListChecks size={18} style={{ color: palette.moss }} />
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, color: palette.amber }}>
              {checkedCount}
              <span style={{ fontSize: 13, color: palette.textMuted }}> / {itemCount} 件</span>
            </span>
          </>
        )}
        {dataReady &&
          (isLibrary ? (
            <button className="action-btn primary" style={{ marginLeft: "auto", padding: "7px 12px" }} onClick={() => openNewGear()}>
              <Plus size={14} /> 裝備
            </button>
          ) : (
            notInView.length > 0 && (
              <button className="action-btn primary" style={{ marginLeft: "auto", padding: "7px 12px" }} onClick={() => setPicker(true)}>
                <Library size={14} /> 加入
              </button>
            )
          ))}
      </div>

      {editor && (
        <GearEditor
          item={editor.item}
          categories={categories}
          onSave={handleSaveGear}
          onDelete={handleDeleteGear}
          onAddCategory={handleAddCategory}
          onDeleteCategory={handleDeleteCategory}
          onClose={() => setEditor(null)}
        />
      )}

      {packing && (
        <PackingView
          activity={activity}
          title={title.trim()}
          items={currentItems()}
          packed={packed}
          isWeightMode={isWeightMode}
          saving={saving}
          onToggle={(id) => setPacked((prev) => ({ ...prev, [id]: !prev[id] }))}
          onReset={() => confirm("要清除打包進度，重新開始嗎？") && setPacked({})}
          onBack={() => setPacking(false)}
          onSave={handleSaveRecord}
        />
      )}

      {settingsOpen && (
        <SettingsSheet
          themeKey={themeKey}
          onChooseTheme={chooseTheme}
          categories={categories}
          gear={gear}
          onCategoryReorder={reorderCategories}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {picker && (
        <LibraryPicker
          activity={activity}
          gear={notInView}
          categories={categories}
          onAdd={handleAddFromLibrary}
          onClose={() => setPicker(false)}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------
// 設定（全螢幕）：第一層是選單，點進去是各個設定頁
// 之後要加新的設定，在 pages 加一項、再加一個對應的頁面即可
// ------------------------------------------------------------
function SettingsSheet({ themeKey, onChooseTheme, categories, gear, onCategoryReorder, onClose }) {
  const [page, setPage] = useState(null); // null = 選單

  const pages = [
    {
      key: "theme",
      title: "佈景主題",
      icon: Palette,
      desc: THEME_OPTIONS.find((t) => t.key === themeKey)?.title,
    },
    { key: "categories", title: "類別排序", icon: ArrowUpDown, desc: `${categories.length} 個類別` },
  ];
  const current = pages.find((p) => p.key === page);

  return (
    <FullPage title={current ? current.title : "設定"} backLabel={current ? "設定" : "返回"} onBack={() => (page ? setPage(null) : onClose())}>
        {!current && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {pages.map((p) => (
              <div key={p.key} className="menu-row" onClick={() => setPage(p.key)}>
                <p.icon size={17} style={{ color: palette.moss }} />
                <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{p.title}</span>
                <span style={{ fontSize: 12.5, color: palette.textFaint }}>{p.desc}</span>
                <ChevronRight size={16} style={{ color: palette.textFaint }} />
              </div>
            ))}
          </div>
        )}

        {page === "theme" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {THEME_OPTIONS.map((t) => {
                const c = THEMES[t.key];
                const on = t.key === themeKey;
                return (
                  <div
                    key={t.key}
                    onClick={() => onChooseTheme(t.key)}
                    style={{
                      cursor: "pointer",
                      borderRadius: 12,
                      padding: 10,
                      background: c.bg,
                      border: `2px solid ${on ? c.amber : c.line}`,
                      color: c.text,
                    }}
                  >
                    <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                      {[c.panel, c.amber, c.moss].map((col, i) => (
                        <span key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: col, border: `1px solid ${c.line}` }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                      {on && <Check size={13} style={{ color: c.amber }} />}
                      {t.title}
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: 12, color: palette.textFaint, marginTop: 8, marginBottom: 0 }}>
              選擇會存在帳號裡，手機和電腦會用同一個主題。
            </p>
          </>
        )}

        {page === "categories" && (
          <>
            <p style={{ fontSize: 12, color: palette.textFaint, margin: "0 0 8px" }}>
              按住左邊的 <GripVertical size={11} style={{ verticalAlign: -1 }} /> 拖到想要的位置，所有活動共用這個順序。
            </p>
            <SortableList onMove={onCategoryReorder} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {categories.map((cat) => {
                const Icon = ICONS[cat.icon] || Tag;
                const n = gear.filter((g) => g.category === cat.key).length;
                return (
                  <div key={cat.key} className="drag-row">
                    <DragHandle />
                    <Icon size={15} style={{ color: palette.moss }} />
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 13.5 }}>{cat.title}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: palette.textFaint }}>
                      {n} 件
                    </span>
                  </div>
                );
              })}
            </SortableList>
          </>
        )}
    </FullPage>
  );
}

// ------------------------------------------------------------
// 全螢幕頁面：內容從上方開始排（不會因為內容多寡而上下彈跳），左上角返回
// ------------------------------------------------------------
function FullPage({ title, backLabel = "返回", onBack, right, children }) {
  useEscape(onBack);
  // 開著的時候，後面的主畫面不要跟著捲動
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div className="fullpage">
      <div className="fullpage-head">
        <button className="back-btn" onClick={onBack}>
          <ChevronLeft size={20} /> {backLabel}
        </button>
        <span className="fullpage-title">{title}</span>
        <div style={{ minWidth: 70, display: "flex", justifyContent: "flex-end" }}>{right}</div>
      </div>
      <div className="fullpage-body">{children}</div>
    </div>
  );
}

// ------------------------------------------------------------
// 打包模式：照著勾好的清單，一件一件確認真的裝進包包
// 點一下 = 已打包（收到下方「已打包」）；再點一下可以取消
// ------------------------------------------------------------
function PackingView({ activity, title, items, packed, isWeightMode, saving, onToggle, onReset, onBack, onSave }) {
  const [showPacked, setShowPacked] = useState(false);
  const todo = items.filter((i) => !packed[i.id]);
  const done = items.filter((i) => packed[i.id]);
  const allDone = items.length > 0 && todo.length === 0;
  const sum = (list) => list.reduce((s, i) => s + (hasWeight(i.weight) ? i.weight : 0), 0);
  const pct = items.length ? (done.length / items.length) * 100 : 0;

  const prevDone = useRef(allDone);
  useEffect(() => {
    if (allDone && !prevDone.current && navigator.vibrate) navigator.vibrate([20, 40, 20]);
    prevDone.current = allDone;
  }, [allDone]);

  // 用一般函式產生每一行（不是元件），點擊時不會整排重建
  const row = (it, isPacked) => (
    <div key={it.id} className={`pack-row ${isPacked ? "packed" : ""}`} onClick={() => onToggle(it.id)}>
      <CheckBox on={isPacked} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {it.name}
        {it.note && <span style={{ color: palette.textFaint, fontSize: 13 }}> · {it.note}</span>}
      </div>
      {hasWeight(it.weight) && (
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: palette.textFaint }}>
          {formatWeight(it.weight)}
        </span>
      )}
    </div>
  );

  return (
    <FullPage
      title={`打包中：${title || activity.title}`}
      backLabel="規劃"
      onBack={onBack}
      right={
        done.length > 0 && (
          <button className="text-link" onClick={onReset} title="清除打包進度">
            <RotateCcw size={12} style={{ verticalAlign: -1 }} /> 重新打包
          </button>
        )
      }
    >
      {/* 進度 */}
      <div className="pack-progress">
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 700, color: palette.amber }}>
            {done.length}
            <span style={{ fontSize: 15, color: palette.textMuted }}> / {items.length} 件</span>
          </span>
          {isWeightMode && (
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: palette.textMuted, marginLeft: "auto" }}>
              {(sum(done) / 1000).toFixed(2)} / {(sum(items) / 1000).toFixed(2)} kg
            </span>
          )}
        </div>
        <div style={{ height: 8, borderRadius: 4, background: palette.panelAlt, overflow: "hidden", marginTop: 6 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: palette.amber, borderRadius: 4, transition: "width 0.25s" }} />
        </div>
      </div>

      {allDone && (
        <div className="pack-done">
          <PartyPopper size={30} style={{ color: palette.amber }} />
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, marginTop: 6 }}>全部打包完成！</div>
          <div style={{ fontSize: 13, color: palette.textMuted, marginTop: 4 }}>祝{activity.title}順利 🎉</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
            <button className="action-btn primary" disabled={saving} onClick={async () => (await onSave()) && onBack()}>
              {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />} 儲存這筆紀錄
            </button>
            <button className="action-btn" onClick={onBack}>
              先不用
            </button>
          </div>
        </div>
      )}

      {/* 還沒打包的，依類別分組 */}
      {itemsToGroups(todo).map((g) => (
        <div key={g.title} style={{ marginBottom: 10 }}>
          <div className="pack-cat">{g.title}</div>
          {g.items.map((it) => row(it, false))}
        </div>
      ))}

      {/* 已打包：收起來，點開可以看、可以取消 */}
      {done.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <button className="pack-cat pack-toggle" onClick={() => setShowPacked((v) => !v)}>
            {showPacked ? <ChevronDown size={14} /> : <ChevronRight size={14} />} 已打包（{done.length}）
          </button>
          {showPacked && done.map((it) => row(it, true))}
        </div>
      )}
    </FullPage>
  );
}

// 打包清單依類別分組（保留原本順序）
function itemsToGroups(items) {
  const groups = [];
  items.forEach((it) => {
    let g = groups.find((x) => x.title === it.cat);
    if (!g) groups.push((g = { title: it.cat, items: [] }));
    g.items.push(it);
  });
  return groups;
}

// 「全部裝備」每件裝備右邊的活動小圓點
function ActivityDots({ activities }) {
  if (!VISIBLE_ACTIVITIES.some((a) => activities.includes(a.key))) {
    return (
      <div className="act-dots" title="還沒指定活動">
        <span className="act-dot none">?</span>
      </div>
    );
  }
  return (
    <div className="act-dots" title={VISIBLE_ACTIVITIES.filter((a) => activities.includes(a.key)).map((a) => a.title).join("、")}>
      {VISIBLE_ACTIVITIES.filter((a) => activities.includes(a.key)).map((a) => {
        const Icon = ICONS[a.icon];
        return (
          <span key={a.key} className="act-dot">
            <Icon size={11} />
          </span>
        );
      })}
    </div>
  );
}

// 右側的分類小計長條
function Breakdown({ rows }) {
  return (
    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((row) => (
        <div key={row.key}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: palette.textMuted, marginBottom: 3 }}>
            <span>{row.label}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{row.text}</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: palette.panelAlt, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${row.ratio * 100}%`, background: row.color || palette.moss, borderRadius: 3 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// 「全部裝備」右側：每個活動有幾件
function LibrarySummary({ gear, panelStyle }) {
  const untagged = gear.filter((g) => !VISIBLE_ACTIVITIES.some((a) => g.activities.includes(a.key))).length;
  return (
    <div style={{ ...panelStyle, padding: 16 }}>
      <div style={{ fontSize: 12, letterSpacing: "0.08em", color: palette.textMuted, marginBottom: 6 }}>裝備庫</div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 38, fontWeight: 700, lineHeight: 1.1, color: palette.amber }}>
        {gear.length}
        <span style={{ fontSize: 18, color: palette.textMuted }}> 件</span>
      </div>
      <Breakdown
        rows={[
          ...VISIBLE_ACTIVITIES.map((a) => {
            const n = gear.filter((g) => g.activities.includes(a.key)).length;
            return { key: a.key, label: a.title, text: `${n} 件`, ratio: gear.length ? n / gear.length : 0 };
          }),
          ...(untagged ? [{ key: "none", label: "未分活動", text: `${untagged} 件`, ratio: untagged / gear.length }] : []),
        ]}
      />
    </div>
  );
}

// ------------------------------------------------------------
// 拖曳排序（SortableJS）：按住 ⠿ 把手拖曳
// 拖完先把畫面還原，再由資料更新後重新排列，避免跟 React 打架
// 用完整網址動態載入（不放 index.html 的 import map）：更新後第一次打開時
// 瀏覽器可能還拿著舊的 index.html，這樣才不會因此載入失敗
// ------------------------------------------------------------
const SORTABLE_URL = "https://esm.sh/sortablejs@1.15.6";
const LONG_PRESS_MS = 300;

// 長按觸發拖曳後放開時，瀏覽器還會送一次「點擊」→ 用這個時間戳記把它擋掉，避免誤勾選
let lastDragAt = 0;
const justDragged = () => Date.now() - lastDragAt < 400;

// longPress：長按整行拖曳（手指一碰就滑動 = 捲動畫面，不會誤拖）；否則按住 ⠿ 把手拖曳
function SortableList({ onMove, style, children, longPress = false }) {
  const ref = useRef(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  useEffect(() => {
    let sortable = null;
    let cancelled = false;
    // Sortable 在一般快速點擊放開時也會送出 unchoose，所以要記住「真的有長按拿起來」才擋點擊
    let picked = false;
    import(SORTABLE_URL).then(({ default: Sortable }) => {
      if (cancelled) return;
      sortable = Sortable.create(ref.current, {
        ...(longPress
          ? {
              delay: LONG_PRESS_MS,
              delayOnTouchOnly: false,
              touchStartThreshold: 6,
              filter: ".icon-btn", // 按 ✎ 不會開始拖曳
              preventOnFilter: false,
            }
          : { handle: ".drag-handle" }),
        animation: 150,
        forceFallback: true, // 電腦和手機用同一套拖曳方式
        ghostClass: "drag-ghost",
        chosenClass: "drag-chosen",
        onChoose: () => {
          picked = true;
          if (longPress && navigator.vibrate) navigator.vibrate(10); // Android 輕震提示「可以拖了」
        },
        onUnchoose: () => {
          if (picked) lastDragAt = Date.now();
          picked = false;
        },
        onEnd: ({ item, from, oldIndex, newIndex }) => {
          if (oldIndex === newIndex) return;
          from.removeChild(item);
          from.insertBefore(item, from.children[oldIndex] || null);
          onMoveRef.current(oldIndex, newIndex);
        },
      });
    });
    return () => {
      cancelled = true;
      if (sortable) sortable.destroy();
    };
  }, []);
  return (
    <div ref={ref} style={style}>
      {children}
    </div>
  );
}

function DragHandle() {
  return (
    <span className="drag-handle" title="按住拖曳">
      <GripVertical size={16} />
    </span>
  );
}

function CheckBox({ on }) {
  return (
    <div className={`checkbox ${on ? "on" : ""}`}>
      {on && (
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M1 5L4 8L9 2" style={{ stroke: palette.onAccent }} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

function useEscape(onClose) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

// ------------------------------------------------------------
// 新增 / 修改裝備的面板（像記帳 App：先選活動、類別，再填名稱、附註、重量）
// ------------------------------------------------------------
function GearEditor({ item, categories, onSave, onDelete, onAddCategory, onDeleteCategory, onClose }) {
  const isNew = !item.id;
  const [acts, setActs] = useState(item.activities || []);
  const [category, setCategory] = useState(item.category || "");
  const [name, setName] = useState(item.name || "");
  const [note, setNote] = useState(item.note || "");
  const [weight, setWeight] = useState(hasWeight(item.weight) ? String(item.weight) : "");
  const [error, setError] = useState("");
  useEscape(onClose);

  const weightMatters = acts.some((a) => activityOf(a).mode === "weight");
  const selectedCat = categories.find((c) => c.key === category);

  const toggleAct = (key) => setActs((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const submit = () => {
    const w = parseFloat(weight);
    if (!category) return setError("請先選一個類別");
    if (!name.trim()) return setError("請填裝備名稱");
    if (weight.trim() && (isNaN(w) || w < 0)) return setError("重量請填數字（公克），或留空");
    onSave({
      ...item,
      activities: ACTIVITIES.map((a) => a.key).filter((k) => acts.includes(k)),
      category,
      name: name.trim(),
      note: note.trim(),
      weight: hasWeight(w) ? Math.round(w * 10) / 10 : null,
    });
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17 }}>
            {isNew ? "新增裝備" : "修改裝備"}
          </span>
          <button className="icon-btn" onClick={onClose} title="關閉">
            <X size={18} />
          </button>
        </div>

        <span className="field-label">用在哪些活動（可複選）</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {VISIBLE_ACTIVITIES.map((a) => {
            const Icon = ICONS[a.icon];
            return (
              <span key={a.key} className={`act-chip ${acts.includes(a.key) ? "selected" : ""}`} onClick={() => toggleAct(a.key)}>
                {acts.includes(a.key) ? <Check size={13} /> : <Icon size={13} />} {a.title}
              </span>
            );
          })}
        </div>

        <span className="field-label">類別</span>
        <div className="cat-grid">
          {categories.map((c) => {
            const Icon = ICONS[c.icon] || Tag;
            return (
              <div
                key={c.key}
                className={`cat-chip ${category === c.key ? "selected" : ""}`}
                onClick={() => setCategory(c.key)}
              >
                <Icon size={18} />
                {c.title}
              </div>
            );
          })}
          <div
            className="cat-chip add"
            onClick={() => {
              const key = onAddCategory();
              if (key) setCategory(key);
            }}
          >
            <Plus size={18} />
            自訂類別
          </div>
        </div>
        {selectedCat?.custom && (
          <button
            className="text-link"
            style={{ marginTop: 8 }}
            onClick={() => onDeleteCategory(selectedCat.key) && setCategory("")}
          >
            刪除「{selectedCat.title}」這個自訂類別
          </button>
        )}

        <label className="field-label">名稱</label>
        <input
          className="title-input"
          placeholder="例如：Montbell 雨衣"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label className="field-label">附註（顏色、尺寸、備註…可不填）</label>
        <input
          className="title-input"
          style={{ fontWeight: 400, fontSize: 14 }}
          placeholder="例如：黃・M 號"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <label className="field-label">
          重量（公克 g）{weightMatters ? "・登山會用來算總重" : "・可不填"}
        </label>
        <input
          className="title-input"
          type="number"
          inputMode="decimal"
          min="0"
          placeholder={weightMatters ? "例如：269" : "可不填"}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />

        {error && <div style={{ color: palette.warn, fontSize: 12.5, marginTop: 10 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          {!isNew && (
            <button className="action-btn danger" onClick={() => onDelete(item)}>
              <Trash2 size={14} /> 刪除
            </button>
          )}
          <button className="action-btn" style={{ marginLeft: "auto" }} onClick={onClose}>
            取消
          </button>
          <button className="action-btn primary" onClick={submit}>
            <Save size={14} /> {isNew ? "新增" : "儲存"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// 從裝備庫加入：把已經有的裝備貼上目前活動的標籤
// ------------------------------------------------------------
function LibraryPicker({ activity, gear, categories, onAdd, onClose }) {
  const [selected, setSelected] = useState([]);
  useEscape(onClose);
  const toggle = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const known = new Set(categories.map((c) => c.key));
  const groups = categories
    .map((cat) => ({
      ...cat,
      items: gear.filter((g) => g.category === cat.key || (cat.key === "other" && !known.has(g.category))),
    }))
    .filter((c) => c.items.length > 0);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17 }}>
            從裝備庫加入{activity.title}
          </span>
          <button className="icon-btn" onClick={onClose} title="關閉">
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: 12.5, color: palette.textMuted, margin: "6px 0 12px", lineHeight: 1.6 }}>
          勾選要一起用在{activity.title}的裝備。裝備還是同一件，改重量或名稱時每個活動都會一起更新。
        </p>
        {groups.map((cat) => {
          const Icon = ICONS[cat.icon] || Tag;
          return (
            <div key={cat.key} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: palette.moss, fontWeight: 600, marginBottom: 4 }}>
                <Icon size={13} /> {cat.title}
              </div>
              {cat.items.map((g) => (
                <div key={g.id} className={`item-row ${selected.includes(g.id) ? "on" : ""}`} onClick={() => toggle(g.id)}>
                  <CheckBox on={selected.includes(g.id)} />
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13.5 }}>
                    {g.name}
                    {g.note && <span style={{ color: palette.textFaint }}> · {g.note}</span>}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
        <div className="sheet-footer">
          <button className="action-btn" onClick={onClose}>
            取消
          </button>
          <button className="action-btn primary" disabled={selected.length === 0} onClick={() => onAdd(selected)}>
            <Plus size={14} /> {selected.length ? `加入 ${selected.length} 件` : "加入"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// 右上角的同步狀態：本機模式 / 登入按鈕 / 已同步
// ------------------------------------------------------------
function SyncStatus({ user, syncState, lastConfirmed, onSync, onSignIn, onSignOut }) {
  const chip = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    padding: "5px 10px",
    borderRadius: 20,
    border: `1px solid ${palette.line}`,
    background: palette.panel,
    color: palette.textMuted,
    whiteSpace: "nowrap",
  };

  if (!store.cloudEnabled) {
    return (
      <div style={chip} title="尚未設定 firebase-config.js，資料只存在這台裝置">
        <HardDrive size={13} /> 本機模式
      </div>
    );
  }
  if (user === undefined) {
    return (
      <div style={chip}>
        <Loader2 size={13} className="spin" /> 連線中…
      </div>
    );
  }
  if (!user) {
    return (
      <button className="action-btn primary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={onSignIn}>
        <LogIn size={13} /> 用 Google 登入同步
      </button>
    );
  }

  const status = {
    offline: { color: palette.amber, icon: <CloudOff size={13} />, text: "離線中・連線後自動同步" },
    syncing: { color: palette.textMuted, icon: <Loader2 size={13} className="spin" />, text: "同步中…" },
    uploading: { color: palette.amber, icon: <Loader2 size={13} className="spin" />, text: "上傳中…" },
    connecting: { color: palette.textMuted, icon: <Loader2 size={13} className="spin" />, text: "連線中…" },
    synced: {
      color: palette.moss,
      icon: <Cloud size={13} />,
      text: lastConfirmed ? `已同步 · ${formatClock(lastConfirmed)} 確認` : "已同步",
    },
  }[syncState];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ ...chip, color: status.color }} title={user.email}>
        {status.icon}
        {status.text}
      </div>
      <button
        className="action-btn"
        style={{ padding: "5px 8px", fontSize: 12 }}
        onClick={onSync}
        disabled={syncState === "syncing"}
        title="立即同步"
      >
        <RefreshCw size={13} className={syncState === "syncing" ? "spin" : ""} />
      </button>
      <button className="action-btn" style={{ padding: "5px 8px", fontSize: 12 }} onClick={onSignOut} title={`登出 ${user.email}`}>
        <LogOut size={13} />
      </button>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<GearReckoner />);

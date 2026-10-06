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
} from "lucide-react";
import {
  PRESET_CATEGORIES,
  TEMP_CATEGORY_TITLE,
  DEFAULT_TARGET_G,
  SAMPLE_GEAR,
  SAMPLE_DEFAULT_ON,
  upgradeLegacyRecord,
} from "./gear-data.js";
import * as store from "./storage.js";

// 版本號：每次更新記得同步修改 sw.js 的 CACHE_VERSION 與 CHANGELOG.md
const APP_VERSION = "2.0.0";
// 備份檔格式版本：備份檔結構有變才加 1，並在 normalizeBackup 處理舊格式
const BACKUP_SCHEMA = 2;
const DRAFT_KEY = "gear-draft"; // 目前畫面上的勾選狀態（只存本機，下次打開還在）
const BACKUP_REMIND_DAYS = 30;

const ICONS = { Footprints, Shirt, Backpack, Tent, CookingPot, Droplet, Flashlight, Glasses, Cross, Package, Tag };

function formatWeight(g) {
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

const palette = {
  bg: "#10161A",
  panel: "#1A2420",
  panelAlt: "#212D27",
  line: "#324139",
  amber: "#E3A542",
  moss: "#7FA88F",
  text: "#EDEDE6",
  textMuted: "#93A69A",
  textFaint: "#5D6E64",
  warn: "#D9634B",
};

const fontStack =
  '"PingFang TC", "Microsoft JhengHei", "Noto Sans TC", "Helvetica Neue", Arial, sans-serif';

// ------------------------------------------------------------
// 匯出成 PNG 圖片：純 Canvas 繪製，不依賴外部套件
// sections: [{ title, lines: [{ name, weight }] }]
// ------------------------------------------------------------
function drawSnapshotToPng({ owner, title, date, sections, total }) {
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
  ctx.fillText(title || "登山裝備紀錄", 32, 78);

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
      ctx.fillText(line.name, 44, y);
      ctx.textAlign = "right";
      ctx.fillStyle = palette.textMuted;
      ctx.font = `600 14px ${fontStack}`;
      ctx.fillText(formatWeight(line.weight), width - 32, y);
      ctx.textAlign = "left";
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
  ctx.fillText("總重量", 32, y);
  y += 40;
  ctx.fillStyle = palette.amber;
  ctx.font = `700 40px ${fontStack}`;
  ctx.fillText(`${(total / 1000).toFixed(2)} kg`, 32, y);
  ctx.fillStyle = palette.textMuted;
  ctx.font = `500 14px ${fontStack}`;
  ctx.fillText(`${total.toLocaleString()} g`, 32, y + 22);

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

function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY)) || {};
  } catch (e) {
    return {};
  }
}

const newId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

/** 讀進來的備份檔 → 統一成目前格式。未來備份格式改版時在這裡加轉換 */
function normalizeBackup(data) {
  if (!data || data.app !== "gear-reckoner") throw new Error("這不是裝備試算 App 的備份檔");
  if (data.schema > BACKUP_SCHEMA) throw new Error("這個備份檔來自更新的 App 版本，請先重新整理 App 更新到最新版");
  return {
    gear: Array.isArray(data.gear) ? data.gear : [],
    records: (Array.isArray(data.records) ? data.records : []).map(upgradeLegacyRecord),
    settings: data.settings || {},
  };
}

function GearReckoner() {
  const [draft] = useState(loadDraft);

  // 登入狀態：undefined = 確認中、null = 未登入/本機模式、物件 = 已登入
  const [user, setUser] = useState(undefined);
  const [online, setOnline] = useState(navigator.onLine);

  // 雲端（或本機）資料
  const [gear, setGear] = useState([]);
  const [records, setRecords] = useState([]);
  const [metaDocs, setMetaDocs] = useState([]);
  const [loaded, setLoaded] = useState({});

  // 目前畫面上的狀態（存在這台裝置的草稿）
  const [checked, setChecked] = useState(draft.checked || {});
  const [title, setTitle] = useState(draft.title || "");
  const [tempItems, setTempItems] = useState(draft.tempItems || draft.customItems || []);
  const [newTempName, setNewTempName] = useState("");
  const [newTempWeight, setNewTempWeight] = useState("");

  const [editor, setEditor] = useState(null); // null 或 { item }（item.id 不存在代表新增）
  const [saving, setSaving] = useState(false);
  const importInput = useRef(null);
  const upgradedIds = useRef(new Set());

  useEffect(() => store.watchAuth(setUser), []);

  useEffect(() => {
    if (user === undefined) return;
    setLoaded({});
    const setters = { gear: setGear, records: setRecords, meta: setMetaDocs };
    const unsubs = store.COLLECTIONS.map((name) =>
      store.watch(user, name, (docs) => {
        setters[name](docs);
        setLoaded((prev) => ({ ...prev, [name]: true }));
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [user]);

  // v1.x 舊格式紀錄 → 自動轉成新格式並存回去
  useEffect(() => {
    const legacy = records.filter((r) => !Array.isArray(r.items) && !upgradedIds.current.has(r.id));
    if (legacy.length === 0) return;
    legacy.forEach((r) => upgradedIds.current.add(r.id));
    store.putMany(user, "records", legacy.map(upgradeLegacyRecord));
  }, [records, user]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ checked, title, tempItems }));
    } catch (e) {
      // 本機儲存空間不可用（例如無痕模式），不影響使用
    }
  }, [checked, title, tempItems]);

  // ---------- 衍生資料 ----------
  const meta = metaDocs.find((d) => d.id === "settings") || {};
  const saveMeta = (changes) => store.put(user, "meta", { ...meta, ...changes, id: "settings" });

  const categories = useMemo(
    () => [
      ...PRESET_CATEGORIES,
      ...(meta.customCategories || []).map((c) => ({ ...c, icon: "Tag", custom: true })),
    ],
    [meta.customCategories]
  );

  const gearByCat = useMemo(() => {
    const sorted = [...gear].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const known = new Set(categories.map((c) => c.key));
    return categories
      .map((cat) => ({
        ...cat,
        // 類別被刪掉的裝備歸到「其他」
        items: sorted.filter((g) => g.category === cat.key || (cat.key === "other" && !known.has(g.category))),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [gear, categories]);

  const sortedRecords = useMemo(
    () => [...records].filter((r) => Array.isArray(r.items)).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [records]
  );

  const catTotals = gearByCat.map((cat) => ({
    key: cat.key,
    label: cat.title,
    value: cat.items.reduce((sum, g) => sum + (checked[g.id] ? g.weight : 0), 0),
  }));
  const tempTotal = tempItems.reduce((sum, it) => sum + (it.checked ? it.weight : 0), 0);
  const grandTotal = Math.round((catTotals.reduce((s, c) => s + c.value, 0) + tempTotal) * 10) / 10;

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

  const handleSaveGear = (item) => {
    if (item.id) {
      store.put(user, "gear", item);
    } else {
      const created = { ...item, id: newId("g"), createdAt: Date.now() };
      store.put(user, "gear", created);
      setChecked((prev) => ({ ...prev, [created.id]: true }));
    }
    setEditor(null);
  };

  const handleDeleteGear = (item) => {
    if (!confirm(`確定要從裝備清單刪除「${item.name}」嗎？\n（已存的歷史紀錄不受影響）`)) return;
    store.remove(user, "gear", item.id);
    setChecked((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    setEditor(null);
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

  const handleLoadSample = () => {
    if (!confirm("要載入範例裝備清單嗎？載入後可以自由修改或刪除。")) return;
    const existing = new Set(gear.map((g) => g.id));
    const base = Date.now();
    store.putMany(
      user,
      "gear",
      SAMPLE_GEAR.filter((g) => !existing.has(g.id)).map((g, i) => ({ ...g, createdAt: base + i }))
    );
    setChecked((prev) => {
      const next = { ...prev, speedgoat7: true };
      SAMPLE_DEFAULT_ON.forEach((id) => (next[id] = true));
      return next;
    });
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
    const weight = parseFloat(newTempWeight);
    if (!name || isNaN(weight) || weight <= 0) return;
    setTempItems((prev) => [...prev, { id: newId("t"), name, weight: Math.round(weight * 10) / 10, checked: true }]);
    setNewTempName("");
    setNewTempWeight("");
  };

  // 目前勾選內容的完整快照（紀錄、圖片共用）
  const currentItems = () => [
    ...gearByCat.flatMap((cat) =>
      cat.items
        .filter((g) => checked[g.id])
        .map((g) => ({ id: g.id, cat: cat.title, name: g.name, note: g.note || "", weight: g.weight }))
    ),
    ...tempItems
      .filter((t) => t.checked)
      .map((t) => ({ id: t.id, cat: TEMP_CATEGORY_TITLE, name: t.name, note: "", weight: t.weight })),
  ];

  const handleExportImage = () => {
    const t = title.trim() || "登山裝備紀錄";
    exportImage({
      owner,
      title: t,
      date: formatDate(new Date().toISOString()),
      sections: itemsToSections(currentItems()),
      total: grandTotal,
    });
  };

  const handleSaveRecord = async () => {
    setSaving(true);
    try {
      await store.put(user, "records", {
        id: newId("rec"),
        title: title.trim() || "登山裝備紀錄",
        date: new Date().toISOString(),
        items: currentItems(),
        total: grandTotal,
      });
    } catch (e) {
      alert(`儲存失敗：${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleLoadRecord = (record) => {
    const gearIds = new Set(gear.map((g) => g.id));
    const inRecord = new Set(record.items.map((i) => i.id));
    setTitle(record.title);
    setChecked(Object.fromEntries(gear.map((g) => [g.id, inRecord.has(g.id)])));
    // 紀錄裡有、但目前清單已經沒有的裝備 → 放到臨時品項
    setTempItems(
      record.items
        .filter((i) => !gearIds.has(i.id))
        .map((i) => ({ id: i.id, name: i.note ? `${i.name} · ${i.note}` : i.name, weight: i.weight, checked: true }))
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleExportRecordImage = (record) =>
    exportImage({
      owner,
      title: record.title,
      date: formatDate(record.date),
      sections: itemsToSections(record.items),
      total: record.total,
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
      settings: { customCategories: meta.customCategories || [], targetG: meta.targetG || null },
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
      saveMeta({ customCategories: cats, targetG: data.settings.targetG || meta.targetG || null });
      alert("匯入完成！");
    } catch (err) {
      alert(`匯入失敗：${err.message}`);
    }
  };

  // ---------- 畫面 ----------
  const panelStyle = {
    background: palette.panel,
    borderRadius: 14,
    padding: 16,
    border: `1px solid ${palette.line}`,
  };
  const headingStyle = { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15 };
  const monoStyle = { fontFamily: "'JetBrains Mono', monospace" };

  return (
    <div
      className="page"
      style={{
        background: palette.bg,
        color: palette.text,
        fontFamily: "'Inter', 'PingFang TC', 'Microsoft JhengHei', 'Noto Sans TC', sans-serif",
        minHeight: "100vh",
        padding: "28px 16px",
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        button { font-family: inherit; }
        .item-row {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 10px; border-radius: 8px;
          border: 1px solid transparent;
          cursor: pointer; transition: background 0.15s, border-color 0.15s;
        }
        .item-row:hover { background: ${palette.panelAlt}; }
        .item-row.on { border-color: ${palette.line}; }
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
        .action-btn.primary { background: ${palette.amber}; border-color: ${palette.amber}; color: ${palette.bg}; }
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
          border: 1px solid ${palette.line}; border-radius: 10px;
          padding: 12px; background: ${palette.panelAlt};
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
        .layout-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
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
        .field-label { font-size: 12px; color: ${palette.textMuted}; margin: 14px 0 6px; display: block; }
      `}</style>

      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 6,
            }}
          >
            <div style={{ ...monoStyle, fontSize: 12, letterSpacing: "0.12em", color: palette.moss }}>
              {owner} · GEAR RECKONER
            </div>
            <SyncStatus user={user} online={online} onSignIn={handleSignIn} onSignOut={handleSignOut} />
          </div>
          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 30,
              fontWeight: 700,
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            登山裝備重量試算
          </h1>
          <p style={{ color: palette.textMuted, fontSize: 14, marginTop: 6, marginBottom: 16 }}>
            勾選這次要帶的裝備，即時算出總重。點 ✎ 可修改或刪除裝備。
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ flex: "1 1 260px", minWidth: 200 }}>
              <input
                className="title-input"
                placeholder="幫這次紀錄取個標題，例如：台北大縱走 Day1"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <button className="action-btn" onClick={handleExportImage}>
              <Download size={14} /> 匯出圖片
            </button>
            <button className="action-btn primary" onClick={handleSaveRecord} disabled={saving}>
              {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
              儲存這筆紀錄
            </button>
          </div>
        </div>

        <div className="layout-grid">
          {/* Left: checklist */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {!dataReady ? (
              <div style={{ ...panelStyle, display: "flex", alignItems: "center", gap: 8, color: palette.textMuted, fontSize: 13 }}>
                <Loader2 size={14} className="spin" /> 讀取裝備清單中…
              </div>
            ) : gear.length === 0 ? (
              <section style={{ ...panelStyle, textAlign: "center", padding: "32px 20px" }}>
                <Backpack size={32} color={palette.moss} />
                <div style={{ ...headingStyle, fontSize: 17, marginTop: 10 }}>裝備清單是空的</div>
                <p style={{ color: palette.textMuted, fontSize: 13, margin: "8px 0 18px", lineHeight: 1.6 }}>
                  先選大類別（鞋款、衣物、背包…），再填名稱、附註、重量。
                  <br />
                  也可以先載入範例清單，再改成自己的裝備。
                </p>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  <button className="action-btn primary" onClick={() => setEditor({ item: {} })}>
                    <Plus size={14} /> 新增第一件裝備
                  </button>
                  <button className="action-btn" onClick={handleLoadSample}>
                    <FolderOpen size={14} /> 載入範例清單
                  </button>
                </div>
              </section>
            ) : (
              <>
                <button
                  className="action-btn"
                  style={{ borderStyle: "dashed", padding: 12 }}
                  onClick={() => setEditor({ item: {} })}
                >
                  <Plus size={15} /> 新增裝備
                </button>

                {gearByCat.map((cat) => {
                  const Icon = ICONS[cat.icon] || Tag;
                  const subtotal = catTotals.find((c) => c.key === cat.key)?.value || 0;
                  return (
                    <section key={cat.key} style={panelStyle}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Icon size={16} color={palette.moss} />
                          <span style={headingStyle}>{cat.title}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ ...monoStyle, fontSize: 13, color: palette.textMuted }}>
                            {formatWeight(subtotal)}
                          </span>
                          <button
                            className="icon-btn"
                            title={`在「${cat.title}」新增裝備`}
                            onClick={() => setEditor({ item: { category: cat.key } })}
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {cat.items.map((it) => (
                          <div
                            key={it.id}
                            className={`item-row ${checked[it.id] ? "on" : ""}`}
                            onClick={() => toggle(it.id)}
                          >
                            <CheckBox on={checked[it.id]} />
                            <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 500 }}>
                              {it.name}
                              {it.note && <span style={{ color: palette.textFaint }}> · {it.note}</span>}
                            </div>
                            <div
                              style={{
                                ...monoStyle,
                                fontSize: 13.5,
                                fontWeight: 600,
                                minWidth: 56,
                                textAlign: "right",
                                color: checked[it.id] ? palette.text : palette.textFaint,
                              }}
                            >
                              {formatWeight(it.weight)}
                            </div>
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
                      </div>
                    </section>
                  );
                })}
              </>
            )}

            {/* 臨時品項 */}
            <section style={panelStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Plus size={16} color={palette.moss} />
                  <span style={headingStyle}>{TEMP_CATEGORY_TITLE}</span>
                  <span style={{ fontSize: 11.5, color: palette.textFaint }}>（借用、只帶這次、不想加進清單的）</span>
                </div>
                {tempItems.length > 0 && (
                  <span style={{ ...monoStyle, fontSize: 13, color: palette.textMuted }}>{formatWeight(tempTotal)}</span>
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
                    <div
                      style={{
                        ...monoStyle,
                        fontSize: 13.5,
                        fontWeight: 600,
                        minWidth: 56,
                        textAlign: "right",
                        color: it.checked ? palette.text : palette.textFaint,
                      }}
                    >
                      {formatWeight(it.weight)}
                    </div>
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
                  placeholder="品項名稱，例如：租借頭盔"
                  value={newTempName}
                  onChange={(e) => setNewTempName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTempItem()}
                />
                <input
                  className="mini-input"
                  style={{ flex: "1 1 80px" }}
                  placeholder="重量 (g)"
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

            {/* 歷史紀錄 */}
            <section style={panelStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <History size={16} color={palette.moss} />
                <span style={headingStyle}>歷史裝備紀錄</span>
              </div>

              {!dataReady ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: palette.textMuted, fontSize: 13 }}>
                  <Loader2 size={14} className="spin" /> 讀取紀錄中…
                </div>
              ) : sortedRecords.length === 0 ? (
                <div style={{ color: palette.textFaint, fontSize: 13 }}>
                  還沒有任何儲存紀錄，填好標題後按「儲存這筆紀錄」就會出現在這裡。
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sortedRecords.map((r) => (
                    <div key={r.id} className="record-card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</div>
                          <div style={{ fontSize: 11.5, color: palette.textFaint, marginTop: 2 }}>
                            {formatDate(r.date)} · {r.items.length} 件
                          </div>
                        </div>
                        <div style={{ ...monoStyle, fontSize: 15, fontWeight: 700, color: palette.amber, whiteSpace: "nowrap" }}>
                          {(r.total / 1000).toFixed(2)} kg
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
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
                  ))}
                </div>
              )}
            </section>

            {/* 資料備份 */}
            <section style={panelStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <ShieldCheck size={16} color={palette.moss} />
                <span style={headingStyle}>資料備份</span>
              </div>
              <p style={{ fontSize: 12.5, color: palette.textMuted, margin: "0 0 12px", lineHeight: 1.6 }}>
                把裝備清單和所有紀錄存成一個備份檔，放在電腦、雲端硬碟或 LINE Keep。萬一資料出問題，用「匯入備份」就能救回來。
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
          <div style={{ position: "sticky", top: 20, alignSelf: "start" }}>
            <div style={{ ...panelStyle, padding: 20 }}>
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
                {grandTotal.toLocaleString()} g
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
                      <stop offset="0%" stopColor={palette.amber} />
                      <stop offset="100%" stopColor={palette.moss} />
                    </linearGradient>
                    <clipPath id="mountainClip">
                      <path d="M10 160 L60 70 L85 100 L120 40 L150 90 L190 160 Z" />
                    </clipPath>
                  </defs>
                  {[40, 75, 110, 145].map((y, i) => (
                    <line key={i} x1="8" y1={y} x2="192" y2={y} stroke={palette.line} strokeWidth="1" strokeDasharray="2 4" />
                  ))}
                  <path
                    d="M10 160 L60 70 L85 100 L120 40 L150 90 L190 160 Z"
                    fill="none"
                    stroke={palette.textFaint}
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
                  <line x1="10" y1="160" x2="190" y2="160" stroke={palette.textFaint} strokeWidth="1.5" />
                  <line
                    x1="6"
                    y1={160 - (targetPercent / 100) * 130}
                    x2="194"
                    y2={160 - (targetPercent / 100) * 130}
                    stroke={palette.warn}
                    strokeWidth="1.5"
                    strokeDasharray="5 3"
                  />
                  <text
                    x="196"
                    y={160 - (targetPercent / 100) * 130 + 4}
                    fontSize="9"
                    fill={palette.warn}
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

              {/* breakdown bars */}
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                {[...catTotals, { key: "temp", label: TEMP_CATEGORY_TITLE, value: tempTotal }]
                  .filter((row) => row.value > 0)
                  .map((row) => (
                    <div key={row.key}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 11.5,
                          color: palette.textMuted,
                          marginBottom: 3,
                        }}
                      >
                        <span>{row.label}</span>
                        <span style={monoStyle}>{formatWeight(row.value)}</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: palette.panelAlt, overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${grandTotal > 0 ? (row.value / grandTotal) * 100 : 0}%`,
                            background: palette.moss,
                            borderRadius: 3,
                          }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>

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
                儲存的紀錄會保留當下完整的品名與重量，之後修改或刪除清單裡的裝備，不會影響舊紀錄。
                {user
                  ? "裝備清單和紀錄存在你的 Google 帳號雲端空間，手機和電腦登入同一帳號即自動同步，僅你可見。"
                  : "目前資料只存在這台裝置，登入後會自動搬上雲端。"}
              </span>
            </div>
          </div>
        </div>

        <div style={{ ...monoStyle, textAlign: "center", fontSize: 11, color: palette.textFaint, marginTop: 28 }}>
          Gear Reckoner v{APP_VERSION}
        </div>
      </div>

      {/* 手機版：底部固定顯示總重 */}
      <div className="mobile-total-bar">
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
        {dataReady && (
          <button
            className="action-btn primary"
            style={{ marginLeft: "auto", padding: "7px 12px" }}
            onClick={() => setEditor({ item: {} })}
          >
            <Plus size={14} /> 裝備
          </button>
        )}
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
    </div>
  );
}

function CheckBox({ on }) {
  return (
    <div className={`checkbox ${on ? "on" : ""}`}>
      {on && (
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M1 5L4 8L9 2" stroke={palette.bg} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// 新增 / 修改裝備的面板（像記帳 App：先選類別，再填名稱、附註、重量）
// ------------------------------------------------------------
function GearEditor({ item, categories, onSave, onDelete, onAddCategory, onDeleteCategory, onClose }) {
  const isNew = !item.id;
  const [category, setCategory] = useState(item.category || "");
  const [name, setName] = useState(item.name || "");
  const [note, setNote] = useState(item.note || "");
  const [weight, setWeight] = useState(item.weight != null ? String(item.weight) : "");
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const selectedCat = categories.find((c) => c.key === category);

  const submit = () => {
    const w = parseFloat(weight);
    if (!category) return setError("請先選一個類別");
    if (!name.trim()) return setError("請填裝備名稱");
    if (isNaN(w) || w <= 0) return setError("請填大於 0 的重量（公克）");
    onSave({ ...item, category, name: name.trim(), note: note.trim(), weight: Math.round(w * 10) / 10 });
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

        <span className="field-label">大類別</span>
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

        <label className="field-label">重量（公克 g）</label>
        <input
          className="title-input"
          type="number"
          inputMode="decimal"
          min="0"
          placeholder="例如：269"
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
// 右上角的同步狀態：本機模式 / 登入按鈕 / 已同步
// ------------------------------------------------------------
function SyncStatus({ user, online, onSignIn, onSignOut }) {
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
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ ...chip, color: online ? palette.moss : palette.amber }} title={user.email}>
        {online ? <Cloud size={13} /> : <CloudOff size={13} />}
        {online ? "已同步" : "離線中・連線後自動同步"}
      </div>
      <button className="action-btn" style={{ padding: "5px 8px", fontSize: 12 }} onClick={onSignOut} title={`登出 ${user.email}`}>
        <LogOut size={13} />
      </button>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<GearReckoner />);

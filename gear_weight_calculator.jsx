import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Shirt,
  Footprints,
  Backpack,
  Glasses,
  Info,
  Plus,
  Trash2,
  Save,
  Download,
  Loader2,
  History,
  FolderOpen,
} from "lucide-react";

// ============================================================
// 裝備資料表 —— 之後有新品項/新重量，直接在這裡增修即可
// weight 單位：公克 (g)
// estimated: true 表示官網無精確數據，屬於估算值
// ============================================================
const LAYER_ITEMS = [
  { id: "storm-cruiser", name: "Montbell Storm Cruiser 硬殼外套", color: "黃", weight: 269, estimated: false, defaultOn: true },
  { id: "mt500", name: "迪卡農 MT500 美麗諾長袖", color: "橘", weight: 216, estimated: false, defaultOn: true },
  { id: "wind-parka", name: "Montbell U.L. Stretch Wind Parka", color: "橘", weight: 117, estimated: false, defaultOn: true },
  { id: "down-parka", name: "Montbell Superior Down Parka 800FP", color: "—", weight: 249, estimated: false, defaultOn: false, owned: false },
  { id: "cove-beach-pant", name: "Columbia Cove Beach Pant 登山褲", color: "橘黑", weight: 305, estimated: false, defaultOn: true },
  { id: "decathlon-shorts", name: "迪卡農登山短褲", color: "深灰", weight: 300, estimated: false, defaultOn: false },
];

const FOOTWEAR_ITEMS = [
  { id: "speedgoat7", name: "Hoka Speedgoat 7", color: "黑白", weight: 548, estimated: false, note: "雙腳合計・輕量跑鞋" },
  { id: "olympus6", name: "Altra Olympus 6 Hike Low GTX", color: "黑", weight: 816, estimated: false, note: "雙腳合計・防水登山鞋" },
];

const PACK_ITEMS = [
  { id: "hmg-southwest40", name: "Hyperlite Mountain Gear Southwest 40L 背包", color: "白", weight: 841, estimated: false, defaultOn: true, note: "M 尺寸官方規格" },
  { id: "adv-vest", name: "Salomon ADV Cross/Skin 15 攻頂包", color: "白", weight: 320, estimated: true, defaultOn: false },
  { id: "mt900-poles", name: "迪卡農 MT900 摺疊登山杖", color: "—", weight: 550, estimated: false, defaultOn: true, note: "單支 275g × 2" },
  { id: "hydrapak", name: "Hydrapak Contour 2L 水袋", color: "—", weight: 142, estimated: false, defaultOn: true, note: "空重" },
  { id: "naturehike-mat", name: "Naturehike 羽骨R3.6超輕自動充氣睡墊", color: "黃", weight: 610, estimated: false, defaultOn: true },
];

const ACCESSORY_ITEMS = [
  { id: "trail-hat", name: "Hoka Trail Run Hat", color: "黑", weight: 42, estimated: true, defaultOn: true },
  { id: "urban3", name: "VIGHT Urban 3 太陽眼鏡", color: "冰石藍", weight: 32, estimated: false, defaultOn: true },
  { id: "headlamp", name: "Nitecore NU25 MCT UL 頭燈", color: "—", weight: 47, estimated: false, defaultOn: true, owned: true },
  { id: "smartwool-socks", name: "Smartwool羊毛襪", color: "灰色 香菇/魚/斧頭", weight: 66.5, estimated: false, defaultOn: true },
  { id: "darn-tough-socks", name: "Darn Tough 羊毛襪", color: "外星人", weight: 77, estimated: false, defaultOn: true, owned: true },
  { id: "naturehike-pillow", name: "Naturehike 充氣枕頭", color: "—", weight: 110, estimated: false, defaultOn: true },
  { id: "sts-aeros-pillow", name: "Sea to Summit Aeros Pillow Premium", color: "深藍", weight: 150, estimated: false, defaultOn: false, note: "L 尺寸・包裝標示" },
  { id: "beams-neckwarmer", name: "Beams 圍脖", color: "—", weight: 47, estimated: false, defaultOn: true },
];

const CATEGORIES = [
  { key: "layer", title: "衣物層", icon: Shirt, items: LAYER_ITEMS },
  { key: "pack", title: "背包與補給", icon: Backpack, items: PACK_ITEMS },
  { key: "accessory", title: "隨身配件", icon: Glasses, items: ACCESSORY_ITEMS },
];

const MAX_SCALE_G = 9000; // 山岳量規的滿刻度（供視覺化用）
const COMFORT_TARGET_G = 7000; // 葉董設定的舒適重量目標
const RECORDS_KEY = "gear-weight-records";

function formatWeight(g) {
  return g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${g} g`;
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

// ------------------------------------------------------------
// 匯出成 PNG 圖片：純 Canvas 繪製，不依賴外部套件
// ------------------------------------------------------------
function drawSnapshotToPng({ title, date, sections, total, footwearLine }) {
  const width = 760;
  const rowH = 30;
  const lineCount = sections.reduce((n, s) => n + 1 + s.lines.length, 0) + 1; // +1 for footwear line group
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

  const fontStack =
    '"PingFang TC", "Microsoft JhengHei", "Noto Sans TC", "Helvetica Neue", Arial, sans-serif';

  // 背景
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);

  // 頂部標籤
  ctx.fillStyle = palette.moss;
  ctx.font = `600 12px ${fontStack}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("葉董裝備清單 · GEAR RECKONER", 32, 40);

  // 標題
  ctx.fillStyle = palette.text;
  ctx.font = `700 28px ${fontStack}`;
  ctx.fillText(title || "登山裝備紀錄", 32, 78);

  // 日期
  ctx.fillStyle = palette.textMuted;
  ctx.font = `400 13px ${fontStack}`;
  ctx.fillText(date, 32, 102);

  // 分隔線
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(32, 122);
  ctx.lineTo(width - 32, 122);
  ctx.stroke();

  let y = headerH;

  // 鞋款
  ctx.fillStyle = palette.moss;
  ctx.font = `600 13px ${fontStack}`;
  ctx.fillText("鞋款", 32, y);
  ctx.fillStyle = palette.text;
  ctx.font = `500 14px ${fontStack}`;
  ctx.fillText(footwearLine.name, 100, y);
  ctx.textAlign = "right";
  ctx.fillStyle = palette.textMuted;
  ctx.font = `600 14px ${fontStack}`;
  ctx.fillText(formatWeight(footwearLine.weight), width - 32, y);
  ctx.textAlign = "left";
  y += rowH + 6;

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

  // 分隔線
  ctx.strokeStyle = palette.line;
  ctx.beginPath();
  ctx.moveTo(32, y);
  ctx.lineTo(width - 32, y);
  ctx.stroke();
  y += 44;

  // 總重
  ctx.fillStyle = palette.textMuted;
  ctx.font = `500 13px ${fontStack}`;
  ctx.fillText("總重量", 32, y);
  y += 40;
  ctx.fillStyle = palette.amber;
  ctx.font = `700 40px ${fontStack}`;
  ctx.fillText(`${(total / 1000).toFixed(2)} kg`, 32, y);
  ctx.font = `500 15px ${fontStack}`;
  ctx.fillStyle = palette.textMuted;
  const kgWidth = ctx.measureText(`${(total / 1000).toFixed(2)} kg`).width;
  ctx.font = `700 40px ${fontStack}`;
  const bigWidth = ctx.measureText(`${(total / 1000).toFixed(2)} kg`).width;
  ctx.font = `500 14px ${fontStack}`;
  ctx.fillText(`${total.toLocaleString()} g`, 32, y + 22);

  // 頁尾
  ctx.fillStyle = palette.textFaint;
  ctx.font = `400 11px ${fontStack}`;
  ctx.fillText("小可 · Gear Reckoner 產出", 32, height - 22);

  return canvas;
}

function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, "image/png");
}

export default function GearWeightCalculator() {
  const initialChecked = {};
  [...LAYER_ITEMS, ...PACK_ITEMS, ...ACCESSORY_ITEMS].forEach((it) => {
    initialChecked[it.id] = it.defaultOn;
  });

  const [checked, setChecked] = useState(initialChecked);
  const [footwear, setFootwear] = useState(FOOTWEAR_ITEMS[0].id);
  const [title, setTitle] = useState("");

  // 自訂欄位（每次可能不同、或是租借品項）
  const [customItems, setCustomItems] = useState([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemWeight, setNewItemWeight] = useState("");

  // 儲存的裝備紀錄（跨裝置保存在使用者個人儲存空間）
  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadRecords() {
      try {
        const result = await window.storage.get(RECORDS_KEY, false);
        if (!cancelled && result && result.value) {
          setRecords(JSON.parse(result.value));
        }
      } catch (e) {
        // key 不存在時屬正常情況（尚無任何紀錄）
        if (!cancelled) setRecordsError(false);
      } finally {
        if (!cancelled) setRecordsLoading(false);
      }
    }
    loadRecords();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (id) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleCustom = (id) =>
    setCustomItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, checked: !it.checked } : it))
    );

  const removeCustom = (id) =>
    setCustomItems((prev) => prev.filter((it) => it.id !== id));

  const addCustomItem = () => {
    const name = newItemName.trim();
    const weight = parseFloat(newItemWeight);
    if (!name || isNaN(weight) || weight <= 0) return;
    setCustomItems((prev) => [
      ...prev,
      { id: `custom-${Date.now()}`, name, weight: Math.round(weight), checked: true },
    ]);
    setNewItemName("");
    setNewItemWeight("");
  };

  const selectedFootwear = FOOTWEAR_ITEMS.find((f) => f.id === footwear);

  const categoryTotals = useMemo(() => {
    const totals = {};
    CATEGORIES.forEach((cat) => {
      totals[cat.key] = cat.items.reduce(
        (sum, it) => sum + (checked[it.id] ? it.weight : 0),
        0
      );
    });
    totals.footwear = selectedFootwear.weight;
    totals.custom = customItems.reduce(
      (sum, it) => sum + (it.checked ? it.weight : 0),
      0
    );
    return totals;
  }, [checked, selectedFootwear, customItems]);

  const grandTotal =
    categoryTotals.layer +
    categoryTotals.pack +
    categoryTotals.accessory +
    categoryTotals.custom +
    categoryTotals.footwear;

  const fillPercent = Math.min(100, (grandTotal / MAX_SCALE_G) * 100);
  const targetPercent = Math.min(100, (COMFORT_TARGET_G / MAX_SCALE_G) * 100);
  const overTarget = grandTotal > COMFORT_TARGET_G;
  const deltaFromTarget = Math.abs(grandTotal - COMFORT_TARGET_G);

  // 組出目前畫面的「快照」資料，供匯出圖片/儲存紀錄共用
  const buildSnapshot = () => {
    const sections = CATEGORIES.map((cat) => ({
      title: cat.title,
      lines: cat.items.filter((it) => checked[it.id]).map((it) => ({ name: it.name, weight: it.weight })),
    }));
    const activeCustom = customItems.filter((it) => it.checked);
    if (activeCustom.length > 0) {
      sections.push({
        title: "自訂欄位",
        lines: activeCustom.map((it) => ({ name: it.name, weight: it.weight })),
      });
    }
    return {
      title: title.trim() || "登山裝備紀錄",
      date: formatDate(new Date().toISOString()),
      footwearLine: { name: selectedFootwear.name, weight: selectedFootwear.weight },
      sections: sections.filter((s) => s.lines.length > 0),
      total: grandTotal,
    };
  };

  const handleExportImage = () => {
    const snap = buildSnapshot();
    const canvas = drawSnapshotToPng(snap);
    downloadCanvas(canvas, `${snap.title}.png`);
  };

  const handleSaveRecord = async () => {
    setSaving(true);
    const record = {
      id: `rec-${Date.now()}`,
      title: title.trim() || "登山裝備紀錄",
      date: new Date().toISOString(),
      checked,
      footwear,
      customItems,
      total: grandTotal,
    };
    const nextRecords = [record, ...records];
    try {
      const result = await window.storage.set(RECORDS_KEY, JSON.stringify(nextRecords), false);
      if (result) {
        setRecords(nextRecords);
      }
    } catch (e) {
      // 儲存失敗，維持原本狀態，不更新畫面
    } finally {
      setSaving(false);
    }
  };

  const handleLoadRecord = (record) => {
    setTitle(record.title);
    setChecked(record.checked);
    setFootwear(record.footwear);
    setCustomItems(record.customItems || []);
  };

  const handleExportRecordImage = (record) => {
    const sections = CATEGORIES.map((cat) => ({
      title: cat.title,
      lines: cat.items
        .filter((it) => record.checked[it.id])
        .map((it) => ({ name: it.name, weight: it.weight })),
    }));
    const activeCustom = (record.customItems || []).filter((it) => it.checked);
    if (activeCustom.length > 0) {
      sections.push({
        title: "自訂欄位",
        lines: activeCustom.map((it) => ({ name: it.name, weight: it.weight })),
      });
    }
    const shoe = FOOTWEAR_ITEMS.find((f) => f.id === record.footwear) || FOOTWEAR_ITEMS[0];
    const canvas = drawSnapshotToPng({
      title: record.title,
      date: formatDate(record.date),
      footwearLine: { name: shoe.name, weight: shoe.weight },
      sections: sections.filter((s) => s.lines.length > 0),
      total: record.total,
    });
    downloadCanvas(canvas, `${record.title}.png`);
  };

  const handleDeleteRecord = async (id) => {
    const nextRecords = records.filter((r) => r.id !== id);
    try {
      const result = await window.storage.set(RECORDS_KEY, JSON.stringify(nextRecords), false);
      if (result) setRecords(nextRecords);
    } catch (e) {
      // 刪除失敗則不變更畫面
    }
  };

  return (
    <div
      style={{
        background: palette.bg,
        color: palette.text,
        fontFamily: "'Inter', sans-serif",
        minHeight: "100%",
        padding: "28px 20px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap');
        * { box-sizing: border-box; }
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
        .footwear-card {
          border: 1.5px solid ${palette.line}; border-radius: 10px;
          padding: 12px 14px; cursor: pointer; transition: all 0.15s;
          background: ${palette.panelAlt};
        }
        .footwear-card.selected {
          border-color: ${palette.amber};
          box-shadow: 0 0 0 1px ${palette.amber} inset;
        }
        .dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
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
          display: flex; align-items: center; gap: 6px;
          border-radius: 8px; padding: 9px 14px;
          font-size: 13px; font-weight: 600; cursor: pointer;
          border: 1.5px solid ${palette.line};
          background: ${palette.panelAlt}; color: ${palette.text};
          transition: all 0.15s; white-space: nowrap;
        }
        .action-btn:hover { border-color: ${palette.amber}; }
        .action-btn.primary { background: ${palette.amber}; border-color: ${palette.amber}; color: ${palette.bg}; }
        .action-btn:disabled { opacity: 0.5; cursor: default; }
        .mini-input {
          background: ${palette.bg};
          border: 1.5px solid ${palette.line};
          border-radius: 6px;
          padding: 7px 9px;
          color: ${palette.text};
          font-size: 13px;
          outline: none;
        }
        .mini-input:focus { border-color: ${palette.amber}; }
        .record-card {
          border: 1px solid ${palette.line}; border-radius: 10px;
          padding: 12px; background: ${palette.panelAlt};
        }
        input[type="number"] { -moz-appearance: textfield; }
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none; margin: 0;
        }
      `}</style>

      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              letterSpacing: "0.12em",
              color: palette.moss,
              marginBottom: 6,
            }}
          >
            葉董裝備清單 · GEAR RECKONER
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
            勾選這次要帶的裝備，右側即時算出總重。鞋款請擇一穿著的款式。
          </p>

          {/* 標題輸入 + 動作按鈕 */}
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 20,
          }}
          className="layout-grid"
        >
          <style>{`
            @media (min-width: 900px) {
              .layout-grid { grid-template-columns: 1fr 320px !important; }
            }
            @keyframes spin { to { transform: rotate(360deg); } }
            .spin { animation: spin 1s linear infinite; }
          `}</style>

          {/* Left: checklist */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Footwear */}
            <section
              style={{
                background: palette.panel,
                borderRadius: 14,
                padding: 16,
                border: `1px solid ${palette.line}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <Footprints size={16} color={palette.moss} />
                <span
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: 15,
                  }}
                >
                  鞋款（擇一）
                </span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                {FOOTWEAR_ITEMS.map((shoe) => (
                  <div
                    key={shoe.id}
                    className={`footwear-card ${footwear === shoe.id ? "selected" : ""}`}
                    onClick={() => setFootwear(shoe.id)}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{shoe.name}</div>
                    <div style={{ fontSize: 11, color: palette.textMuted, marginTop: 3 }}>
                      {shoe.color} · {shoe.note}
                    </div>
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 16,
                        fontWeight: 600,
                        marginTop: 8,
                        color: footwear === shoe.id ? palette.amber : palette.text,
                      }}
                    >
                      {formatWeight(shoe.weight)}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Categories */}
            {CATEGORIES.map((cat) => (
              <section
                key={cat.key}
                style={{
                  background: palette.panel,
                  borderRadius: 14,
                  padding: 16,
                  border: `1px solid ${palette.line}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <cat.icon size={16} color={palette.moss} />
                    <span
                      style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontWeight: 700,
                        fontSize: 15,
                      }}
                    >
                      {cat.title}
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 13,
                      color: palette.textMuted,
                    }}
                  >
                    {formatWeight(categoryTotals[cat.key])}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {cat.items.map((it) => (
                    <div
                      key={it.id}
                      className={`item-row ${checked[it.id] ? "on" : ""}`}
                      onClick={() => toggle(it.id)}
                    >
                      <div className={`checkbox ${checked[it.id] ? "on" : ""}`}>
                        {checked[it.id] && (
                          <svg width="10" height="10" viewBox="0 0 10 10">
                            <path
                              d="M1 5L4 8L9 2"
                              stroke={palette.bg}
                              strokeWidth="1.8"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 500, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span>
                            {it.name}
                            {it.color !== "—" && (
                              <span style={{ color: palette.textFaint }}> · {it.color}</span>
                            )}
                            {it.note && (
                              <span style={{ color: palette.textFaint }}> · {it.note}</span>
                            )}
                          </span>
                          {it.owned === false && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: "1px 6px",
                                borderRadius: 20,
                                border: `1px solid ${palette.amber}`,
                                color: palette.amber,
                                lineHeight: 1.6,
                              }}
                            >
                              未入手
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        className="dot"
                        style={{
                          background: it.estimated ? palette.amber : palette.moss,
                        }}
                        title={it.estimated ? "估算值" : "官方/實測值"}
                      />
                      <div
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 13.5,
                          fontWeight: 600,
                          minWidth: 60,
                          textAlign: "right",
                          color: checked[it.id] ? palette.text : palette.textFaint,
                        }}
                      >
                        {formatWeight(it.weight)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {/* 自訂欄位 */}
            <section
              style={{
                background: palette.panel,
                borderRadius: 14,
                padding: 16,
                border: `1px solid ${palette.line}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Plus size={16} color={palette.moss} />
                  <span
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    自訂欄位
                  </span>
                  <span style={{ fontSize: 11.5, color: palette.textFaint }}>
                    （借用品項、每次不同的裝備）
                  </span>
                </div>
                {customItems.length > 0 && (
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 13,
                      color: palette.textMuted,
                    }}
                  >
                    {formatWeight(categoryTotals.custom)}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: customItems.length > 0 ? 12 : 0 }}>
                {customItems.map((it) => (
                  <div key={it.id} className={`item-row on`} style={{ cursor: "default" }}>
                    <div
                      className={`checkbox ${it.checked ? "on" : ""}`}
                      onClick={() => toggleCustom(it.id)}
                      style={{ cursor: "pointer" }}
                    >
                      {it.checked && (
                        <svg width="10" height="10" viewBox="0 0 10 10">
                          <path
                            d="M1 5L4 8L9 2"
                            stroke={palette.bg}
                            strokeWidth="1.8"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 500 }}>
                      {it.name}
                    </div>
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 13.5,
                        fontWeight: 600,
                        minWidth: 60,
                        textAlign: "right",
                        color: it.checked ? palette.text : palette.textFaint,
                      }}
                    >
                      {formatWeight(it.weight)}
                    </div>
                    <button
                      onClick={() => removeCustom(it.id)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 4,
                        display: "flex",
                        color: palette.textFaint,
                      }}
                      title="刪除此欄位"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  className="mini-input"
                  style={{ flex: "2 1 180px" }}
                  placeholder="品項名稱，例如：租借頭盔"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomItem()}
                />
                <input
                  className="mini-input"
                  style={{ flex: "1 1 90px" }}
                  placeholder="重量 (g)"
                  type="number"
                  min="0"
                  value={newItemWeight}
                  onChange={(e) => setNewItemWeight(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomItem()}
                />
                <button className="action-btn" onClick={addCustomItem}>
                  <Plus size={14} /> 新增
                </button>
              </div>
            </section>

            {/* Legend */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                fontSize: 12,
                color: palette.textMuted,
                padding: "0 4px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="dot" style={{ background: palette.moss }} />
                官方規格 / 實測值
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="dot" style={{ background: palette.amber }} />
                估算值（建議自行秤重校正）
              </div>
            </div>

            {/* 歷史紀錄 */}
            <section
              style={{
                background: palette.panel,
                borderRadius: 14,
                padding: 16,
                border: `1px solid ${palette.line}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <History size={16} color={palette.moss} />
                <span
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: 15,
                  }}
                >
                  歷史裝備紀錄
                </span>
              </div>

              {recordsLoading ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: palette.textMuted, fontSize: 13 }}>
                  <Loader2 size={14} className="spin" /> 讀取紀錄中…
                </div>
              ) : records.length === 0 ? (
                <div style={{ color: palette.textFaint, fontSize: 13 }}>
                  還沒有任何儲存紀錄，填好標題後按「儲存這筆紀錄」就會出現在這裡。
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {records.map((r) => (
                    <div key={r.id} className="record-card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</div>
                          <div style={{ fontSize: 11.5, color: palette.textFaint, marginTop: 2 }}>
                            {formatDate(r.date)}
                          </div>
                        </div>
                        <div
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 15,
                            fontWeight: 700,
                            color: palette.amber,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {(r.total / 1000).toFixed(2)} kg
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                        <button
                          className="action-btn"
                          style={{ padding: "6px 10px", fontSize: 12 }}
                          onClick={() => handleLoadRecord(r)}
                        >
                          <FolderOpen size={12} /> 載入
                        </button>
                        <button
                          className="action-btn"
                          style={{ padding: "6px 10px", fontSize: 12 }}
                          onClick={() => handleExportRecordImage(r)}
                        >
                          <Download size={12} /> 圖片
                        </button>
                        <button
                          className="action-btn"
                          style={{ padding: "6px 10px", fontSize: 12, marginLeft: "auto" }}
                          onClick={() => handleDeleteRecord(r.id)}
                        >
                          <Trash2 size={12} /> 刪除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right: summary */}
          <div style={{ position: "sticky", top: 20, alignSelf: "start" }}>
            <div
              style={{
                background: palette.panel,
                borderRadius: 14,
                border: `1px solid ${palette.line}`,
                padding: 20,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  letterSpacing: "0.08em",
                  color: palette.textMuted,
                  marginBottom: 6,
                }}
              >
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
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 13,
                  color: palette.textMuted,
                  marginTop: 2,
                }}
              >
                {grandTotal.toLocaleString()} g
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: overTarget ? palette.warn : palette.moss,
                  marginTop: 6,
                  fontWeight: 600,
                }}
              >
                {overTarget
                  ? `超出舒適重量 7kg 目標 ${formatWeight(deltaFromTarget)}`
                  : `距離舒適重量 7kg 目標還有 ${formatWeight(deltaFromTarget)}`}
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

                  {/* contour lines */}
                  {[40, 75, 110, 145].map((y, i) => (
                    <line
                      key={i}
                      x1="8"
                      y1={y}
                      x2="192"
                      y2={y}
                      stroke={palette.line}
                      strokeWidth="1"
                      strokeDasharray="2 4"
                    />
                  ))}

                  {/* mountain outline */}
                  <path
                    d="M10 160 L60 70 L85 100 L120 40 L150 90 L190 160 Z"
                    fill="none"
                    stroke={palette.textFaint}
                    strokeWidth="1.5"
                  />

                  {/* fill by weight, clipped to mountain shape */}
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

                  {/* baseline */}
                  <line x1="10" y1="160" x2="190" y2="160" stroke={palette.textFaint} strokeWidth="1.5" />

                  {/* 舒適重量目標線 */}
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
                    7kg 目標
                  </text>
                </svg>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 10,
                    color: palette.textFaint,
                    fontFamily: "'JetBrains Mono', monospace",
                    marginTop: -6,
                  }}
                >
                  <span>0 kg</span>
                  <span>量規滿刻度 {MAX_SCALE_G / 1000} kg</span>
                </div>
              </div>

              {/* breakdown bars */}
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "鞋款", value: categoryTotals.footwear },
                  { label: "衣物層", value: categoryTotals.layer },
                  { label: "背包與補給", value: categoryTotals.pack },
                  { label: "隨身配件", value: categoryTotals.accessory },
                  { label: "自訂欄位", value: categoryTotals.custom },
                ]
                  .filter((row) => row.value > 0 || row.label !== "自訂欄位")
                  .map((row) => (
                    <div key={row.label}>
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
                        <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          {formatWeight(row.value)}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 5,
                          borderRadius: 3,
                          background: palette.panelAlt,
                          overflow: "hidden",
                        }}
                      >
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
              }}
            >
              <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                部分品項（羊毛長袖、帽子、攻頂包）為估算值，正式出發前建議用秤實測校正。長短褲、雨褲、行動糧等品項待補充後可再更新此表。紀錄會保存在你的個人儲存空間中，僅你可見。
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

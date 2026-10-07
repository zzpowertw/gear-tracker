// ============================================================
// 活動、預設類別與範例裝備
// 每個人的裝備庫存在自己的帳號裡（App 內新增/修改/刪除）
// 這裡只放：①活動 ②預設大類別 ③「載入範例清單」用的範例 ④舊版資料的轉換
// weight 單位：公克 (g)
// ⚠ 範例裝備的 id 不可改名：v1.x 的舊紀錄靠這些 id 轉換
// ============================================================

// 活動：mode = "weight"（重量模式：算總重、有目標重量）或 "list"（清單模式：重點是有沒有帶）
// ⚠ key 不可改名：裝備的 activities、紀錄的 activity 都存這個 key
export const ACTIVITIES = [
  { key: "hiking", title: "登山", icon: "Mountain", mode: "weight" },
  { key: "diving", title: "潛水", icon: "Waves", mode: "list" },
  { key: "skiing", title: "滑雪", icon: "Snowflake", mode: "list" },
  { key: "camping", title: "露營", icon: "Tent", mode: "list" },
];
// v2.x 以前的裝備和紀錄都屬於登山
export const DEFAULT_ACTIVITY = "hiking";

// icon 對應 app.jsx 裡的 ICONS
// activities：新增裝備時，選了這些活動才會出現這個類別；不寫 = 每個活動都適用
export const PRESET_CATEGORIES = [
  { key: "shoes", title: "鞋款", icon: "Footprints" },
  { key: "clothing", title: "衣物", icon: "Shirt" },
  { key: "pack", title: "背包", icon: "Backpack" },
  { key: "sleep", title: "睡眠", icon: "BedDouble", activities: ["hiking", "camping"] },
  { key: "kitchen", title: "炊煮飲食", icon: "CookingPot", activities: ["hiking", "camping"] },
  { key: "water", title: "水具", icon: "Droplet", activities: ["hiking", "camping"] },
  // 潛水
  { key: "dive-bcd", title: "BCD 浮力背心", icon: "LifeBuoy", activities: ["diving"] },
  { key: "dive-reg", title: "調節器", icon: "Wind", activities: ["diving"] },
  { key: "dive-suit", title: "防寒衣", icon: "Layers", activities: ["diving"] },
  { key: "dive-computer", title: "潛水電腦錶", icon: "Watch", activities: ["diving"] },
  { key: "dive-mask", title: "面鏡・蛙鞋", icon: "Glasses", activities: ["diving"] },
  { key: "dive-weight", title: "配重", icon: "Weight", activities: ["diving"] },
  // 滑雪
  { key: "ski-board", title: "雪板・固定器", icon: "MountainSnow", activities: ["skiing"] },
  { key: "ski-boots", title: "雪鞋", icon: "Footprints", activities: ["skiing"] },
  { key: "ski-protect", title: "安全帽・雪鏡・護具", icon: "HardHat", activities: ["skiing"] },
  { key: "ski-wear", title: "雪衣・雪褲", icon: "Shirt", activities: ["skiing"] },
  // 露營
  { key: "camp-shelter", title: "帳篷・天幕", icon: "Tent", activities: ["camping"] },
  { key: "camp-furniture", title: "桌椅家具", icon: "Armchair", activities: ["camping"] },
  // 共用
  { key: "electronics", title: "電子設備", icon: "Smartphone" }, // v2.3 起合併原「電子照明」與「電子設備」
  { key: "accessory", title: "配件", icon: "Glasses" },
  { key: "safety", title: "醫療安全", icon: "Cross" },
  { key: "other", title: "其他", icon: "Package" },
];

// 已合併/停用的類別 key → 新的 key；App 打開時會自動把裝備搬過去
export const CATEGORY_ALIASES = { devices: "electronics" };

export const TEMP_CATEGORY_TITLE = "臨時品項";
export const DEFAULT_TARGET_G = 7000; // 預設舒適重量目標，可在 App 內修改

export const SAMPLE_GEAR = [
  { id: "speedgoat7", category: "shoes", name: "Hoka Speedgoat 7", note: "黑白・雙腳合計・輕量跑鞋", weight: 548 },
  { id: "olympus6", category: "shoes", name: "Altra Olympus 6 Hike Low GTX", note: "黑・雙腳合計・防水登山鞋", weight: 816 },
  { id: "storm-cruiser", category: "clothing", name: "Montbell Storm Cruiser 硬殼外套", note: "黃", weight: 269 },
  { id: "mt500", category: "clothing", name: "迪卡農 MT500 美麗諾長袖", note: "橘", weight: 216 },
  { id: "wind-parka", category: "clothing", name: "Montbell U.L. Stretch Wind Parka", note: "橘", weight: 117 },
  { id: "down-parka", category: "clothing", name: "Montbell Superior Down Parka 800FP", note: "未入手", weight: 249 },
  { id: "cove-beach-pant", category: "clothing", name: "Columbia Cove Beach Pant 登山褲", note: "橘黑", weight: 305 },
  { id: "decathlon-shorts", category: "clothing", name: "迪卡農登山短褲", note: "深灰", weight: 300 },
  { id: "smartwool-socks", category: "clothing", name: "Smartwool羊毛襪", note: "灰色 香菇/魚/斧頭", weight: 66.5 },
  { id: "darn-tough-socks", category: "clothing", name: "Darn Tough 羊毛襪", note: "外星人", weight: 77 },
  { id: "hmg-southwest40", category: "pack", name: "Hyperlite Mountain Gear Southwest 40L 背包", note: "白・M 尺寸官方規格", weight: 841 },
  { id: "adv-vest", category: "pack", name: "Salomon ADV Cross/Skin 15 攻頂包", note: "白・估算值", weight: 320 },
  { id: "naturehike-mat", category: "sleep", name: "Naturehike 羽骨R3.6超輕自動充氣睡墊", note: "黃", weight: 610 },
  { id: "naturehike-pillow", category: "sleep", name: "Naturehike 充氣枕頭", note: "", weight: 110 },
  { id: "sts-aeros-pillow", category: "sleep", name: "Sea to Summit Aeros Pillow Premium", note: "深藍・L 尺寸・包裝標示", weight: 150 },
  { id: "hydrapak", category: "water", name: "Hydrapak Contour 2L 水袋", note: "空重", weight: 142 },
  { id: "headlamp", category: "electronics", name: "Nitecore NU25 MCT UL 頭燈", note: "", weight: 47 },
  { id: "mt900-poles", category: "accessory", name: "迪卡農 MT900 摺疊登山杖", note: "單支 275g × 2", weight: 550 },
  { id: "trail-hat", category: "accessory", name: "Hoka Trail Run Hat", note: "黑・估算值", weight: 42 },
  { id: "urban3", category: "accessory", name: "VIGHT Urban 3 太陽眼鏡", note: "冰石藍", weight: 32 },
  { id: "beams-neckwarmer", category: "accessory", name: "Beams 圍脖", note: "", weight: 47 },
];

// 範例清單載入後預設勾選的品項（沿用 v1.x 的 defaultOn）
export const SAMPLE_DEFAULT_ON = [
  "storm-cruiser", "mt500", "wind-parka", "cove-beach-pant", "hmg-southwest40", "mt900-poles",
  "hydrapak", "naturehike-mat", "trail-hat", "urban3", "headlamp", "smartwool-socks",
  "darn-tough-socks", "naturehike-pillow", "beams-neckwarmer",
];

/** 裝備讀進來時補上缺的欄位（v2.x 的裝備沒有 activities → 屬於登山） */
export function normalizeGear(g) {
  return Array.isArray(g.activities) ? g : { ...g, activities: [DEFAULT_ACTIVITY] };
}

/** 紀錄讀進來時統一成最新格式（v1 → v2 → v3：補上 activity） */
export function normalizeRecord(r) {
  const v2 = upgradeLegacyRecord(r);
  return v2.activity ? v2 : { ...v2, activity: DEFAULT_ACTIVITY };
}

/**
 * v1.x 的紀錄格式 { checked, footwear, customItems } → v2 格式 { items: [...] }
 * v2 紀錄把每件裝備的名稱/重量完整存下來，之後改裝備清單也不影響舊紀錄
 */
export function upgradeLegacyRecord(r) {
  if (Array.isArray(r.items)) return r;
  const catTitle = (key) => PRESET_CATEGORIES.find((c) => c.key === key)?.title || "其他";
  const snap = (g) => ({ id: g.id, cat: catTitle(g.category), name: g.name, note: g.note || "", weight: g.weight });
  const items = SAMPLE_GEAR.filter(
    (g) => (g.category === "shoes" ? g.id === r.footwear : r.checked && r.checked[g.id])
  ).map(snap);
  (r.customItems || [])
    .filter((c) => c.checked)
    .forEach((c) => items.push({ id: c.id, cat: TEMP_CATEGORY_TITLE, name: c.name, note: "", weight: c.weight }));
  return { id: r.id, title: r.title, date: r.date, total: r.total, items };
}

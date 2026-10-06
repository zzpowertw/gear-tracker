// ============================================================
// 裝備資料表 —— 之後有新品項/新重量，直接在這裡增修即可
// weight 單位：公克 (g)
// estimated: true 表示官網無精確數據，屬於估算值
// defaultOn: true 表示預設勾選
// owned: false 會顯示「未入手」標籤
// ============================================================
export const LAYER_ITEMS = [
  { id: "storm-cruiser", name: "Montbell Storm Cruiser 硬殼外套", color: "黃", weight: 269, estimated: false, defaultOn: true },
  { id: "mt500", name: "迪卡農 MT500 美麗諾長袖", color: "橘", weight: 216, estimated: false, defaultOn: true },
  { id: "wind-parka", name: "Montbell U.L. Stretch Wind Parka", color: "橘", weight: 117, estimated: false, defaultOn: true },
  { id: "down-parka", name: "Montbell Superior Down Parka 800FP", color: "—", weight: 249, estimated: false, defaultOn: false, owned: false },
  { id: "cove-beach-pant", name: "Columbia Cove Beach Pant 登山褲", color: "橘黑", weight: 305, estimated: false, defaultOn: true },
  { id: "decathlon-shorts", name: "迪卡農登山短褲", color: "深灰", weight: 300, estimated: false, defaultOn: false },
];

export const FOOTWEAR_ITEMS = [
  { id: "speedgoat7", name: "Hoka Speedgoat 7", color: "黑白", weight: 548, estimated: false, note: "雙腳合計・輕量跑鞋" },
  { id: "olympus6", name: "Altra Olympus 6 Hike Low GTX", color: "黑", weight: 816, estimated: false, note: "雙腳合計・防水登山鞋" },
];

export const PACK_ITEMS = [
  { id: "hmg-southwest40", name: "Hyperlite Mountain Gear Southwest 40L 背包", color: "白", weight: 841, estimated: false, defaultOn: true, note: "M 尺寸官方規格" },
  { id: "adv-vest", name: "Salomon ADV Cross/Skin 15 攻頂包", color: "白", weight: 320, estimated: true, defaultOn: false },
  { id: "mt900-poles", name: "迪卡農 MT900 摺疊登山杖", color: "—", weight: 550, estimated: false, defaultOn: true, note: "單支 275g × 2" },
  { id: "hydrapak", name: "Hydrapak Contour 2L 水袋", color: "—", weight: 142, estimated: false, defaultOn: true, note: "空重" },
  { id: "naturehike-mat", name: "Naturehike 羽骨R3.6超輕自動充氣睡墊", color: "黃", weight: 610, estimated: false, defaultOn: true },
];

export const ACCESSORY_ITEMS = [
  { id: "trail-hat", name: "Hoka Trail Run Hat", color: "黑", weight: 42, estimated: true, defaultOn: true },
  { id: "urban3", name: "VIGHT Urban 3 太陽眼鏡", color: "冰石藍", weight: 32, estimated: false, defaultOn: true },
  { id: "headlamp", name: "Nitecore NU25 MCT UL 頭燈", color: "—", weight: 47, estimated: false, defaultOn: true, owned: true },
  { id: "smartwool-socks", name: "Smartwool羊毛襪", color: "灰色 香菇/魚/斧頭", weight: 66.5, estimated: false, defaultOn: true },
  { id: "darn-tough-socks", name: "Darn Tough 羊毛襪", color: "外星人", weight: 77, estimated: false, defaultOn: true, owned: true },
  { id: "naturehike-pillow", name: "Naturehike 充氣枕頭", color: "—", weight: 110, estimated: false, defaultOn: true },
  { id: "sts-aeros-pillow", name: "Sea to Summit Aeros Pillow Premium", color: "深藍", weight: 150, estimated: false, defaultOn: false, note: "L 尺寸・包裝標示" },
  { id: "beams-neckwarmer", name: "Beams 圍脖", color: "—", weight: 47, estimated: false, defaultOn: true },
];

export const MAX_SCALE_G = 9000; // 山岳量規的滿刻度（供視覺化用）
export const COMFORT_TARGET_G = 7000; // 葉董設定的舒適重量目標

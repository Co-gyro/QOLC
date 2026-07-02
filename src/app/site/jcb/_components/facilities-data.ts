/**
 * 提携シニアレジデンス候補（ワイヤーフレームの掲載5件）。
 * 所在地・タグ・説明は代表例（確定前）。序列を感じさせないため
 * 表示時にクライアントでシャッフルする。
 */
export interface Facility {
  /** 一意キー（React用） */
  readonly id: string;
  /** ブランド運営元 */
  readonly brand: string;
  /** 施設名 */
  readonly name: string;
  /** 所在地表記 */
  readonly location: string;
  /** 説明文 */
  readonly desc: string;
  /** 特徴タグ */
  readonly tags: readonly string[];
  /** 写真部の背景グラデーション（ブランド調） */
  readonly gradient: string;
}

/** 提携レジデンス5件（DOM順＝ワイヤー掲載順） */
export const FACILITIES: readonly Facility[] = [
  {
    id: "grancreer",
    brand: "東急不動産",
    name: "グランクレール",
    location: "📍 東京都世田谷区 ほか東急沿線",
    desc: "東急沿線を中心に展開。自立の方から介護まで、切れ目なく支える上質なレジデンス。",
    tags: ["自立型", "介護対応"],
    gradient: "linear-gradient(140deg,#0F1D36,#2A3D62)",
  },
  {
    id: "verina",
    brand: "東急電鉄",
    name: "ヴェリナ",
    location: "📍 東京都大田区 ほか東急沿線",
    desc: "駅近の利便性と東急グループの安心。都市で快適に暮らすシニアレジデンス。",
    tags: ["駅近", "都市型"],
    gradient: "linear-gradient(140deg,#12293F,#2E7D96)",
  },
  {
    id: "platesia",
    brand: "大和証券",
    name: "プラテシア",
    location: "📍 千葉県浦安市 ほか",
    desc: "資産・生活・健康をトータルに支える、大和証券グループの安心の住まい。",
    tags: ["自立型", "生活サポート"],
    gradient: "linear-gradient(140deg,#1A2740,#4A5A7A)",
  },
  {
    id: "orcus",
    brand: "野村不動産",
    name: "オーカス",
    location: "📍 東京都国立市 ほか",
    desc: "アクティブシニアのための、上質なサービスと自由な暮らしの自立型レジデンス。",
    tags: ["自立型", "アクティブシニア"],
    gradient: "linear-gradient(140deg,#2B2412,#8A713F)",
  },
  {
    id: "parkwellstate",
    brand: "三井不動産",
    name: "パークウエルステート",
    location: "📍 東京都杉並区（浜田山）ほか",
    desc: "ホテルライクな設えと医療連携。三井不動産が贈る最上級のシニアレジデンス。",
    tags: ["ハイクラス", "医療連携"],
    gradient: "linear-gradient(140deg,#101D2E,#33566B)",
  },
];

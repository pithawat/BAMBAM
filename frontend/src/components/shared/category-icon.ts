import {
  Armchair, Building2, DoorOpen, Droplets, Ellipsis, Hammer, Lightbulb, Plug, Presentation, ShowerHead, Snowflake, Sparkles, SquareParking,
  Trash2, Wrench, Zap, type LucideIcon,
} from "lucide-react";

// Category icons (settings S22 picker, repair S03 / S06 / S07 tiles): one map. The first 12 are the S22 choices
// (04-api-contract.md `Category.icon`); the last 4 are the repair CR-014 master icons, offered too so a seeded
// category keeps its icon when edited. Unknown names fall back to `wrench`.

export const CATEGORY_ICONS = [
  { name: "wrench", label: "ทั่วไป", icon: Wrench },
  { name: "snowflake", label: "ปรับอากาศ", icon: Snowflake },
  { name: "lightbulb", label: "แสงสว่าง", icon: Lightbulb },
  { name: "zap", label: "ไฟฟ้า", icon: Zap },
  { name: "plug", label: "ปลั๊ก", icon: Plug },
  { name: "droplets", label: "น้ำ", icon: Droplets },
  { name: "shower-head", label: "สุขภัณฑ์", icon: ShowerHead },
  { name: "armchair", label: "เฟอร์นิเจอร์", icon: Armchair },
  { name: "door-open", label: "ประตู / อาคาร", icon: DoorOpen },
  { name: "sparkles", label: "ความสะอาด", icon: Sparkles },
  { name: "trash-2", label: "ขยะ", icon: Trash2 },
  { name: "hammer", label: "ซ่อมบำรุง", icon: Hammer },
  { name: "presentation", label: "ห้องประชุมและโสตฯ", icon: Presentation },
  { name: "building-2", label: "อาคาร", icon: Building2 },
  { name: "square-parking", label: "ที่จอดรถ", icon: SquareParking },
  { name: "ellipsis", label: "อื่น ๆ", icon: Ellipsis },
] as const satisfies readonly { name: string; label: string; icon: LucideIcon }[];

export type CategoryIconName = (typeof CATEGORY_ICONS)[number]["name"];

export const categoryIconOf = (name?: string | null): LucideIcon => CATEGORY_ICONS.find((i) => i.name === name)?.icon ?? Wrench;

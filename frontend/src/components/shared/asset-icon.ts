import { createElement } from "react";
import { AirVent, Armchair, Box, Droplets, Mic, Plug, Speaker, Tv, type LucideIcon } from "lucide-react";

// Equipment type icons (settings 04-api-contract.md `AssetTypeAdmin.icon`, CR-001): one map for settings S20 and
// repair S29. Keys are lucide names stored on the type; unknown names fall back to `box`.

export const ASSET_ICONS = [
  { name: "box", label: "อุปกรณ์ทั่วไป", icon: Box },
  { name: "air-vent", label: "เครื่องปรับอากาศ", icon: AirVent },
  { name: "mic", label: "ไมโครโฟน", icon: Mic },
  { name: "speaker", label: "ลำโพง", icon: Speaker },
  { name: "tv", label: "จอภาพ", icon: Tv },
  { name: "plug", label: "อุปกรณ์ไฟฟ้า", icon: Plug },
  { name: "droplets", label: "ระบบน้ำ", icon: Droplets },
  { name: "armchair", label: "เฟอร์นิเจอร์", icon: Armchair },
] as const satisfies readonly { name: string; label: string; icon: LucideIcon }[];

export type AssetIconName = (typeof ASSET_ICONS)[number]["name"];

/** The lucide component of a stored icon name (`box` for unknown names). */
export function assetIconOf(name: string | null | undefined): LucideIcon {
  return ASSET_ICONS.find((i) => i.name === name)?.icon ?? Box;
}

/** Icon names of the seeded type keys (repair CR-016), for data that carries the type key but not its icon. */
export const SEEDED_TYPE_ICONS: Record<string, AssetIconName> = { aircon: "air-vent", microphone: "mic", speaker: "speaker", tv: "tv" };

/** Renders a stored icon name (decorative unless `label` is given). */
export function AssetIcon({ icon, className, label }: { icon: string | null | undefined; className?: string; label?: string }) {
  return createElement(assetIconOf(icon), { className, "aria-hidden": label ? undefined : true, "aria-label": label });
}

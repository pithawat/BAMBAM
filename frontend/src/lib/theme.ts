// Colour themes (D-069). A theme only remaps the tokens in app/globals.css (`:root[data-theme=…]`); components
// never read the theme. The choice is per browser (localStorage) and applied before paint by THEME_INIT_SCRIPT.

export type ThemeId = "default" | "calm";

export const THEMES: { id: ThemeId; label: string; hint: string; swatches: [string, string, string] }[] = [
  { id: "default", label: "มาตรฐาน", hint: "ฟ้าสด ส้มแทนเจอรีน เขียวมรกต", swatches: ["#2741FA", "#B93D0A", "#0B7A5E"] },
  { id: "calm", label: "โทนสบายตา", hint: "เทาอมฟ้า เขียวเซจ มัสตาร์ด", swatches: ["#2741FA", "#8A5A12", "#2C6B67"] },
];

const KEY = "bambam.theme";

/** Inline in <head>: sets `data-theme` before the first paint so the page never flashes the default colours. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${KEY}");if(t==="calm")document.documentElement.dataset.theme=t}catch(e){}`;

export function currentTheme(): ThemeId {
  return typeof document !== "undefined" && document.documentElement.dataset.theme === "calm" ? "calm" : "default";
}

export function applyTheme(id: ThemeId) {
  const root = document.documentElement;
  if (id === "default") delete root.dataset.theme;
  else root.dataset.theme = id;
  try {
    if (id === "default") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, id);
  } catch {
    // Private mode / blocked storage: the theme still applies for this page view.
  }
}

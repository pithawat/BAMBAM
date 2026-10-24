// Runs inside the app page (page.evaluate). Must stay self-contained: no imports, no closures.
// Draws the caption box, the highlight ring around [data-atlas-hl] and, while waiting,
// a transparent shield so a click anywhere (or Space / →) calls window.__atlasNext().
export function overlay(p) {
  let host = document.getElementById("__atlas");
  if (p.mode === "clear") { if (host) host.remove(); return; }
  if (!host) {
    host = document.createElement("div");
    host.id = "__atlas";
    host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none";
    document.documentElement.appendChild(host);
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>
      :host{all:initial}
      *{box-sizing:border-box;font-family:system-ui,"Leelawadee UI","Noto Sans Thai",sans-serif}
      .shield{position:fixed;inset:0;pointer-events:auto;cursor:pointer;background:transparent}
      .ring{position:fixed;border:3px solid #EA580C;border-radius:10px;box-shadow:0 0 0 4px rgba(234,88,12,.25);transition:all .12s ease-out;animation:pulse 1.4s ease-in-out infinite}
      .ring span{position:absolute;top:-26px;right:-4px;background:#EA580C;color:#fff;font-size:12px;font-weight:600;padding:2px 8px;border-radius:6px;white-space:nowrap}
      @keyframes pulse{50%{box-shadow:0 0 0 9px rgba(234,88,12,.08)}}
      @media (prefers-reduced-motion:reduce){.ring{animation:none;transition:none}}
      .cap{position:fixed;right:18px;bottom:18px;width:min(360px,calc(100vw - 36px));background:#182238;color:#F6F7FA;border-radius:14px;padding:14px 16px;display:grid;gap:6px;box-shadow:0 14px 40px rgba(0,0,0,.35);pointer-events:auto;font-size:14px;line-height:1.5}
      .top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;font-size:12px;opacity:.75}
      .top span:last-child{white-space:nowrap;flex:none}
      .sw{background:#EA580C;color:#fff;border-radius:6px;padding:0 7px;font-weight:600;opacity:1}
      b{font-size:16px;font-weight:600}
      .exp{font-size:13px;border-top:1px solid rgba(246,247,250,.2);padding-top:6px}
      .sub{font-size:12.5px;opacity:.7}
      .err{color:#FFB4A8}
      .nx{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12.5px;margin-top:2px}
      .nx button{border:0;background:#2741FA;color:#fff;border-radius:8px;padding:6px 14px;font-weight:600;font-size:13px;cursor:pointer}
      .k{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;border:1px solid currentColor;border-radius:4px;padding:0 5px;opacity:.8}
      .dots{display:inline-flex;gap:4px}.dots i{width:6px;height:6px;border-radius:50%;background:#F6F7FA;opacity:.3;animation:d 1s infinite}.dots i:nth-child(2){animation-delay:.2s}.dots i:nth-child(3){animation-delay:.4s}
      @keyframes d{50%{opacity:1}}
    </style><div class="ring" hidden><span></span></div><div class="shield" hidden></div><div class="cap"></div>`;
    const ring = root.querySelector(".ring");
    const tick = () => {
      if (!host.isConnected) return;
      const el = document.querySelector("[data-atlas-hl]");
      if (el) {
        const r = el.getBoundingClientRect();
        ring.hidden = false;
        ring.style.left = r.left - 6 + "px"; ring.style.top = r.top - 6 + "px";
        ring.style.width = r.width + 12 + "px"; ring.style.height = r.height + 12 + "px";
      } else ring.hidden = true;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    root.querySelector(".shield").addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); window.__atlasNext && window.__atlasNext(); });
    root.querySelector(".cap").addEventListener("click", (e) => { if (e.target.closest("[data-next]")) window.__atlasNext && window.__atlasNext(); });
    if (!window.__atlasKeys) {
      window.__atlasKeys = true;
      window.addEventListener("keydown", (e) => {
        const h = document.getElementById("__atlas");
        if (h && h.dataset.waiting === "1" && (e.code === "Space" || e.key === "ArrowRight")) {
          e.preventDefault(); e.stopPropagation(); window.__atlasNext && window.__atlasNext();
        }
      }, true);
    }
  }
  const root = host.shadowRoot;
  const waiting = ["waiting", "skipped", "end", "error"].includes(p.mode);
  host.dataset.waiting = waiting ? "1" : "0";
  root.querySelector(".shield").hidden = !waiting;
  root.querySelector(".ring span").textContent = p.clickNext ? "กดตรงนี้ต่อ" : "ดูตรงนี้";
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const foot = {
    working: `<span class="dots"><i></i><i></i><i></i></span><span>กำลังทำขั้นนี้</span>`,
    waiting: `<span>กด <span class="k">Space</span> หรือคลิกเพื่อไปต่อ</span><button type="button" data-next>ถัดไป →</button>`,
    skipped: `<span>กด <span class="k">Space</span> เพื่อข้าม</span><button type="button" data-next>ข้าม →</button>`,
    end: `<span>จบ flow แล้ว</span><button type="button" data-next>ปิดหน้าต่าง</button>`,
    error: `<span>หยุดรัน</span><button type="button" data-next>ปิดหน้าต่าง</button>`,
  }[p.mode] ?? "";
  root.querySelector(".cap").innerHTML = `
    <div class="top"><span>${esc(p.flow)} · ขั้น ${p.step} / ${p.total}</span>${p.role ? `<span class="${p.switched ? "sw" : ""}">${p.switched ? "สลับเป็น " : ""}${esc(p.role)}</span>` : ""}</div>
    <b>${esc(p.title)}</b>${p.desc ? `<div>${esc(p.desc)}</div>` : ""}
    ${p.note ? `<div class="sub ${p.mode === "error" ? "err" : ""}">${esc(p.note)}</div>` : ""}
    ${p.expect ? `<div class="exp">ควรเห็น: ${esc(p.expect)}</div>` : ""}
    <div class="nx">${foot}</div>`;
}

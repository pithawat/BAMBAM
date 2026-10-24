// Drives one flow tour in a real browser with Playwright.
//   embed   — headless Chromium streamed into the Atlas page (popup); Space / click there advances
//   live    — headed Chromium window, waits for Space / click at every step
//   verify  — headless, no waiting: checks the tour still passes; a failing step's screenshot goes to the OS temp folder
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { overlay } from "./overlay.mjs";
import { ensureStack } from "./stack.mjs";

export function loadPlaywright(root, config) {
  const bases = [config.playwrightFrom, "tools/atlas", "."].filter(Boolean);
  for (const base of bases) {
    const req = createRequire(path.join(root, base, "package.json"));
    for (const name of ["playwright", "@playwright/test"]) {
      try { return req(name); } catch { /* try the next one */ }
    }
  }
  throw new Error(`Playwright not found. Install it (npm i -D playwright) or set playwrightFrom in atlas.config.mjs`);
}

export function assertAllowedHost(config) {
  const host = new URL(config.baseURL).hostname;
  if (!config.allowHosts.includes(host)) throw new Error(`baseURL host "${host}" is not in allowHosts — the runner only drives dev/UAT hosts you list`);
}

const RX = /^\/(.*)\/([dgimsuy]*)$/s;

export class TourRun {
  constructor({ root, config, project, module, flow, from = 0, mode = "live", onUpdate = () => {}, onFrame = () => {} }) {
    Object.assign(this, { root, config, project, module, flow, from, mode, onUpdate, onFrame });
    this.steps = flow.tour.steps;
    this.aliases = flow.tour.aliases ?? {};
    this.vars = { run: Date.now().toString(36).toUpperCase() };
    this.status = { state: "starting", mode, url: "", module: module.key, flow: flow.id, step: Math.max(0, from), total: this.steps.length, title: "", message: "" };
  }

  set(patch) { Object.assign(this.status, patch); this.onUpdate({ ...this.status }); }
  next() { const go = this._advance; this._advance = null; go?.(); }
  stop() { this.stopped = true; this.next(); this.browser?.close().catch(() => {}); }

  sub(v) { return typeof v === "string" ? v.replace(/\{\{(\w+)\}\}/g, (_, k) => this.vars[k] ?? "") : v; }
  rx(v) { const s = this.sub(v); const m = typeof s === "string" && s.match(RX); return m ? new RegExp(m[1], m[2]) : s; }

  /** Locator spec → Playwright locator. Strings: "@alias" or a CSS selector. Objects: role/text/label/testId/css (+ name, exact, hasText, within, nth, visible). */
  loc(spec, base = this.page) {
    if (typeof spec === "string") {
      if (spec.startsWith("@")) {
        const a = this.aliases[spec.slice(1)];
        if (!a) throw new Error(`unknown alias ${spec}`);
        return this.loc(a, base);
      }
      return base.locator(this.sub(spec)).first();
    }
    const within = spec.within ? this.loc(spec.within, base) : base;
    const opt = spec.exact ? { exact: true } : {};
    let l;
    if (spec.role) l = within.getByRole(spec.role, spec.name != null ? { name: this.rx(spec.name), ...opt } : opt);
    else if (spec.text != null) l = within.getByText(this.rx(spec.text), opt);
    else if (spec.label != null) l = within.getByLabel(this.rx(spec.label), opt);
    else if (spec.testId) l = within.getByTestId(spec.testId);
    else if (spec.css) l = within.locator(this.sub(spec.css));
    else if (spec.xpath) l = within.locator(`xpath=${this.sub(spec.xpath)}`);
    else throw new Error(`locator needs role, text, label, testId, css or xpath: ${JSON.stringify(spec)}`);
    if (spec.hasText != null) l = l.filter({ hasText: this.rx(spec.hasText) });
    if (spec.visible) l = l.filter({ visible: true });
    return spec.nth != null ? l.nth(spec.nth) : l.first();
  }

  async mark(l) { try { await l.evaluate((el) => el.setAttribute("data-atlas-hl", "")); } catch { /* element gone */ } }
  async unmark() { try { await this.page.evaluate(() => document.querySelectorAll("[data-atlas-hl]").forEach((e) => e.removeAttribute("data-atlas-hl"))); } catch { /* navigating */ } }

  async paint(i, mode, extra = {}) {
    const s = this.steps[i] ?? {};
    const roles = this.project.sessionRoles ?? {};
    try {
      await this.page.evaluate(overlay, {
        mode, flow: `${this.flow.id} ${this.flow.name}`, step: i + 1, total: this.steps.length,
        title: this.sub(s.title), desc: this.sub(s.desc), expect: this.sub(s.expect),
        role: roles[this.role] ?? this.role, switched: this.switchedAt === i && i > 0,
        clickNext: !!s.highlight && s.next !== false, ...extra,
      });
    } catch { /* page is navigating; the next paint redraws */ }
  }

  waitAdvance() {
    if (this.stopped) return Promise.resolve();
    return new Promise((resolve) => { this._advance = resolve; });
  }

  async switchRole(role, reload) {
    const cookies = await this.config.session(role, { baseURL: this.config.baseURL });
    await this.ctx.clearCookies();
    await this.ctx.addCookies(cookies);
    this.role = role;
    if (reload && this.page.url() !== "about:blank") await this.page.reload();
  }

  async act(a, fast) {
    const p = this.page, t = a.timeout ?? 30_000;
    if (a.goto) return p.goto(this.sub(a.goto));
    if (a.click) {
      const l = this.loc(a.click);
      return a.dispatch ? l.dispatchEvent("click") : l.click({ force: !!a.force, timeout: t });
    }
    if (a.fill) {
      const l = this.loc(a.fill);
      await l.waitFor({ state: "visible", timeout: t });
      await this.mark(l);
      await l.fill("");
      if (fast) await l.fill(this.sub(a.text)); else await l.pressSequentially(this.sub(a.text), { delay: 55 });
      return this.unmark();
    }
    if (a.pick) {
      await this.loc(a.pick).click({ timeout: t });
      return p.getByRole("option", { name: this.sub(a.option), exact: true }).click({ timeout: t });
    }
    if (a.press) return p.keyboard.press(a.press);
    if (a.drag) return this.drag(a.drag, fast);
    if (a.see) {
      const l = typeof a.see === "string" && !a.see.startsWith("@") ? p.getByText(this.rx(a.see)).first() : this.loc(a.see);
      return l.waitFor({ state: "visible", timeout: t });
    }
    if (a.notSee) return this.loc(a.notSee).waitFor({ state: "hidden", timeout: t });
    if (a.waitFor) return this.loc(a.waitFor).waitFor({ state: "visible", timeout: a.timeout ?? 60_000 });
    if (a.scrollTo) return this.loc(a.scrollTo).evaluate((el) => el.scrollIntoView({ block: "center" }));
    if (a.wait) return p.waitForTimeout(fast ? Math.min(a.wait, 200) : a.wait);
    throw new Error(`unknown action ${JSON.stringify(a)}`);
  }

  async drag(d, fast) {
    const fb = await this.loc(d.from).boundingBox(), tb = await this.loc(d.to).boundingBox();
    if (!fb || !tb) throw new Error("drag: element not on screen");
    const from = { x: fb.x + fb.width / 2, y: fb.y + fb.height / 2 };
    // at: "below" drops dy px under the target's bottom edge (e.g. inside a room, under its label)
    const ty = d.at === "below" ? tb.y + tb.height : tb.y + tb.height / 2;
    const to = { x: tb.x + tb.width / 2 + (d.dx ?? 0), y: ty + (d.dy ?? 0) };
    const m = this.page.mouse, n = fast ? 12 : 30;
    await m.move(from.x, from.y);
    await m.down();
    for (let i = 1; i <= n; i++) {
      await m.move(from.x + ((to.x - from.x) * i) / n, from.y + ((to.y - from.y) * i) / n);
      if (!fast) await this.page.waitForTimeout(16);
    }
    await m.up();
  }

  async runStep(i) {
    const s = this.steps[i], fast = i < this.from || this.mode === "verify", p = this.page;
    this.set({ state: fast ? "skipping" : "working", step: i, title: this.sub(s.title), message: "" });
    if (s.role && s.role !== this.role) { this.switchedAt = i; await this.switchRole(s.role, !s.goto); }
    if (s.becomes) { this.switchedAt = i; this.role = s.becomes; } // the app itself changed the session (e.g. its role switcher)
    if (s.goto) await p.goto(this.sub(s.goto));
    if (!fast) await this.paint(i, "working");
    for (const a of s.do ?? []) await this.act(a, fast);

    let target = null, skipped = false;
    if (s.highlight) {
      target = this.loc(s.highlight);
      try {
        await target.waitFor({ state: "visible", timeout: s.timeout ?? 30_000 });
        await target.scrollIntoViewIfNeeded();
      } catch (e) {
        if (!s.optional) throw e;
        skipped = true; target = null;
      }
    }
    if (!fast) {
      if (target) await this.mark(target);
      await this.paint(i, skipped ? "skipped" : "waiting", skipped ? { note: s.skipped ?? "ข้ามขั้นนี้ เพราะไม่พบสิ่งที่ต้องกดในข้อมูลตอนนี้", clickNext: false } : {});
      this.set({ state: "waiting" });
      await this.waitAdvance();
      if (this.stopped) return;
      await this.unmark();
      await this.paint(i, "clear");
    }
    if (skipped) return;
    const next = s.next === false ? [] : s.next ?? (target ? [{ click: s.highlight }] : []);
    for (const a of next) await this.act(a, fast);
    await p.waitForTimeout(fast ? 150 : 400);
  }

  /** live = headed window. Headless runs use Chrome's new headless (`channel: "chromium"`), which keeps the GPU:
   *  the old headless shell falls back to software WebGL (SwiftShader) and draws 3D at ~2 fps. */
  async launch(chromium, b) {
    if (this.mode === "live") return chromium.launch({ headless: false, args: b.args ?? [] });
    try {
      return await chromium.launch({ headless: true, channel: b.headlessChannel ?? "chromium", args: b.headlessArgs ?? [] });
    } catch {
      return chromium.launch({ headless: true, args: b.captureArgs ?? [] }); // older Playwright: headless shell
    }
  }

  /** embed mode: stream the headless page as JPEG frames (CDP screencast) to onFrame(base64). */
  async startScreencast(vp) {
    const cdp = await this.ctx.newCDPSession(this.page);
    cdp.on("Page.screencastFrame", ({ data, sessionId }) => {
      this.onFrame(data);
      cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 70, maxWidth: vp.width, maxHeight: vp.height, everyNthFrame: 1 });
  }

  async start() {
    assertAllowedHost(this.config);
    const { chromium } = loadPlaywright(this.root, this.config);
    const b = this.config.browser ?? {};
    const verify = this.mode === "verify";
    try {
      await ensureStack(this.root, this.config, (message) => this.set({ message }));
      // preflight: the project proves the run goes to its test stack (e.g. not the dev database) before any browser opens
      if (this.config.preflight) { this.set({ message: "กำลังตรวจว่าแอพใช้ database ทดสอบ…" }); await this.config.preflight(); }
      this.set({ message: "" });
    } catch (e) {
      this.set({ state: "error", message: `ยังรันไม่ได้: ${String(e?.message ?? e).split("\n")[0]}` });
      return this.status;
    }
    this.browser = await this.launch(chromium, b);
    this.browser.on("disconnected", () => { if (!this.finished) { this.stopped = true; this.next(); } });
    this.ctx = await this.browser.newContext({ baseURL: this.config.baseURL, viewport: b.viewport ?? { width: 1280, height: 800 }, locale: b.locale, timezoneId: b.timezoneId });
    this.ctx.setDefaultNavigationTimeout(120_000); // a fresh `next dev` compiles each route on its first visit
    await this.ctx.exposeBinding("__atlasNext", () => this.next());
    this.page = await this.ctx.newPage();
    this.page.on("framenavigated", (fr) => { if (fr === this.page.mainFrame()) this.set({ url: fr.url() }); });
    if (this.mode === "embed") await this.startScreencast(b.viewport ?? { width: 1280, height: 800 });

    let i = 0;
    try {
      for (; i < this.steps.length && !this.stopped; i++) await this.runStep(i);
      if (this.stopped) { this.set({ state: "stopped", message: "หยุดแล้ว" }); return this.status; }
      this.finished = true;
      if (verify) {
        this.set({ state: "done", step: this.steps.length - 1, message: `ผ่านครบ ${this.steps.length} ขั้น` });
      } else {
        this.set({ state: "done", step: this.steps.length - 1, message: "จบ flow แล้ว" });
        await this.paint(this.steps.length - 1, "end", { note: "รันครบทุกขั้นแล้ว", clickNext: false });
        await this.waitAdvance();
      }
    } catch (e) {
      this.finished = true;
      let msg = String(e?.message ?? e).split("\n")[0];
      if (verify && !this.stopped) {
        const shot = path.join(tmpdir(), `atlas-${this.module.key}-${this.flow.id}-step${i + 1}.png`);
        if (await this.page.screenshot({ path: shot }).then(() => true, () => false)) msg += ` (ภาพ: ${shot})`;
      }
      this.set({ state: this.stopped ? "stopped" : "error", step: i, message: this.stopped ? "หยุดแล้ว" : msg });
      if (!this.stopped && !verify) {
        await this.paint(i, "error", { note: `หยุดที่ขั้นนี้: ${msg}`, clickNext: false });
        await this.waitAdvance();
      }
    } finally {
      this.finished = true;
      await this.browser.close().catch(() => {});
    }
    return this.status;
  }
}

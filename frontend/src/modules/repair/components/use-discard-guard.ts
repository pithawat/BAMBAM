"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Keeps a same-URL history entry while a draft is dirty, so browser Back can show the discard dialog. */
export function useDiscardGuard(dirty: boolean) {
  const router = useRouter();
  const dirtyRef = useRef(dirty);
  const guarded = useRef(false);
  const bypass = useRef(false);
  const pending = useRef<(() => void) | null>(null);
  const afterCollapse = useRef<(() => void) | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  useEffect(() => {
    if (dirty && !guarded.current) {
      bypass.current = false;
      window.history.pushState({ ...window.history.state, repairDraft: true }, "", window.location.href);
      guarded.current = true;
    }
  }, [dirty]);
  function navigate(href: string, replace = false) {
    bypass.current = true;
    const go = () => { if (replace) router.replace(href); else router.push(href); };
    if (guarded.current) {
      guarded.current = false; afterCollapse.current = go; window.history.back();
    } else go();
  }
  function leave(href = "/") {
    if (!dirtyRef.current) navigate(href);
    else { pending.current = () => navigate(href); setOpen(true); }
  }
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (dirtyRef.current && !bypass.current) { event.preventDefault(); event.returnValue = ""; }
    }
    function back(event: PopStateEvent) {
      if (afterCollapse.current) {
        event.stopImmediatePropagation(); const go = afterCollapse.current; afterCollapse.current = null;
        window.setTimeout(go, 0); return;
      }
      if (!guarded.current || bypass.current) return;
      event.stopImmediatePropagation();
      window.history.pushState({ ...window.history.state, repairDraft: true }, "", window.location.href);
      const go = () => { bypass.current = true; guarded.current = false; window.history.go(-2); };
      if (dirtyRef.current) { pending.current = go; setOpen(true); } else go();
    }
    function click(event: MouseEvent) {
      if (!dirtyRef.current || bypass.current || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault(); event.stopImmediatePropagation();
      pending.current = () => {
        bypass.current = true;
        const go = () => router.push(url.pathname + url.search + url.hash);
        if (guarded.current) { guarded.current = false; afterCollapse.current = go; window.history.back(); } else go();
      };
      setOpen(true);
    }
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", back, true);
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); window.removeEventListener("popstate", back, true); document.removeEventListener("click", click, true); };
  }, [router]);
  return { open, setOpen, leave, finish: (href: string) => navigate(href, true), discard: () => { setOpen(false); pending.current?.(); pending.current = null; } };
}

"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

const origins = new Map<string, string>();

// List pages S07 returns to with their filters: S06, S09, S11 (Stage 3).
const LISTS = new Set(["/repair/my", "/repair/work", "/repair/admin/queue"]);

export function rememberTicketOrigin(href: string) {
  if (LISTS.has(window.location.pathname)) {
    origins.set(href.split("?")[0], window.location.pathname + window.location.search);
  }
}

export function ticketReturnHref(id: string, fallback = "/repair/my") {
  return origins.get(`/repair/tickets/${encodeURIComponent(id)}`) ?? fallback;
}

export function TicketLink({ href, onClick, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props} href={href} onClick={(event) => {
    if (typeof href === "string") rememberTicketOrigin(href);
    onClick?.(event);
  }} />;
}

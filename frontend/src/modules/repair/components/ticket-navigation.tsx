"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

const origins = new Map<string, string>();

export function rememberTicketOrigin(href: string) {
  if (window.location.pathname === "/repair/my") {
    origins.set(href.split("?")[0], window.location.pathname + window.location.search);
  }
}

export function ticketReturnHref(id: string) {
  return origins.get(`/repair/tickets/${encodeURIComponent(id)}`) ?? "/repair/my";
}

export function TicketLink({ href, onClick, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props} href={href} onClick={(event) => {
    if (typeof href === "string") rememberTicketOrigin(href);
    onClick?.(event);
  }} />;
}

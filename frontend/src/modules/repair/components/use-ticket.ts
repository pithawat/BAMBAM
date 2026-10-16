"use client";

import { useCallback, useEffect, useState } from "react";
import { getTicket } from "../api";
import type { TicketDetail } from "../types";

type Result = { id: string; ticket?: TicketDetail; error?: unknown };

/**
 * Loads a ticket. Refreshes (window focus, `reload`) happen in the background: the current
 * ticket stays on screen, so forms built on it (e.g. S10 with photos picked) are not torn down
 * when the file picker closes and the window regains focus. The skeleton shows only while there
 * is nothing to show for this id yet.
 */
export function useTicket(id: string) {
  const [result, setResult] = useState<Result>();
  const [revision, setRevision] = useState(0);
  const current = result?.id === id ? result : undefined;

  const reload = useCallback(() => {
    // After an error, retrying shows the skeleton again; a loaded ticket stays.
    setResult((old) => (old?.id === id && old.ticket ? old : undefined));
    setRevision((n) => n + 1);
  }, [id]);
  /** Shows the ticket an action returned without refetching. */
  const replace = useCallback((ticket: TicketDetail) => setResult({ id, ticket }), [id]);

  useEffect(() => {
    let active = true;
    getTicket(id).then(
      (ticket) => { if (active) setResult({ id, ticket }); },
      (error: unknown) => {
        // A failed background refresh keeps the ticket on screen.
        if (active) setResult((old) => (old?.id === id && old.ticket ? old : { id, error }));
      },
    );
    return () => { active = false; };
  }, [id, revision]);

  useEffect(() => {
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, [reload]);

  return { loading: !current, ticket: current?.ticket, error: current?.error, reload, replace };
}

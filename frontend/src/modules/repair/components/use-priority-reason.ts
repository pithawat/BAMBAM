"use client";

import { useEffect, useState } from "react";
import { getCategories } from "../api";
import { priorityReason } from "../priority";
import type { Category, TicketSummary } from "../types";
import { categoryName } from "./ticket-presentation";

// "ระบบกำหนดจากอาการ “มีน้ำหยด”" for a ticket (S05, S07 facts). The ticket carries only the level
// and its source, so the symptom that set it is looked up in the categories (#1), loaded once.

let categories: Promise<Category[]> | null = null;
const loadCategories = () => (categories ??= getCategories().catch((err: unknown) => { categories = null; throw err; }));

export function usePriorityReason(ticket: Pick<TicketSummary, "priority" | "prioritySource" | "category" | "categoryOther" | "symptoms"> | undefined) {
  const [symptom, setSymptom] = useState<string>();
  const categoryId = ticket?.category?.id;
  const symptomKey = ticket?.symptoms.map((s) => s.id).join(",");
  const needsLookup = ticket?.prioritySource === "symptom" && !!categoryId;
  useEffect(() => {
    if (!needsLookup || !ticket) return;
    let active = true;
    loadCategories().then((list) => {
      if (!active) return;
      const picked = list.find((c) => c.id === categoryId)?.symptoms.filter((s) => ticket.symptoms.some((t) => t.id === s.id)) ?? [];
      setSymptom(picked.find((s) => s.priority === ticket.priority)?.name);
    }, () => undefined);
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by ids, not the object
  }, [needsLookup, categoryId, symptomKey, ticket?.priority]);
  if (!ticket) return "";
  return priorityReason({ source: ticket.prioritySource, symptom: needsLookup ? symptom : undefined, categoryName: categoryName(ticket) });
}

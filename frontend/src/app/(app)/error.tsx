"use client";

import { ErrorState } from "@/components/shared/states";

// Whole page failed (_common.md §6): mascot + retry.
export default function AppError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState onRetry={retry} className="pt-16" />;
}

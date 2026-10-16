"use client";
import { ErrorState } from "@/components/shared/states";
export default function RepairError({ reset }: { reset: () => void }) { return <ErrorState onRetry={reset} />; }

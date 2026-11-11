import { Suspense } from "react";
import { FormSkeleton, ReportForm } from "@/modules/repair/components/report-form";
// `?mode=team` (CR-021) is read on the client, so the form waits in a Suspense boundary.
export default function ReportPage() { return <Suspense fallback={<FormSkeleton />}><ReportForm /></Suspense>; }

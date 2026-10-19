"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ServiceHeader } from "./service-header";
import type { Service } from "./service-icon";

// One component for every page title (_common.md §1 "Mobile page headers"):
//   mobile  — `brand` short blue header · `service` white header with the service icon · white `bar`
//             (back + centered title) · `none` (the page draws its own)
//   desktop — H1 title · optional search / action
// The bell, account menu and dev role switcher live in the shell (navbar, CR-010). No gradients (CR-008).

type PageHeaderProps = {
  title: string;
  variant: "brand" | "service" | "bar" | "none";
  service?: Service;
  subtitle?: ReactNode;
  /** `bar`: where back goes (default: history back). */
  backHref?: string;
  /** Right action in the mobile header. */
  action?: ReactNode;
  /** Desktop: search pill or page action beside the title. */
  search?: ReactNode;
  /** Extra content inside the mobile gradient header (e.g. profile avatar). */
  children?: ReactNode;
};

export function PageHeader({ title, variant, service = "repair", subtitle, backHref, action, search, children }: PageHeaderProps) {
  return (
    <>
      <div className="lg:hidden">
        {variant === "brand" && (
          <header className="relative overflow-hidden rounded-b-[34px] bg-brand px-4 pt-5 pb-16 text-white">
            <span aria-hidden className="pointer-events-none absolute -top-18 -right-28 size-68 rounded-full bg-white/15" />
            <span aria-hidden className="pointer-events-none absolute -bottom-24 -left-20 size-50 rounded-full bg-white/10" />
            <div className="relative flex items-center gap-3">
              <h1 className="flex-1 font-heading text-xl font-semibold">{title}</h1>
              {action}
            </div>
            {children && <div className="relative mt-3">{children}</div>}
          </header>
        )}
        {variant === "service" && (
          <ServiceHeader service={service} title={title} subtitle={subtitle} action={action}>
            {children}
          </ServiceHeader>
        )}
        {variant === "bar" && <TopBarMobile title={title} backHref={backHref} action={action} />}
      </div>

      <div className="hidden items-center gap-3.5 pb-4.5 lg:flex">
        <h1 className="mr-auto font-heading text-[28px] leading-10 font-semibold">{title}</h1>
        {search}
      </div>
    </>
  );
}

function TopBarMobile({ title, backHref, action }: { title: string; backHref?: string; action?: ReactNode }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-20 grid h-14 grid-cols-[44px_1fr_44px] items-center border-b bg-card px-2">
      {backHref ? (
        <Button asChild variant="ghost" size="icon" aria-label="ย้อนกลับ">
          <Link href={backHref}>
            <ChevronLeft />
          </Link>
        </Button>
      ) : (
        <Button variant="ghost" size="icon" aria-label="ย้อนกลับ" onClick={() => router.back()}>
          <ChevronLeft />
        </Button>
      )}
      <h1 className={cn("truncate text-center font-heading text-[17px] font-semibold")}>{title}</h1>
      <div className="flex justify-end">{action}</div>
    </header>
  );
}

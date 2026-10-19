import type { Metadata, Viewport } from "next";
import { Anuphan } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Font from docs/shared/design-system.md (Typography): Anuphan only (CR-008).
const anuphan = Anuphan({
  variable: "--font-anuphan",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "BAMBAM", template: "%s · BAMBAM" },
  description: "ศูนย์รวมบริการที่ทำงาน สำหรับพนักงาน CPAC สำนักงานใหญ่",
};

export const viewport: Viewport = {
  themeColor: "#2741FA",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: THEME_INIT_SCRIPT may add data-theme before React hydrates.
    <html lang="th" className={`${anuphan.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster theme="light" position="top-center" />
      </body>
    </html>
  );
}

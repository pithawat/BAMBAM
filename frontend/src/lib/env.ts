import { z } from "zod";

// NEXT_PUBLIC_* values are inlined at build time, so each one must be read
// with a literal `process.env.NEXT_PUBLIC_…` expression.
const bool = z
  .enum(["true", "false", ""])
  .optional()
  .transform((v) => v === "true");

const schema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().min(1),
  NEXT_PUBLIC_USE_MOCKS: bool,
  NEXT_PUBLIC_ROLE_SWITCHER: bool,
  NEXT_PUBLIC_APP_VERSION: z.string().default("0.1.0"),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_USE_MOCKS: process.env.NEXT_PUBLIC_USE_MOCKS,
  NEXT_PUBLIC_ROLE_SWITCHER: process.env.NEXT_PUBLIC_ROLE_SWITCHER,
  NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
});

if (!parsed.success) {
  throw new Error(`Invalid frontend env: ${z.prettifyError(parsed.error)}`);
}

export const env = {
  apiBaseUrl: parsed.data.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, ""),
  useMocks: parsed.data.NEXT_PUBLIC_USE_MOCKS,
  roleSwitcher: parsed.data.NEXT_PUBLIC_ROLE_SWITCHER,
  appVersion: parsed.data.NEXT_PUBLIC_APP_VERSION,
} as const;

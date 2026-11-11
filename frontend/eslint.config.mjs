import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-e2e/**", // test stack's next dev (e2e/test-stack.cjs)
    "out/**",
    "build/**",
    "next-env.d.ts",
    // shadcn generated code — added with `npx shadcn add`, not hand-edited
    "src/components/ui/**",
    "src/hooks/use-mobile.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;

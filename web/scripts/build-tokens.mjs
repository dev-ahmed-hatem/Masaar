/**
 * Generates src/app/tokens.css from src/design/tokens.ts.
 *
 *   npm run tokens
 *
 * tokens.ts is the single source of truth for the palette. This script emits
 * the :root / :root.dark custom-property blocks that globals.css imports, so
 * the CSS and the Ant Design theme in providers.tsx can never drift apart.
 *
 * Node 24 strips TypeScript types natively, so the .ts module imports directly.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { light, dark, radius, cssVarNames } from "../src/design/tokens.ts";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "src", "app", "tokens.css");

/** Emit the `--name: value;` lines for one palette, in cssVarNames order. */
function vars(palette, indent = "  ") {
  return Object.entries(cssVarNames)
    .map(([key, name]) => `${indent}${name}: ${palette[key]};`)
    .join("\n");
}

const radiusVars = Object.entries(radius)
  .map(([k, v]) => `  --r-${k}: ${typeof v === "number" ? `${v}px` : v};`)
  .join("\n");

const css = `/* ---------------------------------------------------------------------------
 * GENERATED FILE — do not edit by hand.
 * Source: src/design/tokens.ts   Regenerate: npm run tokens
 * ------------------------------------------------------------------------- */

:root {
  color-scheme: light;

${vars(light)}

${radiusVars}

  /* Tailwind bridge */
  --background: var(--bg);
  --foreground: var(--ink);
}

:root.dark {
  color-scheme: dark;

${vars(dark)}
}
`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, css, "utf8");
console.log(`tokens.css written (${css.length} bytes)`);

/**
 * i18n parity gate.
 *
 *   npm run i18n
 *
 * The `Dictionary` type is derived from en.json (src/i18n/dictionaries.ts), so
 * ar.json must have exactly the same key structure or Arabic pages render
 * `undefined` at runtime — which TypeScript cannot catch, because the dict is
 * loaded via a dynamic import and typed from the English file alone.
 *
 * Also flags Arabic values that are still identical to the English source,
 * which almost always means a key was added and never translated.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "..", "src", "i18n", "messages");
const en = JSON.parse(readFileSync(join(dir, "en.json"), "utf8"));
const ar = JSON.parse(readFileSync(join(dir, "ar.json"), "utf8"));

/** Flatten to "a.b.c" paths, recording arrays by length so shapes must match. */
function paths(node, prefix = "", out = new Map()) {
  if (Array.isArray(node)) {
    out.set(prefix, `array[${node.length}]`);
    node.forEach((v, i) => paths(v, `${prefix}[${i}]`, out));
  } else if (node && typeof node === "object") {
    out.set(prefix, "object");
    for (const [k, v] of Object.entries(node)) paths(v, prefix ? `${prefix}.${k}` : k, out);
  } else {
    out.set(prefix, typeof node);
  }
  return out;
}

const pe = paths(en);
const pa = paths(ar);

const missing = [...pe.keys()].filter((k) => !pa.has(k));
const extra = [...pa.keys()].filter((k) => !pe.has(k));
const mismatched = [...pe.keys()].filter((k) => pa.has(k) && pe.get(k) !== pa.get(k));

/** Leaf strings that are byte-identical in both files. */
const untranslated = [...pe.keys()].filter((k) => {
  if (pe.get(k) !== "string" || pa.get(k) !== "string") return false;
  const get = (o, p) =>
    p
      .replace(/\[(\d+)\]/g, ".$1")
      .split(".")
      .reduce((a, s) => (a == null ? a : a[s]), o);
  const a = get(en, k);
  const b = get(ar, k);
  // Brand names, URLs and pure punctuation are legitimately the same.
  if (!a || a.length < 3) return false;
  if (/^[\W\d_]+$/.test(a)) return false;
  if (/^(Wisal|Zoom|Google Meet|Microsoft Teams|WhatsApp|Softloom)$/i.test(a)) return false;
  return a === b;
});

let bad = 0;
const report = (label, list) => {
  if (!list.length) return;
  bad += list.length;
  console.log(`\n${label} (${list.length}):`);
  for (const k of list.slice(0, 40)) console.log(`  ${k}`);
  if (list.length > 40) console.log(`  ... and ${list.length - 40} more`);
};

report("MISSING in ar.json", missing);
report("EXTRA in ar.json (not in en)", extra);
report("TYPE/SHAPE mismatch", mismatched);

if (untranslated.length) {
  console.log(`\nWARNING — identical to English, likely untranslated (${untranslated.length}):`);
  for (const k of untranslated.slice(0, 30)) console.log(`  ${k}`);
  if (untranslated.length > 30) console.log(`  ... and ${untranslated.length - 30} more`);
}

console.log(
  bad === 0
    ? `\ni18n parity OK — ${pe.size} paths match.\n`
    : `\ni18n parity FAILED — ${bad} structural problem(s).\n`,
);
process.exit(bad === 0 ? 0 : 1);

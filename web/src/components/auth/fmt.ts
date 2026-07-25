/** Tiny placeholder interpolation: fmt("Resend in {s}s", { s: 30 }). */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}

export type AuthDict = Record<string, string>;

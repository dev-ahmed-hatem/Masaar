import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge needs to know about the semantic radius scale we added in
 * globals.css (`rounded-card`, `rounded-pill`, ...), otherwise it won't treat
 * `rounded-card` and `rounded-pill` as conflicting and both would survive.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      rounded: [
        {
          rounded: ["control", "card", "panel", "hero", "pill"],
        },
      ],
    },
  },
});

/**
 * Join class names, with later Tailwind utilities overriding earlier ones.
 *
 * The merge behaviour matters: `cva` variants and component `className` props
 * both emit utilities from the same groups, and a plain join would leave
 * `px-4 px-6` in the output with the winner decided by stylesheet order rather
 * than call order.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

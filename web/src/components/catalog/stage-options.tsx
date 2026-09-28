"use client";

import { Fragment } from "react";

import { catalogName, groupStages, type Stage } from "@/lib/catalog";
import { SelectGroup, SelectItem, SelectLabel } from "@/components/ui/select";

/**
 * The stage list as `<Select>` children, with a heading over each group.
 *
 * Every stage picker in the app renders the same thing — discovery, sign-up,
 * the student profile, the teacher's stage cards — so the grouping lives here
 * once rather than in four copies.
 */
export function StageOptions({ stages, locale }: { stages: Stage[]; locale: string }) {
  return (
    <>
      {groupStages(stages).map((section, i) => {
        const items = section.stages.map((s) => (
          <SelectItem key={s.id} value={String(s.id)}>
            {catalogName(s, locale)}
          </SelectItem>
        ));
        return section.group ? (
          <SelectGroup key={section.group.id}>
            <SelectLabel>{catalogName(section.group, locale)}</SelectLabel>
            {items}
          </SelectGroup>
        ) : (
          <Fragment key={`plain-${i}`}>{items}</Fragment>
        );
      })}
    </>
  );
}

/**
 * The same list shaped for antd's `options` prop, which takes nested
 * `{ label, options }` entries for groups. Used by the moderator screens.
 */
type StageOption = { value: number; label: string };
type StageOptionGroup = { label: string; options: StageOption[] };

export function stageSelectOptions(
  stages: Stage[],
  locale: string,
): (StageOption | StageOptionGroup)[] {
  const out: (StageOption | StageOptionGroup)[] = [];
  for (const section of groupStages(stages)) {
    const options = section.stages.map((s) => ({ value: s.id, label: catalogName(s, locale) }));
    if (section.group) out.push({ label: catalogName(section.group, locale), options });
    else out.push(...options);
  }
  return out;
}

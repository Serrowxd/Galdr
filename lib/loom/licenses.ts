import { ALLOWED_LICENSES, type License } from "@/lib/staveValidation";

export type LicenseOption = {
  value: License;
  label: string;
  tooltip: string;
};

/** The four licenses a scribe can attach to a stave. Shared by the Loom toolbar
 *  picker and the detail-page badge. The allowed set is the source of truth in
 *  lib/staveValidation; this only adds display copy. */
export const LICENSES: LicenseOption[] = [
  {
    value: "CC BY 4.0",
    label: "CC BY 4.0 — Attribution required",
    tooltip: "Others may reuse and adapt this stave as long as they credit you.",
  },
  {
    value: "CC0",
    label: "CC0 — Public domain",
    tooltip: "No rights reserved. Anyone may use this stave for any purpose.",
  },
  {
    value: "MIT",
    label: "MIT — Permissive software license",
    tooltip: "Permissive reuse with attribution and the MIT license text retained.",
  },
  {
    value: "ARR",
    label: "All Rights Reserved",
    tooltip: "You retain all rights. Others may view but not reuse without permission.",
  },
];

export const DEFAULT_LICENSE: License = "CC BY 4.0";

/** Narrows an arbitrary string to a known license, falling back to the default. */
export function toLicense(value: unknown): License {
  return ALLOWED_LICENSES.includes(value as License)
    ? (value as License)
    : DEFAULT_LICENSE;
}

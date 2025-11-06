export const FORM_TYPES = [
  "application",
  "disturbance-report",
  "financial-report",
  "project",
  "project-report",
  "site",
  "site-report",
  "nursery",
  "nursery-report",
  "srp-report"
] as const;
export type FormType = (typeof FORM_TYPES)[number];

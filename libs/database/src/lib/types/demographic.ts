import { Demographic } from "../entities";

export type DemographicType = (typeof Demographic.VALID_TYPES)[number];
export const DEMOGRAPHIC_ASSOCIATION_TYPES = [
  "organisations",
  "projectPitches",
  "projects",
  "projectReports",
  "siteReports"
] as const;
export type DemographicAssociationType = (typeof DEMOGRAPHIC_ASSOCIATION_TYPES)[number];

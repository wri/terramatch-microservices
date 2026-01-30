import { Tracking } from "../entities";

export type TrackingDomain = (typeof Tracking.DOMAINS)[number];
export type TrackingType = (typeof Tracking.VALID_TYPES)[number];

export type DemographicsType = (typeof Tracking.DEMOGRAPHICS_TYPES)[number];
export const DEMOGRAPHIC_ASSOCIATION_TYPES = [
  "organisations",
  "projectPitches",
  "projects",
  "projectReports",
  "siteReports"
] as const;
export type DemographicAssociationType = (typeof DEMOGRAPHIC_ASSOCIATION_TYPES)[number];

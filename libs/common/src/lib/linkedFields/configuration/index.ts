import { OrganisationConfiguration } from "./organisation.configuration";
import { FinancialReportConfiguration } from "./financial-report.configuration";
import { ProjectPitchConfiguration } from "./project-pitch.configuration";
import { ProjectConfiguration } from "./project.configuration";
import { ProjectReportConfiguration } from "./project-report.configuration";
import { SiteConfiguration } from "./site.configuration";
import { SiteReportConfiguration } from "./site-report.configuration";
import { NurseryConfiguration } from "./nursery.configuration";
import { NurseryReportConfiguration } from "./nursery-report.configuration";
import { LinkedFieldConfiguration } from "../types";
import { DisturbanceReportConfiguration } from "./disturbance-report.configuration";
import { SrpReportConfiguration } from "./srp-report.entity.configuration";

export const FORM_TYPES = [
  "organisation",
  "financialReport",
  "disturbanceReport",
  "nursery",
  "nurseryReport",
  "project",
  "projectPitch",
  "projectReport",
  "srpReport",
  "site",
  "siteReport"
] as const;
export type FormType = (typeof FORM_TYPES)[number];

export const LinkedFieldsConfiguration: Record<FormType, LinkedFieldConfiguration> = {
  srpReport: SrpReportConfiguration,
  organisation: OrganisationConfiguration,
  financialReport: FinancialReportConfiguration,
  disturbanceReport: DisturbanceReportConfiguration,
  nursery: NurseryConfiguration,
  nurseryReport: NurseryReportConfiguration,
  project: ProjectConfiguration,
  projectPitch: ProjectPitchConfiguration,
  projectReport: ProjectReportConfiguration,
  site: SiteConfiguration,
  siteReport: SiteReportConfiguration
} as const;

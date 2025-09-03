import { FinancialReport, Organisation, Project, ProjectPitch, ProjectReport, SiteReport } from "../entities";
import { DemographicAssociationType } from "../types/demographic";

export const LARAVEL_MODELS = {
  [Organisation.LARAVEL_TYPE]: Organisation,
  [Project.LARAVEL_TYPE]: Project,
  [ProjectPitch.LARAVEL_TYPE]: ProjectPitch,
  [ProjectReport.LARAVEL_TYPE]: ProjectReport,
  [SiteReport.LARAVEL_TYPE]: SiteReport,
  [FinancialReport.LARAVEL_TYPE]: FinancialReport
};

export const LARAVEL_MODEL_TYPES: Record<string, DemographicAssociationType> = {
  [Organisation.LARAVEL_TYPE]: "organisations",
  [Project.LARAVEL_TYPE]: "projects",
  [ProjectPitch.LARAVEL_TYPE]: "projectPitches",
  [ProjectReport.LARAVEL_TYPE]: "projectReports",
  [SiteReport.LARAVEL_TYPE]: "siteReports"
} as const;

import {
  DisturbanceReport,
  FinancialReport,
  Nursery,
  NurseryReport,
  Organisation,
  Project,
  ProjectPitch,
  ProjectReport,
  Site,
  SiteReport,
  SrpReport
} from "../entities";
import { DemographicAssociationType } from "../types/demographic";
import { Dictionary } from "lodash";
import { ModelCtor } from "sequelize-typescript";

export const LARAVEL_MODELS: Dictionary<ModelCtor> = {
  [DisturbanceReport.LARAVEL_TYPE]: DisturbanceReport,
  [FinancialReport.LARAVEL_TYPE]: FinancialReport,
  [Nursery.LARAVEL_TYPE]: Nursery,
  [NurseryReport.LARAVEL_TYPE]: NurseryReport,
  [Organisation.LARAVEL_TYPE]: Organisation,
  [Project.LARAVEL_TYPE]: Project,
  [ProjectPitch.LARAVEL_TYPE]: ProjectPitch,
  [ProjectReport.LARAVEL_TYPE]: ProjectReport,
  [Site.LARAVEL_TYPE]: Site,
  [SiteReport.LARAVEL_TYPE]: SiteReport,
  [SrpReport.LARAVEL_TYPE]: SrpReport
};

export const LARAVEL_MODEL_TYPES: Record<string, DemographicAssociationType> = {
  [Organisation.LARAVEL_TYPE]: "organisations",
  [Project.LARAVEL_TYPE]: "projects",
  [ProjectPitch.LARAVEL_TYPE]: "projectPitches",
  [ProjectReport.LARAVEL_TYPE]: "projectReports",
  [SiteReport.LARAVEL_TYPE]: "siteReports"
} as const;

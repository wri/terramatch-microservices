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
import { Dictionary } from "lodash";
import { ModelCtor } from "sequelize-typescript";
import { LaravelModel, UuidModel } from "../types/util";
import { FormModelType } from "./entities";

export const LARAVEL_MODELS: Dictionary<ModelCtor<UuidModel & LaravelModel>> = {
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

export const LARAVEL_MODEL_TYPES: Record<string, FormModelType> = {
  [FinancialReport.LARAVEL_TYPE]: "financialReports",
  [Nursery.LARAVEL_TYPE]: "nurseries",
  [NurseryReport.LARAVEL_TYPE]: "nurseryReports",
  [Organisation.LARAVEL_TYPE]: "organisations",
  [Project.LARAVEL_TYPE]: "projects",
  [ProjectPitch.LARAVEL_TYPE]: "projectPitches",
  [ProjectReport.LARAVEL_TYPE]: "projectReports",
  [Site.LARAVEL_TYPE]: "sites",
  [SiteReport.LARAVEL_TYPE]: "siteReports",
  [SrpReport.LARAVEL_TYPE]: "srpReports"
} as const;

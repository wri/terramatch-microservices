import { Organisation, Project, ProjectPitch, ProjectReport, SiteReport } from "../entities";

export const LARAVEL_MODELS = {
  [Organisation.LARAVEL_TYPE]: Organisation,
  [Project.LARAVEL_TYPE]: Project,
  [ProjectPitch.LARAVEL_TYPE]: ProjectPitch,
  [ProjectReport.LARAVEL_TYPE]: ProjectReport,
  [SiteReport.LARAVEL_TYPE]: SiteReport
};

export const LARAVEL_MODEL_TYPES = {
  [Organisation.LARAVEL_TYPE]: "organisation",
  [Project.LARAVEL_TYPE]: "project",
  [ProjectPitch.LARAVEL_TYPE]: "project-pitch",
  [ProjectReport.LARAVEL_TYPE]: "project-report",
  [SiteReport.LARAVEL_TYPE]: "site-report"
};

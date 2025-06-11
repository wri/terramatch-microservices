import { Organisation, Project, ProjectPitch, ProjectReport, SiteReport } from "../entities";

export const LARAVEL_MODELS = {
  [Organisation.LARAVEL_TYPE]: Organisation,
  [Project.LARAVEL_TYPE]: Project,
  [ProjectPitch.LARAVEL_TYPE]: ProjectPitch,
  [ProjectReport.LARAVEL_TYPE]: ProjectReport,
  [SiteReport.LARAVEL_TYPE]: SiteReport
};

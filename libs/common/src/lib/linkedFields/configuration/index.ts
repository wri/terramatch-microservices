import { OrganisationConfiguration } from "./organisation.configuration";
import { FinancialReportConfiguration } from "./financial-report.configuration";
import { ProjectPitchConfiguration } from "./project-pitch.configuration";
import { ProjectConfiguration } from "./project.configuration";
import { ProjectReportConfiguration } from "./project-report.configuration";

export const LinkedFieldsConfiguration = {
  organisation: OrganisationConfiguration,
  financialReport: FinancialReportConfiguration,
  project: ProjectConfiguration,
  projectPitch: ProjectPitchConfiguration,
  projectReport: ProjectReportConfiguration
} as const;

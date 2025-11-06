import { OrganisationConfiguration } from "./organisation.configuration";
import { FinancialReportConfiguration } from "./financial-report.configuration";
import { ProjectPitchConfiguration } from "./project-pitch.configuration";
import { ProjectConfiguration } from "./project.configuration";
import { ProjectReportConfiguration } from "./project-report.configuration";
import { SiteConfiguration } from "./site.configuration";
import { SiteReportConfiguration } from "./site-report.configuration";
import { NurseryConfiguration } from "./nursery.configuration";
import { NurseryReportConfiguration } from "./nursery-report.configuration";
import {
  LinkedField,
  LinkedFieldConfiguration,
  LinkedFile,
  LinkedRelation
} from "@terramatch-microservices/database/constants/linked-fields";
import { DisturbanceReportConfiguration } from "./disturbance-report.configuration";
import { SrpReportConfiguration } from "./srp-report.entity.configuration";

export const FORM_MODEL_TYPES = [
  "organisations",
  "financialReports",
  "disturbanceReports",
  "nurseries",
  "nurseryReports",
  "projects",
  "projectPitches",
  "projectReports",
  "sites",
  "siteReports",
  "srpReport"
] as const;
export type FormModelType = (typeof FORM_MODEL_TYPES)[number];

export const LinkedFieldsConfiguration: Record<FormModelType, LinkedFieldConfiguration> = {
  organisations: OrganisationConfiguration,
  financialReports: FinancialReportConfiguration,
  disturbanceReports: DisturbanceReportConfiguration,
  nurseries: NurseryConfiguration,
  nurseryReports: NurseryReportConfiguration,
  projects: ProjectConfiguration,
  projectPitches: ProjectPitchConfiguration,
  projectReports: ProjectReportConfiguration,
  sites: SiteConfiguration,
  siteReports: SiteReportConfiguration,
  srpReport: SrpReportConfiguration
} as const;

type LinkedFieldSpecification = {
  model: FormModelType;
  field: LinkedField | LinkedFile | LinkedRelation;
};

// Memoize all linked field configurations by linked field key to make getLinkedFieldConfig (which
// is used heavily in form work) faster.
const LINKED_FIELDS = new Map<string, LinkedFieldSpecification>(
  Object.entries(LinkedFieldsConfiguration).flatMap(([model, config]) => [
    ...Object.entries(config.fields).map(
      ([key, field]) => [key, { field, model }] as [string, LinkedFieldSpecification]
    ),
    ...Object.entries(config.relations).map(
      ([key, field]) => [key, { field, model }] as [string, LinkedFieldSpecification]
    ),
    ...Object.entries(config.fileCollections).map(
      ([key, field]) => [key, { field, model }] as [string, LinkedFieldSpecification]
    )
  ])
);

export const getLinkedFieldConfig = (linkedFieldKey: string) => LINKED_FIELDS.get(linkedFieldKey);

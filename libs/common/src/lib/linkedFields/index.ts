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
  isField,
  isFile,
  isPropertyField,
  LinkedField,
  LinkedFile,
  LinkedRelation
} from "@terramatch-microservices/database/constants/linked-fields";
import { DisturbanceReportConfiguration } from "./disturbance-report.configuration";
import { SrpReportConfiguration } from "./srp-report.configuration";
import { FormModelType } from "@terramatch-microservices/database/constants/entities";

export const LinkedFieldsConfiguration = {
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
  srpReports: SrpReportConfiguration
} as const;

export type LinkedFieldSpecification = {
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

export const getExportHeading = (config: LinkedFieldSpecification | undefined) => {
  if (config == null) return "unknown";

  const { field } = config;
  if (isField(field)) {
    return isPropertyField(field) ? field.property : field.exportHeading;
  } else if (isFile(field)) {
    return field.collection;
  } else {
    return field.exportHeading;
  }
};

export type ModelAttribute = { model: FormModelType; attribute: string };
export const getModelAttribute = (config: LinkedFieldSpecification | undefined): ModelAttribute | undefined => {
  if (config == null) return undefined;

  const { field } = config;
  return isField(field) && isPropertyField(field) ? { model: config.model, attribute: field.property } : undefined;
};

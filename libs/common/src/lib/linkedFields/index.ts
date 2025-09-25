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

export const FORM_MODEL_TYPES = [
  "organisation",
  "financialReport",
  "nursery",
  "nurseryReport",
  "project",
  "projectPitch",
  "projectReport",
  "site",
  "siteReport"
] as const;
export type FormModelType = (typeof FORM_MODEL_TYPES)[number];

export const LinkedFieldsConfiguration: Record<FormModelType, LinkedFieldConfiguration> = {
  organisation: OrganisationConfiguration,
  financialReport: FinancialReportConfiguration,
  nursery: NurseryConfiguration,
  nurseryReport: NurseryReportConfiguration,
  project: ProjectConfiguration,
  projectPitch: ProjectPitchConfiguration,
  projectReport: ProjectReportConfiguration,
  site: SiteConfiguration,
  siteReport: SiteReportConfiguration
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

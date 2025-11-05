import { ModelCtor } from "sequelize-typescript";
import { ModelStatic } from "sequelize";
import {
  AuditStatus,
  FinancialIndicator,
  Form,
  FormQuestionOption,
  FundingProgramme,
  ImpactStory,
  Nursery,
  NurseryReport,
  Organisation,
  Project,
  ProjectPitch,
  ProjectReport,
  Site,
  SiteReport
} from "../entities";

export const MEDIA_OWNER_TYPES = [
  "projects",
  "sites",
  "nurseries",
  "projectReports",
  "siteReports",
  "nurseryReports",
  "organisations",
  "auditStatuses",
  "forms",
  "formQuestionOptions",
  "fundingProgrammes",
  "impactStories",
  "financialIndicators",
  "projectPitches"
] as const;

export type MediaOwnerType = (typeof MEDIA_OWNER_TYPES)[number];
export type MediaOwnerModel =
  | Project
  | Site
  | Nursery
  | ProjectReport
  | SiteReport
  | NurseryReport
  | Organisation
  | AuditStatus
  | Form
  | FormQuestionOption
  | FundingProgramme
  | ImpactStory
  | FinancialIndicator
  | ProjectPitch;

export const VALIDATION_KEYS = [
  "logo-image",
  "thumbnail",
  "cover-image",
  "cover-image-with-svg",
  "photos",
  "pdf",
  "documents",
  "general-documents",
  "spreadsheet"
] as const;

export type ValidationKey = (typeof VALIDATION_KEYS)[number];

export type MediaConfiguration = {
  dbCollection?: string;
  multiple: boolean;
  validation: ValidationKey;
};
export type EntityMediaOwnerClass<T extends MediaOwnerModel> = ModelCtor<T> &
  ModelStatic<T> & { LARAVEL_TYPE: string } & { MEDIA: Record<string, MediaConfiguration> };

export const MEDIA_OWNER_MODELS: { [E in MediaOwnerType]: EntityMediaOwnerClass<MediaOwnerModel> } = {
  projects: Project,
  sites: Site,
  nurseries: Nursery,
  projectReports: ProjectReport,
  siteReports: SiteReport,
  nurseryReports: NurseryReport,
  organisations: Organisation,
  auditStatuses: AuditStatus,
  forms: Form,
  formQuestionOptions: FormQuestionOption,
  fundingProgrammes: FundingProgramme,
  impactStories: ImpactStory,
  financialIndicators: FinancialIndicator,
  projectPitches: ProjectPitch
} as const;

export const MEDIA_OWNER_MODEL_LARAVEL_TYPES: Record<string, EntityMediaOwnerClass<MediaOwnerModel>> = {
  [Project.LARAVEL_TYPE]: Project,
  [Site.LARAVEL_TYPE]: Site,
  [Nursery.LARAVEL_TYPE]: Nursery,
  [ProjectReport.LARAVEL_TYPE]: ProjectReport,
  [SiteReport.LARAVEL_TYPE]: SiteReport,
  [NurseryReport.LARAVEL_TYPE]: NurseryReport,
  [Organisation.LARAVEL_TYPE]: Organisation,
  [AuditStatus.LARAVEL_TYPE]: AuditStatus,
  [Form.LARAVEL_TYPE]: Form,
  [FormQuestionOption.LARAVEL_TYPE]: FormQuestionOption,
  [FundingProgramme.LARAVEL_TYPE]: FundingProgramme,
  [ImpactStory.LARAVEL_TYPE]: ImpactStory,
  [FinancialIndicator.LARAVEL_TYPE]: FinancialIndicator,
  [ProjectPitch.LARAVEL_TYPE]: ProjectPitch
} as const;

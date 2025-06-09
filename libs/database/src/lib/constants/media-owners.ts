import { ModelCtor } from "sequelize-typescript";
import { ModelStatic } from "sequelize";
import { Project } from "../entities/project.entity";
import { Site } from "../entities/site.entity";
import { Nursery } from "../entities/nursery.entity";
import { ProjectReport } from "../entities/project-report.entity";
import { SiteReport } from "../entities/site-report.entity";
import { NurseryReport } from "../entities/nursery-report.entity";
import { Organisation } from "../entities/organisation.entity";
import { AuditStatus } from "../entities/audit-status.entity";
import { FormQuestionOption } from "../entities/form-question-option.entity";
import { Form } from "../entities/form.entity";
import { FundingProgramme } from "../entities/funding-programme.entity";
import { ImpactStory } from "../entities/impact-story.entity";
import { FinancialIndicator } from "../entities/financial-indicator.entity";

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
  "financialIndicators"
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
  | FinancialIndicator;
export type EntityMediaOwnerClass<T extends MediaOwnerModel> = ModelCtor<T> & ModelStatic<T> & { LARAVEL_TYPE: string };

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
  financialIndicators: FinancialIndicator
} as const;

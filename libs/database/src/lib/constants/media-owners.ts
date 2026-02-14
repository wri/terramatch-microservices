import { ModelCtor } from "sequelize-typescript";
import { ModelStatic } from "sequelize";
import {
  AuditStatus,
  DisturbanceReport,
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
import { Dictionary } from "lodash";
import { isNotNull } from "../types/array";

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
  "projectPitches",
  "disturbanceReports"
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
  | ProjectPitch
  | DisturbanceReport;

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

export const MIME_TYPE_ABBREVIATIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/heif": "heif",
  "image/heic": "heic",
  "image/svg+xml": "svg",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/pdf": "pdf",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-word": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "video/mp4": "mp4"
} as const;
export const MIME_TYPES = Object.entries(MIME_TYPE_ABBREVIATIONS).reduce(
  (types, [type, abbreviation]) => ({ ...types, [abbreviation]: type as MimeType }),
  {} as Dictionary<MimeType>
);
export type MimeType = keyof typeof MIME_TYPE_ABBREVIATIONS;

// Media owners que deben contarse en la Project Gallery (All Images / Sources)
export const PROJECT_GALLERY_MEDIA_OWNER_TYPES = [
  "projects",
  "sites",
  "nurseries",
  "projectReports",
  "siteReports",
  "nurseryReports"
] as const satisfies readonly MediaOwnerType[];

export type ProjectGalleryMediaOwnerType = (typeof PROJECT_GALLERY_MEDIA_OWNER_TYPES)[number];

export const isProjectGalleryMediaOwner = (type: MediaOwnerType | undefined): type is ProjectGalleryMediaOwnerType =>
  type != null && PROJECT_GALLERY_MEDIA_OWNER_TYPES.includes(type as ProjectGalleryMediaOwnerType);

export const FILE_VALIDATION: {
  VALIDATION_RULES: Record<ValidationKey, string>;
  VALIDATION_FILE_TYPES: Record<ValidationKey, "media" | "documents">;
} = {
  VALIDATION_RULES: {
    "logo-image": "mimes:jpg,png",
    "cover-image": "mimes:jpg,png",
    "cover-image-with-svg": "mimes:jpg,png,svg,heic,heif",
    photos: "mimes:jpg,png,mp4,heic,heif",
    pdf: "mimes:pdf",
    documents: "mimes:pdf,xls,xlsx,csv,txt,doc,docx,bin",
    "general-documents": "mimes:pdf,xls,xlsx,csv,txt,png,jpg,doc,mp4,docx,bin,heic,heif|size:5MB",
    spreadsheet: "mimes:pdf,xls,xlsx,csv,txt|size:5MB",
    thumbnail: "mimes:jpg,png"
  },
  VALIDATION_FILE_TYPES: {
    "logo-image": "media",
    thumbnail: "media",
    "cover-image": "media",
    "cover-image-with-svg": "media",
    photos: "media",
    pdf: "media",
    documents: "documents",
    "general-documents": "documents",
    spreadsheet: "documents"
  }
};

export type MediaConfiguration = {
  dbCollection: string;
  multiple: boolean;
  validation: ValidationKey;
};
export type EntityMediaOwnerClass<T extends MediaOwnerModel> = ModelCtor<T> &
  ModelStatic<T> & { LARAVEL_TYPE: string } & { MEDIA: Dictionary<MediaConfiguration> };

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
  projectPitches: ProjectPitch,
  disturbanceReports: DisturbanceReport
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
  [ProjectPitch.LARAVEL_TYPE]: ProjectPitch,
  [DisturbanceReport.LARAVEL_TYPE]: DisturbanceReport
} as const;

export const abbreviatedValidationMimeTypes = (validation: ValidationKey) => {
  const rules = FILE_VALIDATION.VALIDATION_RULES[validation];
  const mimeValidation = rules.split("|").find(rule => rule.startsWith("mimes:"));
  return mimeValidation?.split(":")[1].split(",");
};

export const sizeValidation = (validation: ValidationKey) => {
  const rules = FILE_VALIDATION.VALIDATION_RULES[validation];
  const sizeValidation = rules.split("|").find(rule => rule.startsWith("size:"));
  return sizeValidation?.split(":")[1];
};

export const isMediaOwner = (type: string): type is MediaOwnerType =>
  MEDIA_OWNER_TYPES.includes(type as MediaOwnerType);

/** Resolves media owner's short type (e.g. "sites") from Laravel modelType for DTO. */
export const entityTypeFromLaravel = (laravelType: string): MediaOwnerType | undefined => {
  const entry = Object.entries(MEDIA_OWNER_MODELS).find(
    ([, modelClass]) => (modelClass as { LARAVEL_TYPE: string }).LARAVEL_TYPE === laravelType
  );
  return entry?.[0] as MediaOwnerType | undefined;
};

export const mediaConfiguration = (mediaOwner: MediaOwnerType, collection: string) =>
  Object.values(MEDIA_OWNER_MODELS[mediaOwner]?.MEDIA ?? {}).find(({ dbCollection }) => dbCollection === collection);

export const acceptMimeTypes = (mediaOwner: MediaOwnerType, collection: string): MimeType[] | undefined => {
  const configuration = mediaConfiguration(mediaOwner, collection);
  const abbreviatedTypes = configuration == null ? undefined : abbreviatedValidationMimeTypes(configuration.validation);
  return abbreviatedTypes?.map(type => MIME_TYPES[type]).filter(isNotNull);
};

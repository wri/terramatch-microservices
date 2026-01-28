import { Dictionary } from "lodash";
import { Attributes } from "sequelize";
import { FormModel } from "./entities";
import { TrackingType } from "../types/tracking";

export type LinkedFieldConfiguration<M extends FormModel> = {
  label: string;
  fields: Dictionary<LinkedField<M>>;
  fileCollections: Dictionary<LinkedFile>;
  relations: Dictionary<LinkedRelation>;
};

export const FIELD_INPUT_TYPES = [
  "boolean",
  "date",
  "long-text",
  "mapInput",
  "number",
  "number-percentage",
  "radio",
  "select",
  "select-image",
  "strategy-area",
  "text",
  "url"
] as const;
export type FieldInputType = (typeof FIELD_INPUT_TYPES)[number];

export type VirtualDemographicsAggregate = {
  type: "demographicsAggregate";
  demographicsType: TrackingType;
  collection: string;
};
export type VirtualDemographicsDescription = {
  type: "demographicsDescription";
  demographicsType: TrackingType;
  collections: string[];
};
export type VirtualProjectBoundary = {
  type: "projectBoundary";
};
export type VirtualLinkedFieldProps =
  | VirtualDemographicsAggregate
  | VirtualDemographicsDescription
  | VirtualProjectBoundary;
export type VirtualLinkedField = {
  virtual: VirtualLinkedFieldProps;
  label: string;
  inputType: FieldInputType;
  multiChoice?: boolean;
  optionListKey?: string;
};
export type PropertyLinkedField<M extends FormModel> = Omit<VirtualLinkedField, "virtual"> & {
  virtual?: never;
  property: keyof Attributes<M>;
};
export type LinkedField<M extends FormModel = FormModel> = VirtualLinkedField | PropertyLinkedField<M>;

export const FILE_INPUT_TYPES = ["file"] as const;
export type FileInputType = (typeof FILE_INPUT_TYPES)[number];

export type LinkedFile = Omit<LinkedField, "optionListKey" | "inputType" | "property"> & {
  collection: string;
  inputType: FileInputType;
};

export const RELATION_INPUT_TYPES = [
  "allBeneficiaries",
  "associates",
  "disturbanceReportEntries",
  "disturbances",
  "employees",
  "financialIndicators",
  "fundingType",
  "indirectBeneficiaries",
  "invasive",
  "jobs",
  "leaderships",
  "ownershipStake",
  "restorationPartners",
  "seedings",
  "stratas",
  "trainingBeneficiaries",
  "treeSpecies",
  "volunteers",
  "workdays"
] as const;
export type RelationInputType = (typeof RELATION_INPUT_TYPES)[number];

export type LinkedRelation = Omit<LinkedField, "optionListKey" | "inputType" | "multichoice" | "property"> & {
  inputType: RelationInputType;
  resource: LinkedFieldResource;
  collection?: string;
};

export const LINKED_FIELD_RESOURCES = [
  "demographics",
  "disturbances",
  "disturbanceReportEntries",
  "financialIndicators",
  "fundingTypes",
  "invasives",
  "leaderships",
  "ownershipStake",
  "seedings",
  "stratas",
  "treeSpecies"
] as const;
export type LinkedFieldResource = (typeof LINKED_FIELD_RESOURCES)[number];

// tableInput and conditional are not supported in linked fields, but are valid form question input types.
export const INPUT_TYPES = [
  ...FIELD_INPUT_TYPES,
  ...FILE_INPUT_TYPES,
  ...RELATION_INPUT_TYPES,
  "conditional",
  "tableInput"
] as const;
export type InputType = (typeof INPUT_TYPES)[number];

export const isField = (field: LinkedField | LinkedFile | LinkedRelation): field is LinkedField =>
  FIELD_INPUT_TYPES.includes(field.inputType as FieldInputType);
export const isPropertyField = (field: LinkedField): field is PropertyLinkedField<FormModel> =>
  (field as PropertyLinkedField<FormModel>).property != null;
export const isFile = (field: LinkedField | LinkedFile | LinkedRelation): field is LinkedFile =>
  FILE_INPUT_TYPES.includes(field.inputType as FileInputType);
export const isRelation = (field: LinkedField | LinkedFile | LinkedRelation): field is LinkedRelation =>
  RELATION_INPUT_TYPES.includes(field.inputType as RelationInputType);

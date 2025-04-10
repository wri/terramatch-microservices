import { States } from "../util/model-column-state-machine";
import { Nursery, Project } from "../entities";
import { Model } from "sequelize-typescript";
import { DatabaseModule } from "../database.module";

export const STARTED = "started";
export const AWAITING_APPROVAL = "awaiting-approval";
export const APPROVED = "approved";
export const RESTORATION_IN_PROGRESS = "restoration-in-progress";
export const NEEDS_MORE_INFORMATION = "needs-more-information";
export const ENTITY_STATUSES = [STARTED, AWAITING_APPROVAL, APPROVED, NEEDS_MORE_INFORMATION] as const;
export type EntityStatus = (typeof ENTITY_STATUSES)[number];

const emitStatusUpdateHook = (from: string, model: Model) => {
  DatabaseModule.emitModelEvent("statusUpdated", model);
};

export const EntityStatusStates: States<Project | Nursery, EntityStatus> = {
  default: STARTED,

  transitions: {
    [STARTED]: [AWAITING_APPROVAL],
    [AWAITING_APPROVAL]: [APPROVED, NEEDS_MORE_INFORMATION],
    [NEEDS_MORE_INFORMATION]: [APPROVED, AWAITING_APPROVAL],
    [APPROVED]: [NEEDS_MORE_INFORMATION]
  },

  afterTransitionHooks: {
    [APPROVED]: emitStatusUpdateHook,
    [AWAITING_APPROVAL]: emitStatusUpdateHook,
    [NEEDS_MORE_INFORMATION]: emitStatusUpdateHook
  }
};

export const SITE_STATUSES = [...ENTITY_STATUSES, RESTORATION_IN_PROGRESS] as const;
export type SiteStatus = (typeof SITE_STATUSES)[number];

export const DUE = "due";
export const REPORT_STATUSES = [DUE, ...ENTITY_STATUSES] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const COMPLETE_REPORT_STATUSES = [APPROVED, AWAITING_APPROVAL] as const;

export const DRAFT = "draft";
export const NO_UPDATE = "no-update";
export const UPDATE_REQUEST_STATUSES = [NO_UPDATE, DRAFT, AWAITING_APPROVAL, APPROVED, NEEDS_MORE_INFORMATION] as const;
export type UpdateRequestStatus = (typeof UPDATE_REQUEST_STATUSES)[number];

export const REJECTED = "rejected";
export const REQUIRES_MORE_INFORMATION = "requires-more-information";
export const FORM_SUBMISSION_STATUSES = [
  APPROVED,
  AWAITING_APPROVAL,
  REJECTED,
  REQUIRES_MORE_INFORMATION,
  STARTED
] as const;
export type FormSubmissionStatus = (typeof FORM_SUBMISSION_STATUSES)[number];

export const PENDING = "pending";
export const ORGANISATION_STATUSES = [APPROVED, PENDING, REJECTED, DRAFT] as const;
export type OrganisationStatus = (typeof ORGANISATION_STATUSES)[number];

type AllStatuses =
  | EntityStatus
  | SiteStatus
  | ReportStatus
  | UpdateRequestStatus
  | FormSubmissionStatus
  | OrganisationStatus;

/**
 * A mapping of all statuses to an English language display string for that status.
 *
 * Note: Please do not send this value to the client directly. The client should be responsible
 * for managing (and translating) these display strings itself. This is used to support some legacy
 * systems (like Actions) that require a display string for a status to be embedded in the DB.
 *
 * Ideally we fix up and remove those needs over time, and eventually git rid of this structure from
 * BE code.
 */
export const STATUS_DISPLAY_STRINGS: Record<AllStatuses, string> = {
  [DRAFT]: "Draft",
  [DUE]: "Due",
  [PENDING]: "Pending",
  [STARTED]: "Started",
  [AWAITING_APPROVAL]: "Awaiting approval",
  [NEEDS_MORE_INFORMATION]: "Needs more information",
  [APPROVED]: "Approved",
  [RESTORATION_IN_PROGRESS]: "Restoration in progress",
  [REJECTED]: "Rejected",
  [NO_UPDATE]: "No update",
  [REQUIRES_MORE_INFORMATION]: "Requires more information"
};

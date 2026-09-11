import { States, transitions } from "../util/model-column-state-machine";
import {
  DelayedJob,
  DisturbanceReport,
  FormSubmission,
  Nursery,
  Project,
  ProjectReport,
  Site,
  Task,
  UpdateRequest
} from "../entities";
import { Model } from "sequelize-typescript";
import { DatabaseModule } from "../database.module";
import { ReportModel } from "./entities";

export const DRAFT = "draft";
export const PENDING_APPROVAL = "pending-approval";
export const APPROVED = "approved";
export const INFORMATION_REQUIRED = "information-required";
export const MODIFIED = "modified";
export const ENTITY_STATUSES = [DRAFT, PENDING_APPROVAL, APPROVED, INFORMATION_REQUIRED] as const;
export const PLANTING_STATUSES = [
  "no-restoration-expected",
  "not-started",
  "in-progress",
  "replacement-planting",
  "completed"
] as const;
export type EntityStatus = (typeof ENTITY_STATUSES)[number];
export type PlantingStatus = (typeof PLANTING_STATUSES)[number];

export const statusUpdateSequelizeHook = async (model: Model) => {
  // Processed in event.service.ts in the common lib
  await DatabaseModule.emitModelEvent("statusUpdated", model);
};

const emitStatusUpdateHook = (from: string, model: Model) => statusUpdateSequelizeHook(model);

export const EntityStatusStates: States<Project | Site | Nursery | DisturbanceReport, EntityStatus> = {
  default: DRAFT,

  transitions: transitions()
    .from(DRAFT, () => [PENDING_APPROVAL])
    .from(PENDING_APPROVAL, () => [APPROVED, INFORMATION_REQUIRED])
    .from(INFORMATION_REQUIRED, () => [APPROVED, PENDING_APPROVAL])
    .from(APPROVED, () => [INFORMATION_REQUIRED]).transitions,

  afterTransitionHooks: {
    [APPROVED]: emitStatusUpdateHook,
    [PENDING_APPROVAL]: emitStatusUpdateHook,
    [INFORMATION_REQUIRED]: emitStatusUpdateHook
  }
};

export const DUE = "due";
export const REPORT_STATUSES = [DUE, ...ENTITY_STATUSES] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const ReportStatusStates: States<ReportModel, ReportStatus> = {
  ...(EntityStatusStates as unknown as States<ReportModel, ReportStatus>),

  default: DUE,

  transitions: transitions<ReportStatus>(EntityStatusStates.transitions)
    .from(DUE, () => [DRAFT, PENDING_APPROVAL])
    // reports can go from pending approval to draft in the nothing_to_report case (see validation below)
    .from(PENDING_APPROVAL, to => [...to, DRAFT]).transitions,

  transitionValidForModel: (from: ReportStatus, to: ReportStatus, report: ReportModel) => {
    if ((from === DUE && to === PENDING_APPROVAL) || (from === PENDING_APPROVAL && to === DRAFT)) {
      // these two transitions are only allowed for site / nursery reports when the nothingToReport flag is true;
      return !(report instanceof ProjectReport) && report.nothingToReport === true;
    }

    return true;
  }
};

export const COMPLETE_REPORT_STATUSES = [APPROVED, PENDING_APPROVAL] as const;
export type CompleteReportStatus = (typeof COMPLETE_REPORT_STATUSES)[number];

export const TASK_STATUSES = [DUE, INFORMATION_REQUIRED, PENDING_APPROVAL, APPROVED] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TaskStatusStates: States<Task, TaskStatus> = {
  default: DUE,

  transitions: transitions<TaskStatus>()
    .from(DUE, () => [PENDING_APPROVAL])
    .from(PENDING_APPROVAL, () => [INFORMATION_REQUIRED, APPROVED])
    .from(INFORMATION_REQUIRED, () => [PENDING_APPROVAL, APPROVED])
    .from(APPROVED, () => [PENDING_APPROVAL, INFORMATION_REQUIRED]).transitions
};

export const NO_UPDATE = "no-update";
/** Active update-request statuses. Absence of a change request is represented as NULL (not no-update). */
export const UPDATE_REQUEST_STATUSES = [DRAFT, PENDING_APPROVAL, APPROVED, INFORMATION_REQUIRED] as const;
export type UpdateRequestStatus = (typeof UPDATE_REQUEST_STATUSES)[number];
/** @deprecated Prefer NULL on entity update_request_status; kept for legacy comparisons during migration. */
export type UpdateRequestStatusOrLegacyNoUpdate = UpdateRequestStatus | typeof NO_UPDATE;

export const UpdateRequestStatusStates: States<UpdateRequest, UpdateRequestStatus> = {
  default: DRAFT,

  transitions: transitions<UpdateRequestStatus>()
    .from(DRAFT, () => [PENDING_APPROVAL])
    .from(PENDING_APPROVAL, () => [APPROVED, INFORMATION_REQUIRED])
    .from(INFORMATION_REQUIRED, () => [APPROVED, PENDING_APPROVAL]).transitions,

  afterTransitionHooks: {
    [APPROVED]: emitStatusUpdateHook,
    [PENDING_APPROVAL]: emitStatusUpdateHook,
    [INFORMATION_REQUIRED]: emitStatusUpdateHook
  }
};

export const REJECTED = "rejected";
export const FORM_SUBMISSION_STATUSES = [APPROVED, PENDING_APPROVAL, REJECTED, INFORMATION_REQUIRED, DRAFT] as const;
export type FormSubmissionStatus = (typeof FORM_SUBMISSION_STATUSES)[number];

export const FormSubmissionStatusStates: States<FormSubmission, FormSubmissionStatus> = {
  default: DRAFT,

  transitions: transitions<FormSubmissionStatus>()
    .from(DRAFT, () => [PENDING_APPROVAL])
    .from(INFORMATION_REQUIRED, () => [PENDING_APPROVAL])
    .from(PENDING_APPROVAL, () => [APPROVED, INFORMATION_REQUIRED, REJECTED]).transitions,

  afterTransitionHooks: {
    [APPROVED]: emitStatusUpdateHook,
    [PENDING_APPROVAL]: emitStatusUpdateHook,
    [INFORMATION_REQUIRED]: emitStatusUpdateHook,
    [REJECTED]: emitStatusUpdateHook
  }
};

export const PENDING = "pending";
export const ORGANISATION_STATUSES = [APPROVED, PENDING_APPROVAL, REJECTED, DRAFT] as const;
export type OrganisationStatus = (typeof ORGANISATION_STATUSES)[number];

export type AnyStatus = EntityStatus | ReportStatus | UpdateRequestStatus | FormSubmissionStatus | OrganisationStatus;

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
export const STATUS_DISPLAY_STRINGS: Record<AnyStatus, string> = {
  [DRAFT]: "Draft",
  [DUE]: "Due",
  [PENDING_APPROVAL]: "Pending Approval",
  [INFORMATION_REQUIRED]: "Information Required",
  [APPROVED]: "Approved",
  [REJECTED]: "Rejected"
};

export const FAILED = "failed";
export const SUCCEEDED = "succeeded";
export const DELAYED_JOB_STATUSES = [PENDING, FAILED, SUCCEEDED] as const;
export type DelayedJobStatus = (typeof DELAYED_JOB_STATUSES)[number];

export const DelayedJobStatusStates: States<DelayedJob, DelayedJobStatus> = {
  default: PENDING,
  transitions: transitions<DelayedJobStatus>().from(PENDING, () => [FAILED, SUCCEEDED]).transitions
};

export const INACTIVE = "inactive";
export const ACTIVE = "active";
export const DISABLED = "disabled";
export const COMING_SOON = "coming-soon";
export const FUNDING_PROGRAMME_STATUSES = [INACTIVE, ACTIVE, DISABLED, COMING_SOON] as const;
export type FundingProgrammeStatus = (typeof FUNDING_PROGRAMME_STATUSES)[number];

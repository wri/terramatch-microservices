import { States, transitions } from "../util/model-column-state-machine";
import { DelayedJob, FormSubmission, Nursery, Project, ProjectReport, Site, Task, UpdateRequest } from "../entities";
import { Model } from "sequelize-typescript";
import { DatabaseModule } from "../database.module";
import { ReportModel } from "./entities";

export const STARTED = "started";
export const AWAITING_APPROVAL = "awaiting-approval";
export const APPROVED = "approved";
export const NEEDS_MORE_INFORMATION = "needs-more-information";
export const MODIFIED = "modified";
export const ENTITY_STATUSES = [STARTED, AWAITING_APPROVAL, APPROVED, NEEDS_MORE_INFORMATION] as const;
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

export const EntityStatusStates: States<Project | Site | Nursery, EntityStatus> = {
  default: STARTED,

  transitions: transitions()
    .from(STARTED, () => [AWAITING_APPROVAL])
    .from(AWAITING_APPROVAL, () => [APPROVED, NEEDS_MORE_INFORMATION])
    .from(NEEDS_MORE_INFORMATION, () => [APPROVED, AWAITING_APPROVAL])
    .from(APPROVED, () => [NEEDS_MORE_INFORMATION]).transitions,

  afterTransitionHooks: {
    [APPROVED]: emitStatusUpdateHook,
    [AWAITING_APPROVAL]: emitStatusUpdateHook,
    [NEEDS_MORE_INFORMATION]: emitStatusUpdateHook
  }
};

export const DUE = "due";
export const REPORT_STATUSES = [DUE, ...ENTITY_STATUSES] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const ReportStatusStates: States<ReportModel, ReportStatus> = {
  ...(EntityStatusStates as unknown as States<ReportModel, ReportStatus>),

  default: DUE,

  transitions: transitions<ReportStatus>(EntityStatusStates.transitions)
    .from(DUE, () => [STARTED, AWAITING_APPROVAL])
    // reports can go from awaiting approval to started in the nothing_to_report case (see validation below)
    .from(AWAITING_APPROVAL, to => [...to, STARTED]).transitions,

  transitionValidForModel: (from: ReportStatus, to: ReportStatus, report: ReportModel) => {
    if ((from === DUE && to === AWAITING_APPROVAL) || (from === AWAITING_APPROVAL && to === STARTED)) {
      // these two transitions are only allowed for site / nursery reports when the nothingToReport flag is true;
      return !(report instanceof ProjectReport) && report.nothingToReport === true;
    }

    return true;
  }
};

export const COMPLETE_REPORT_STATUSES = [APPROVED, AWAITING_APPROVAL] as const;
export type CompleteReportStatus = (typeof COMPLETE_REPORT_STATUSES)[number];

export const TASK_STATUSES = [DUE, NEEDS_MORE_INFORMATION, AWAITING_APPROVAL, APPROVED] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TaskStatusStates: States<Task, TaskStatus> = {
  default: DUE,

  transitions: transitions<TaskStatus>()
    .from(DUE, () => [AWAITING_APPROVAL])
    .from(AWAITING_APPROVAL, () => [NEEDS_MORE_INFORMATION, APPROVED])
    .from(NEEDS_MORE_INFORMATION, () => [AWAITING_APPROVAL, APPROVED])
    .from(APPROVED, () => [AWAITING_APPROVAL, NEEDS_MORE_INFORMATION]).transitions
};

export const DRAFT = "draft";
export const NO_UPDATE = "no-update";
export const UPDATE_REQUEST_STATUSES = [NO_UPDATE, DRAFT, AWAITING_APPROVAL, APPROVED, NEEDS_MORE_INFORMATION] as const;
export type UpdateRequestStatus = (typeof UPDATE_REQUEST_STATUSES)[number];

export const UpdateRequestStatusStates: States<UpdateRequest, UpdateRequestStatus> = {
  default: DRAFT,

  transitions: transitions<UpdateRequestStatus>()
    .from(DRAFT, () => [AWAITING_APPROVAL])
    .from(AWAITING_APPROVAL, () => [APPROVED, NEEDS_MORE_INFORMATION])
    .from(NEEDS_MORE_INFORMATION, () => [APPROVED, AWAITING_APPROVAL]).transitions,

  afterTransitionHooks: {
    [APPROVED]: emitStatusUpdateHook,
    [AWAITING_APPROVAL]: emitStatusUpdateHook,
    [NEEDS_MORE_INFORMATION]: emitStatusUpdateHook
  }
};

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

export const FormSubmissionStatusStates: States<FormSubmission, FormSubmissionStatus> = {
  default: STARTED,

  transitions: transitions<FormSubmissionStatus>()
    .from(STARTED, () => [AWAITING_APPROVAL])
    .from(REQUIRES_MORE_INFORMATION, () => [AWAITING_APPROVAL])
    .from(AWAITING_APPROVAL, () => [APPROVED, REQUIRES_MORE_INFORMATION, REJECTED]).transitions,

  afterTransitionHooks: {
    [APPROVED]: emitStatusUpdateHook,
    [AWAITING_APPROVAL]: emitStatusUpdateHook,
    [REQUIRES_MORE_INFORMATION]: emitStatusUpdateHook,
    [REJECTED]: emitStatusUpdateHook
  }
};

export const PENDING = "pending";
export const ORGANISATION_STATUSES = [APPROVED, PENDING, REJECTED, DRAFT] as const;
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
  [PENDING]: "Pending",
  [STARTED]: "Started",
  [AWAITING_APPROVAL]: "Awaiting approval",
  [NEEDS_MORE_INFORMATION]: "Needs more information",
  [APPROVED]: "Approved",
  [REJECTED]: "Rejected",
  [NO_UPDATE]: "No update",
  [REQUIRES_MORE_INFORMATION]: "Requires more information"
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
export const FUNDING_PROGRAMME_STATUSES = [INACTIVE, ACTIVE, DISABLED] as const;
export type FundingProgrammeStatus = (typeof FUNDING_PROGRAMME_STATUSES)[number];

import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { UserContext } from "@terramatch-microservices/common/contexts/user.context";
import { getService } from "@terramatch-microservices/common/util/bootstrap-repl";
import { ENTITY_MODELS, EntityModel, EntityType } from "@terramatch-microservices/database/constants/entities";
import {
  APPROVED,
  DRAFT,
  INFORMATION_REQUIRED,
  PENDING_APPROVAL
} from "@terramatch-microservices/database/constants/status";
import { FinancialReport, Form, UpdateRequest } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import { FormDataService } from "../../entities/form-data.service";

type Summary = {
  combinations: Record<string, number>;
  merged: number;
  statusMoved: number;
  cleared: number;
  failed: number;
};

type Failure = { entityType: string; id: number; uuid: string; error: string };

// A change request submitted for review moves the entity to pending-approval, as if the champion had
// submitted the entity itself. These are the only main statuses that can legally make that move.
const SUBMITTABLE_STATUSES: string[] = [DRAFT, INFORMATION_REQUIRED];

/**
 * An update status only exists on approved entities. For every entity that is not approved but still has
 * one, merges the current change request content into the entity, moves the entity to pending-approval
 * when the change request was pending-approval, sets the update status back to null and removes the
 * change request.
 *
 * Status and update status are written directly (no status events), because these entities were already
 * under review or in the champion's hands when the change request was created.
 *
 * An entity is left untouched when its change request content cannot be merged, and is reported in
 * `failures`.
 *
 * Run in entity-service REPL:
 *   await oneOff.migrateNonApprovedUpdateStatuses()
 *   await oneOff.migrateNonApprovedUpdateStatuses({ dryRun: false })
 *
 * Safe to re-run.
 */
export const migrateNonApprovedUpdateStatuses = withoutSqlLogs(async (options?: { dryRun?: boolean }) => {
  const dryRun = options?.dryRun !== false;
  const formDataService = getService(FormDataService);
  const summary: Record<string, Summary> = {};
  const failures: Failure[] = [];

  for (const [entityType, modelClass] of Object.entries(ENTITY_MODELS) as [
    EntityType,
    typeof ENTITY_MODELS.projects
  ][]) {
    const entities = await modelClass.findAll({
      where: { status: { [Op.ne]: APPROVED }, updateRequestStatus: { [Op.ne]: null } },
      attributes: ["id"]
    });

    const entitySummary: Summary = { combinations: {}, merged: 0, statusMoved: 0, cleared: 0, failed: 0 };
    summary[entityType] = entitySummary;

    for (const { id } of entities) {
      // Reload with the full attributes the merge needs; the filter above only selects ids.
      const entity = await modelClass.findOne({ where: { id } });
      if (entity == null) continue;

      const combination = `${entity.status} / ${entity.updateRequestStatus}`;
      entitySummary.combinations[combination] = (entitySummary.combinations[combination] ?? 0) + 1;
      if (dryRun) continue;

      try {
        await migrateEntity(formDataService, modelClass, entity, entitySummary);
      } catch (error) {
        entitySummary.failed++;
        failures.push({
          entityType,
          id,
          uuid: entity.uuid,
          error: error instanceof Error ? error.message : `${error}`
        });
      }
    }
  }

  console.log(JSON.stringify({ dryRun, summary, failures }, null, 2));
  return { dryRun, summary, failures };
});

const migrateEntity = async (
  formDataService: FormDataService,
  modelClass: typeof ENTITY_MODELS.projects,
  entity: EntityModel,
  summary: Summary
) => {
  const updateRequest = await UpdateRequest.for(entity).current().findOne();

  if (updateRequest?.content != null) {
    const form = await Form.for(entity).findOne();
    if (form == null) throw new Error("Form not found for entity");

    // The form lookup for financial reports needs the organisation type.
    if (entity instanceof FinancialReport) {
      entity.organisation = await entity.$get("organisation", { attributes: ["type"] });
    }

    const { content } = updateRequest;
    await asUpdateRequestAuthor(entity, updateRequest, () =>
      formDataService.updateModelFromForm(entity, form, content, {}, { preserveReportStatus: true })
    );
    summary.merged++;
  }

  const moveToPendingApproval =
    updateRequest?.status === PENDING_APPROVAL && SUBMITTABLE_STATUSES.includes(entity.status);
  await modelClass.update(
    { updateRequestStatus: null, ...(moveToPendingApproval ? { status: PENDING_APPROVAL } : {}) },
    { where: { id: entity.id }, hooks: false }
  );
  await updateRequest?.destroy();

  if (moveToPendingApproval) summary.statusMoved++;
  summary.cleared++;
};

/**
 * Runs the merge with the change request author as the current user. The framework permission makes the
 * merge behave like an admin edit, so it does not reassign the report creator.
 */
const asUpdateRequestAuthor = (entity: EntityModel, updateRequest: UpdateRequest, work: () => Promise<void>) =>
  new Promise<void>((resolve, reject) => {
    UserContext.use(updateRequest.createdById ?? 0, [`framework-${entity.frameworkKey ?? ""}`], "en-US", () => {
      work().then(resolve, reject);
    });
  });

import { NurseryReport, Project, ProjectReport, Task, TreeSpecies } from "@terramatch-microservices/database/entities";
import { AirtableEntity } from "./airtable-entity";
import { groupBy, uniq } from "lodash";
import { associatedValueColumn, commonEntityColumns, treeAmountRollup, treeDescriptionRollup } from "../util/columns";
import { ColumnMapping } from "../util/types";
import { isNotNull } from "@terramatch-microservices/database/types/array";

type ProjectReportAssociations = {
  projectUuid?: string;
  taskUuid?: string;
  associatedNurseryReports: NurseryReport[];
  trees: TreeSpecies[];
  nurserySeedlingAmount: number | null;
  nurserySeedlingNameAndAmount: string;
};

const COLUMNS: ColumnMapping<ProjectReport, ProjectReportAssociations>[] = [
  ...commonEntityColumns<ProjectReport, ProjectReportAssociations>("projectReport"),
  associatedValueColumn("projectUuid", "projectId"),
  associatedValueColumn("taskUuid", "taskId"),
  "status",
  "updateRequestStatus",
  "dueAt",
  "landscapeCommunityContribution",
  "topThreeSuccesses",
  "challengesFaced",
  "lessonsLearned",
  "maintenanceAndMonitoringActivities",
  "significantChange",
  "pctSurvivalToDate",
  "survivalCalculation",
  "survivalComparison",
  "newJobsDescription",
  "volunteersWorkDescription",
  "beneficiariesDescription",
  "beneficiariesIncomeIncrease",
  "beneficiariesIncomeIncreaseDescription",
  "beneficiariesSkillsKnowledgeIncreaseDescription",
  "sharedDriveLink",
  "communityProgress",
  "localEngagementDescription",
  "equitableOpportunities",
  "indirectBeneficiaries",
  "indirectBeneficiariesDescription",
  "resilienceProgress",
  "localGovernance",
  "adaptiveManagement",
  "scalabilityReplicability",
  "convergenceJobsDescription",
  "convergenceSchemes",
  "convergenceAmount",
  "beneficiariesScstobc",
  "beneficiariesScstobcFarmers",
  "communityPartnersAssetsDescription",
  "peopleKnowledgeSkillsIncreased",
  {
    airtableColumn: "totalSeedlingsGrown",
    dbColumn: ["frameworkKey", "taskId"],
    valueMap: async ({ frameworkKey }, { trees, associatedNurseryReports }) =>
      frameworkKey === "ppc"
        ? trees.reduce((total, { amount }) => total + (amount ?? 0), 0)
        : frameworkKey === "terrafund"
          ? associatedNurseryReports.reduce((total, { seedlingsYoungTrees }) => total + (seedlingsYoungTrees ?? 0), 0)
          : 0
  },
  "technicalNarrative",
  "publicNarrative",
  "totalUniqueRestorationPartners",
  "businessMilestones",
  "plantingStatus",
  {
    airtableColumn: "workdaysPaidSelfReported",
    dbColumn: "workdaysPaid",
    valueMap: async ({ workdaysPaid }) => workdaysPaid
  },
  {
    airtableColumn: "workdaysVolunteerSelfReported",
    dbColumn: "workdaysVolunteer",
    valueMap: async ({ workdaysVolunteer }) => workdaysVolunteer
  },
  "elpDescription",
  associatedValueColumn("nurserySeedlingAmount"),
  associatedValueColumn("nurserySeedlingNameAndAmount"),
  "bioeconomyProductList",
  "bioeconomyProductBenefit",
  "bioeconomyProductSold",
  "bioeconomyQualityCertifications",
  "bioeconomyBuyers",
  "bioeconomyOtherCertifications",
  "womenGovernance"
];

export class ProjectReportEntity extends AirtableEntity<ProjectReport, ProjectReportAssociations> {
  readonly TABLE_NAME = "Project Reports";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = ProjectReport;
  // If this gets flipped to true, UPDATED_ASSOCIATIONS for tree species will be required.
  readonly SUPPORTS_UPDATED_SINCE = false;

  protected async loadAssociations(projectReports: ProjectReport[]) {
    const projectIds = uniq(projectReports.map(({ projectId }) => projectId));
    const projects = await Project.findAll({
      where: { id: projectIds },
      attributes: ["id", "uuid"]
    });
    const taskIds = uniq(projectReports.map(({ taskId }) => taskId)).filter(isNotNull);
    const tasks = await Task.findAll({ where: { id: taskIds }, attributes: ["id", "uuid"] });
    const nurseryReportsByTaskId = groupBy(
      await NurseryReport.findAll({
        where: { taskId: taskIds, status: NurseryReport.APPROVED_STATUSES },
        attributes: ["id", "taskId", "seedlingsYoungTrees"]
      }),
      "taskId"
    );
    const treesByReportId = groupBy(await TreeSpecies.visible().for(projectReports).findAll(), "speciesableId");

    return projectReports.reduce(
      (associations, { id, projectId, taskId }) => ({
        ...associations,
        [id]: {
          projectUuid: projects.find(({ id }) => id === projectId)?.uuid,
          taskUuid: tasks.find(({ id }) => id === taskId)?.uuid,
          associatedNurseryReports: (taskId == null ? null : nurseryReportsByTaskId[taskId]) ?? [],
          trees: treesByReportId[id] ?? [],
          nurserySeedlingAmount: treeAmountRollup(treesByReportId[id], "nursery-seedling"),
          nurserySeedlingNameAndAmount: treeDescriptionRollup(treesByReportId[id], "nursery-seedling")
        }
      }),
      {} as Record<number, ProjectReportAssociations>
    );
  }
}

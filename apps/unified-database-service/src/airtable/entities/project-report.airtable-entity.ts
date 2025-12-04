import { NurseryReport, Project, ProjectReport, TreeSpecies } from "@terramatch-microservices/database/entities";
import { AirtableEntity, associatedValueColumn, ColumnMapping, commonEntityColumns } from "./airtable-entity";
import { filter, groupBy, uniq } from "lodash";

type ProjectReportAssociations = {
  projectUuid?: string;
  associatedNurseryReports: NurseryReport[];
  trees: TreeSpecies[];
};

const COLUMNS: ColumnMapping<ProjectReport, ProjectReportAssociations>[] = [
  ...commonEntityColumns<ProjectReport, ProjectReportAssociations>("projectReport"),
  associatedValueColumn("projectUuid", "projectId"),
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
  "plantingStatus"
];

export class ProjectReportEntity extends AirtableEntity<ProjectReport, ProjectReportAssociations> {
  readonly TABLE_NAME = "Project Reports";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = ProjectReport;
  readonly SUPPORTS_UPDATED_SINCE = false;

  protected async loadAssociations(projectReports: ProjectReport[]) {
    const reportIds = projectReports.map(({ id }) => id);
    const projectIds = uniq(projectReports.map(({ projectId }) => projectId));
    const projects = await Project.findAll({
      where: { id: projectIds },
      attributes: ["id", "uuid"]
    });
    const taskIds = filter(projectReports.map(({ taskId }) => taskId)) as number[];
    const nurseryReportsByTaskId = groupBy(
      await NurseryReport.findAll({
        where: { taskId: taskIds, status: NurseryReport.APPROVED_STATUSES },
        attributes: ["id", "taskId", "seedlingsYoungTrees"]
      }),
      "taskId"
    );
    const treesByReportId = groupBy(
      await TreeSpecies.findAll({
        where: { speciesableType: ProjectReport.LARAVEL_TYPE, speciesableId: reportIds, hidden: false },
        attributes: ["id", "speciesableId", "amount"]
      }),
      "speciesableId"
    );

    return projectReports.reduce(
      (associations, { id, projectId, taskId }) => ({
        ...associations,
        [id]: {
          projectUuid: projects.find(({ id }) => id === projectId)?.uuid,
          associatedNurseryReports: (taskId == null ? null : nurseryReportsByTaskId[taskId]) ?? [],
          trees: treesByReportId[id] ?? []
        }
      }),
      {} as Record<number, ProjectReportAssociations>
    );
  }
}

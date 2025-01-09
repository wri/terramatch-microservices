import { Project, ProjectReport } from "@terramatch-microservices/database/entities";
import { AirtableEntity, associatedValueColumn, ColumnMapping, commonEntityColumns } from "./airtable-entity";

type ProjectReportAssociations = {
  projectUuid?: string;
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
  "ftWomen",
  "ftTotal",
  "ftNonYouth",
  "ftYouth",
  "ftMen",
  "ptWomen",
  "ptMen",
  "ptYouth",
  "ptNonYouth",
  "ptTotal",
  "volunteerWomen",
  "volunteerTotal",
  "volunteerNonYouth",
  "volunteerYouth",
  "volunteerMen",
  "volunteersWorkDescription",
  "beneficiaries",
  "beneficiariesDescription",
  "beneficiariesWomen",
  "beneficiariesLargeScale",
  "beneficiariesSmallholder",
  "beneficiariesNonYouth",
  "beneficiariesYouth",
  "beneficiariesMen",
  "beneficiariesIncomeIncrease",
  "beneficiariesIncomeIncreaseDescription",
  "beneficiariesSkillsKnowledgeIncrease",
  "beneficiariesSkillsKnowledgeIncreaseDescription",
  "sharedDriveLink",
  "communityProgress",
  "localEngagementDescription",
  "equitableOpportunities",
  "indirectBeneficiaries",
  "indirectBeneficiariesDescription"
];

export class ProjectReportEntity extends AirtableEntity<ProjectReport, ProjectReportAssociations> {
  readonly TABLE_NAME = "Project Reports";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = ProjectReport;

  protected async loadAssociations(projectReports: ProjectReport[]) {
    const projectIds = projectReports.map(({ projectId }) => projectId);
    const projects = await Project.findAll({
      where: { id: projectIds },
      attributes: ["id", "uuid"]
    });

    return projectReports.reduce(
      (associations, { id, projectId }) => ({
        ...associations,
        [id]: {
          projectUuid: projects.find(({ id }) => id === projectId)?.uuid
        }
      }),
      {} as Record<number, ProjectReportAssociations>
    );
  }
}

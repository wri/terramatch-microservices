import { RunnableMigration } from "umzug";
import { Attributes, ModelAttributeColumnOptions, QueryInterface } from "sequelize";
import { ProjectReport, SiteReport } from "../entities";

export const NULLABLE_COLUMNS = {
  projectReports: [
    "resilienceProgress",
    "localGovernance",
    "adaptiveManagement",
    "scalabilityReplicability",
    "convergenceJobsDescription",
    "convergenceSchemes",
    "convergenceAmount",
    "communityPartnersAssetsDescription",
    "volunteerScstobc",
    "beneficiariesScstobcFarmers",
    "beneficiariesScstobc",
    "totalUniqueRestorationPartners"
  ],
  siteReports: [
    "invasiveSpeciesRemoved",
    "invasiveSpeciesManagement",
    "soilWaterRestorationDescription",
    "waterStructures",
    "siteCommunityPartnersDescription",
    "siteCommunityPartnersIncomeIncreaseDescription"
  ]
};

export const makeAssortedColumnsNullable: RunnableMigration<QueryInterface> = {
  name: "202605041703-make-assorted-columns-nullable",

  async up({ context }) {
    const projectReportAttributes = ProjectReport.getAttributes();
    for (const column of NULLABLE_COLUMNS.projectReports) {
      const { type, field } = projectReportAttributes[
        column as keyof Attributes<ProjectReport>
      ] as ModelAttributeColumnOptions;
      await context.changeColumn("v2_project_reports", field as string, { type, allowNull: true });
    }

    const siteReportAttributes = SiteReport.getAttributes();
    for (const column of NULLABLE_COLUMNS.siteReports) {
      const { type, field } = siteReportAttributes[
        column as keyof Attributes<SiteReport>
      ] as ModelAttributeColumnOptions;
      await context.changeColumn("v2_site_reports", field as string, { type, allowNull: true });
    }
  },

  async down({ context }) {
    const projectReportAttributes = ProjectReport.getAttributes();
    for (const column of NULLABLE_COLUMNS.projectReports) {
      const { type, field } = projectReportAttributes[
        column as keyof Attributes<ProjectReport>
      ] as ModelAttributeColumnOptions;
      await context.changeColumn("v2_project_reports", field as string, { type, allowNull: false });
    }

    const siteReportAttributes = SiteReport.getAttributes();
    for (const column of NULLABLE_COLUMNS.siteReports) {
      const { type, field } = siteReportAttributes[
        column as keyof Attributes<SiteReport>
      ] as ModelAttributeColumnOptions;
      await context.changeColumn("v2_site_reports", field as string, { type, allowNull: false });
    }
  }
};

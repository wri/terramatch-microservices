import { AirtableEntity, ColumnMapping, commonEntityColumns } from "./airtable-entity";
import { Application, FormSubmission } from "@terramatch-microservices/database/entities";
import { groupBy, orderBy } from "lodash";

const loadFormSubmissions = async (applicationIds: number[]) =>
  groupBy(
    await FormSubmission.findAll({
      where: { applicationId: applicationIds },
      attributes: ["applicationId", "id", "status"]
    }),
    "applicationId"
  );

type ApplicationAssociations = {
  formSubmissions: FormSubmission[];
};

const COLUMNS: ColumnMapping<Application, ApplicationAssociations>[] = [
  ...commonEntityColumns<Application, ApplicationAssociations>("application"),
  "organisationUuid",
  "fundingProgrammeUuid",
  {
    airtableColumn: "status",
    valueMap: async (_, { formSubmissions }) => orderBy(formSubmissions, ["id"], ["desc"])[0]?.status
  }
];

export class ApplicationEntity extends AirtableEntity<Application, ApplicationAssociations> {
  readonly TABLE_NAME = "Applications";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = Application;
  readonly SUPPORTS_UPDATED_SINCE = false;

  protected async loadAssociations(applications: Application[]) {
    const applicationIds = applications.map(({ id }) => id);
    const formSubmissions = await loadFormSubmissions(applicationIds);

    return applications.reduce(
      (associations, { id }) => ({
        ...associations,
        [id]: {
          formSubmissions: formSubmissions[id] ?? []
        }
      }),
      {} as Record<number, ApplicationAssociations>
    );
  }
}

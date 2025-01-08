import { AirtableEntity, associationReducer, ColumnMapping } from "./airtable-entity";
import { Application, FormSubmission, FundingProgramme } from "@terramatch-microservices/database/entities";
import { orderBy, uniq } from "lodash";

const loadFormSubmissions = async (applicationIds: number[]) =>
  (
    await FormSubmission.findAll({
      where: { applicationId: applicationIds },
      attributes: ["applicationId", "status"]
    })
  ).reduce(associationReducer<FormSubmission>("applicationId"), {});

type ApplicationAssociations = {
  fundingProgrammeName?: string;
  formSubmissions: FormSubmission[];
};

const COLUMNS: ColumnMapping<Application, ApplicationAssociations>[] = [
  "uuid",
  "createdAt",
  "updatedAt",
  "organisationUuid",
  {
    airtableColumn: "fundingProgrammeName",
    dbColumn: "fundingProgrammeUuid",
    valueMap: async (_, { fundingProgrammeName }) => fundingProgrammeName
  },
  {
    airtableColumn: "status",
    valueMap: async (_, { formSubmissions }) => orderBy(formSubmissions, ["id"], ["desc"])[0]?.status
  }
];

export class ApplicationEntity extends AirtableEntity<Application, ApplicationAssociations> {
  readonly TABLE_NAME = "Applications";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = Application;

  protected async loadAssociations(applications: Application[]) {
    const applicationIds = applications.map(({ id }) => id);
    const fundingProgrammeUuids = uniq(applications.map(({ fundingProgrammeUuid }) => fundingProgrammeUuid));
    const fundingProgrammes = await FundingProgramme.findAll({
      where: { uuid: fundingProgrammeUuids },
      attributes: ["uuid", "name"]
    });
    const formSubmissions = await loadFormSubmissions(applicationIds);

    return applications.reduce(
      (associations, { id, fundingProgrammeUuid }) => ({
        ...associations,
        [id]: {
          fundingProgrammeName: fundingProgrammes.find(({ uuid }) => uuid === fundingProgrammeUuid)?.name,
          formSubmissions: formSubmissions[id] ?? []
        }
      }),
      {} as Record<number, ApplicationAssociations>
    );
  }
}

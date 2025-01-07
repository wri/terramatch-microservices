import { AirtableEntity, ColumnMapping } from "./airtable-entity";
import { Organisation } from "@terramatch-microservices/database/entities";
import { FindOptions } from "sequelize";

type OrganisationAssociations = Record<string, never>;

const COLUMNS: ColumnMapping<Organisation, OrganisationAssociations>[] = ["uuid"];

export class OrganisationEntity extends AirtableEntity<Organisation, OrganisationAssociations> {
  readonly TABLE_NAME = "Organisations";
  readonly COLUMNS = COLUMNS;

  protected findAll = (whereOptions: FindOptions<Organisation>) => Organisation.findAll(whereOptions);

  async loadAssociations(organisations: Organisation[]) {
    const organisationIds = organisations.map(({ id }) => id);

    return organisationIds.reduce((associations, organisationId) => {
      return {
        ...associations,
        [organisationId]: {}
      };
    }, {} as Record<number, OrganisationAssociations>);
  }
}

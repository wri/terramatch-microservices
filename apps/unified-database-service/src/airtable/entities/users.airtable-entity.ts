/* istanbul ignore file */

import { AirtableEntity } from "./airtable-entity";
import { User } from "@terramatch-microservices/database/entities";
import { UuidModel } from "@terramatch-microservices/database/types/util";
import { ModelCtor } from "sequelize-typescript";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { associatedValueColumn, commonEntityColumns } from "../util/columns";
import { ColumnMapping } from "../util/types";

// There _are_ some columns with uuid null in the prod DB. However, they have all been deleted,
// so for this processor, we can ignore them.
type UserWithUuid = User & UuidModel;

type UserAssociations = {
  primaryOrganisationUuid?: string;
  frameworks?: string[];
  projectUuids?: string[];
};

const COLUMNS: ColumnMapping<UserWithUuid, UserAssociations>[] = [
  ...commonEntityColumns<UserWithUuid, UserAssociations>("user"),
  "emailAddressVerifiedAt",
  "roles",
  "jobRole",
  "firstName",
  "lastName",
  "emailAddress",
  "phoneNumber",
  associatedValueColumn("primaryOrganisationUuid", "organisationId"),
  associatedValueColumn("frameworks"),
  associatedValueColumn("projectUuids")
];

export class UserEntity extends AirtableEntity<UserWithUuid, UserAssociations> {
  readonly TABLE_NAME = "Users";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = User as ModelCtor<UserWithUuid>;
  readonly SUPPORTS_UPDATED_SINCE = false;

  async loadAssociations(users: UserWithUuid[]) {
    // unfortunately, these associations are complicated enough that we just have to N+1 it and
    // run the queries for each user individually.
    const associations: Record<number, UserAssociations> = {};
    await Promise.all(
      users.map(async user => {
        associations[user.id] = {
          primaryOrganisationUuid: (await user.loadOrganisation())?.uuid,
          frameworks: (await user.myFrameworks()).map(({ slug }) => slug).filter(isNotNull),
          projectUuids: (await user.$get("projects", { attributes: ["uuid"] })).map(({ uuid }) => uuid)
        };
      })
    );
    return associations;
  }
}

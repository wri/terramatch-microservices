import { Model } from "sequelize-typescript";

export type AirtableEntity<T extends Model<T>> = {
  TABLE_NAME: string;
  UUID_COLUMN: string;
  mapDbEntity: (entity: T) => Promise<object>;
  findOne: (uuid: string) => Promise<T>;
};

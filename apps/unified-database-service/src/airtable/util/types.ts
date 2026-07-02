import { Model, ModelCtor, ModelType } from "sequelize-typescript";
import { Attributes, ModelStatic } from "sequelize";

export type AirtableValue = null | undefined | string | number | boolean | Date | string[];

export type FilterFlag = {
  attribute: string;
  // The condition that should hide a given row in this table.
  hideCondition: boolean;
};

export type UpdateAssociation<M extends Model, JoinModel extends Model> = {
  model: ModelStatic<JoinModel>;
  on: [keyof Attributes<M>, keyof Attributes<JoinModel>];
  scope?: Partial<{ [key in keyof Attributes<JoinModel>]: string }>;
};

export type Include = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model?: ModelType<any, any>;
  association?: string;
  attributes?: string[];
};

/**
 * A ColumnMapping is either a string (airtableColumn and dbColumn are the same), or a more descriptive object
 */
export type ColumnMapping<T extends Model, A = Record<string, never>> =
  | keyof Attributes<T>
  | {
      airtableColumn: string;
      // Include if this mapping should include a particular DB column in the DB query
      dbColumn?: keyof Attributes<T> | (keyof Attributes<T>)[];
      // Include if this mapping should eager load an association on the DB query
      include?: Include[];
      valueMap: (entity: T, associations: A) => Promise<AirtableValue>;
    };

export type PolymorphicUuidAssociation<AssociationType> = {
  model: ModelCtor;
  association: keyof AssociationType;
};

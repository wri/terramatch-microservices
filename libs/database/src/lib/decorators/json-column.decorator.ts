import { Column, Model } from "sequelize-typescript";
import { Attributes, JSON as JSON_TYPE, ModelAttributeColumnOptions } from "sequelize";

type JsonColumnOptions = Partial<ModelAttributeColumnOptions> & {
  emptyArrayAsObject?: boolean;
};

/**
 * Sequelize has a bug where when the data for this model is fetched as part of an include on
 * findAll, the JSON value isn't getting deserialized. This decorator should be used for all
 * columns that should deserialize text to JSON instead of @Column(JSON)
 */
export const JsonColumn =
  <T extends Model>(options: JsonColumnOptions = {}) =>
  (target: unknown, propertyName: string, propertyDescriptor?: PropertyDescriptor) => {
    const { emptyArrayAsObject, ...restOptions } = options;
    return Column({
      ...restOptions,

      type: JSON_TYPE,
      get(this: T): object {
        let value = this.getDataValue(propertyName as keyof Attributes<T>);
        if (typeof value === "string") value = JSON.parse(value);
        if (emptyArrayAsObject && Array.isArray(value) && value.length === 0) value = {};
        return value as object;
      }
    })(target, propertyName, propertyDescriptor);
  };

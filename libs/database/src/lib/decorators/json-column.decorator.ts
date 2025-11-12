import { Column, Model } from "sequelize-typescript";
import { Attributes, JSON as JSON_TYPE, ModelAttributeColumnOptions } from "sequelize";

/**
 * Sequelize has a bug where when the data for this model is fetched as part of an include on
 * findAll, the JSON value isn't getting deserialized. This decorator should be used for all
 * columns that should deserialize text to JSON instead of @Column(JSON)
 */
export const JsonColumn =
  <T extends Model>(options: Partial<ModelAttributeColumnOptions> = {}) =>
  (target: unknown, propertyName: string, propertyDescriptor?: PropertyDescriptor) =>
    Column({
      ...options,

      type: JSON_TYPE,
      get(this: T): object {
        const value = this.getDataValue(propertyName as keyof Attributes<T>);
        return typeof value === "string" ? JSON.parse(value) : (value as object);
      }
    })(target, propertyName, propertyDescriptor);

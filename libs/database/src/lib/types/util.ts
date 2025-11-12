import { Model, ModelCtor } from "sequelize-typescript";
import { Attributes } from "sequelize";

export type UuidModel = Model & { uuid: string };
export type CollectionModel = Model & { collection: string | null };
export type StatusModel = Model & { status: string };
export type FeedbackModel = Model & { feedback?: string | null; feedbackFields?: string[] | null };
export type StatusUpdateModel = UuidModel & LaravelModel & StatusModel & FeedbackModel;

export type LaravelModelCtor = ModelCtor & { LARAVEL_TYPE: string };
export type LaravelModel = InstanceType<LaravelModelCtor>;
export const laravelType = (model: LaravelModel) => (model.constructor as LaravelModelCtor).LARAVEL_TYPE;

export type PolymorphicModelCtor<M extends Model = Model> = ModelCtor<M> & {
  POLYMORPHIC_TYPE: keyof Attributes<M>;
  POLYMORPHIC_ID: keyof Attributes<M>;
};
export type PolymorphicModel<M extends Model = Model> = InstanceType<PolymorphicModelCtor<M>>;
export const polymorphicAttributes = <M extends Model>(model: PolymorphicModel<M> | PolymorphicModelCtor<M>) => {
  const { POLYMORPHIC_TYPE, POLYMORPHIC_ID } =
    model instanceof Model ? (model.constructor as PolymorphicModelCtor<M>) : model;
  return { typeAttribute: POLYMORPHIC_TYPE, idAttribute: POLYMORPHIC_ID };
};

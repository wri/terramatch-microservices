import { Model, ModelCtor } from "sequelize-typescript";
import { Attributes } from "sequelize";
import { FormModel } from "../constants/entities";
import { isFunction } from "lodash";

export type UuidModel = Model & { uuid: string };
export type StatusModel = Model & { status: string };
export type FeedbackModel = Model & { feedback?: string | null; feedbackFields?: string[] | null };
export type StatusUpdateModel = UuidModel & LaravelModel & StatusModel & FeedbackModel;

export type CollectionModelCtor<M extends Model = Model> = ModelCtor<M> & {
  // Scope function
  collection(collection: string): CollectionModelCtor<M>;
};
export type CollectionModel = Model & { collection: string | null };
export const isCollectionModelCtor = (ctor: ModelCtor): ctor is CollectionModelCtor =>
  isFunction((ctor as CollectionModelCtor).collection);
export const isCollectionModel = (model: Model): model is CollectionModel =>
  Object.keys((model.constructor as ModelCtor).getAttributes()).includes("collection");

export type LaravelModelCtor = ModelCtor & { LARAVEL_TYPE: string };
export type LaravelModel = InstanceType<LaravelModelCtor>;
export const laravelType = (model: LaravelModel) => (model.constructor as LaravelModelCtor).LARAVEL_TYPE;

export type PolymorphicModelCtor<M extends Model = Model> = ModelCtor<M> & {
  POLYMORPHIC_TYPE: keyof Attributes<M>;
  POLYMORPHIC_ID: keyof Attributes<M>;

  // Scope function
  for(entity: FormModel): PolymorphicModelCtor<M>;
};
export type PolymorphicModel<M extends Model = Model> = InstanceType<PolymorphicModelCtor<M>>;
export const polymorphicAttributes = <M extends Model>(model: PolymorphicModel<M> | PolymorphicModelCtor<M>) => {
  const { POLYMORPHIC_TYPE, POLYMORPHIC_ID } =
    model instanceof Model ? (model.constructor as PolymorphicModelCtor<M>) : model;
  return { typeAttribute: POLYMORPHIC_TYPE, idAttribute: POLYMORPHIC_ID };
};

import { Model, ModelCtor } from "sequelize-typescript";

export type UuidModel = Model & { uuid: string };

export type LaravelModelCtor = ModelCtor & { LARAVEL_TYPE: string };
export type LaravelModel = InstanceType<LaravelModelCtor>;

export const laravelType = (model: LaravelModel) => (model.constructor as LaravelModelCtor).LARAVEL_TYPE;

export type StatusModel = Model & { status: string };

export type FeedbackModel = Model & { feedback?: string | null; feedbackFields?: string[] | null };

import { Model, ModelCtor } from "sequelize-typescript";

export type UuidModel = Model & { uuid: string };

export type LaravelModelCtor = ModelCtor & { LARAVEL_TYPE: string };
export type LaravelModel = InstanceType<LaravelModelCtor>;

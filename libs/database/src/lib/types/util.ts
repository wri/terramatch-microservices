import { Model } from "sequelize-typescript";

export type UuidModel<T> = Model<T> & { uuid: string };

import { Model } from "sequelize";
import { DocumentBuilder, ResourceBuilder } from "../util";
import { NotFoundException } from "@nestjs/common";

export const modelOrNotFound = <T extends Model>(model: T | null | undefined) => {
  if (model == null) throw new NotFoundException();
  return model;
};

export type ModelSerializer<T extends Model = Model> = {
  findByUuid(uuid: string): Promise<T>;
  findById(id: number): Promise<T>;
  findForUser(userId: number): Promise<T[]>;
  createDocument(): DocumentBuilder;
  addDto(document: DocumentBuilder, model: T): Promise<ResourceBuilder>;
  addDtos(document: DocumentBuilder, models: T[]): Promise<DocumentBuilder>;
};

import { Media, Project } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { ProjectFactory } from "./project.factory";
import { faker } from "@faker-js/faker";

const defaultAttributesFactory = async () => ({
  uuid: crypto.randomUUID(),
  collectionName: faker.lorem.words(1),
  name: faker.lorem.words(2),
  fileName: `${faker.lorem.words(1)}.jpg`,
  size: faker.number.int({ min: 1000, max: 10000 }),
  isPublic: true,
  isCover: false,
  fileType: "media",
  customProperties: {},
  disk: "s3",
  manipulation: [],
  responsiveImages: []
});

export const MediaFactory = {
  forProject: FactoryGirl.define(Media, async () => ({
    ...(await defaultAttributesFactory()),
    modelType: Project.LARAVEL_TYPE,
    modelId: ProjectFactory.associate("id")
  }))
};

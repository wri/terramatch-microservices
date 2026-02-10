import {
  EntityMediaOwnerClass,
  MEDIA_OWNER_MODEL_LARAVEL_TYPES,
  MEDIA_OWNER_MODELS,
  MediaOwnerModel,
  MediaOwnerType
} from "@terramatch-microservices/database/constants/media-owners";
import { intersection } from "lodash";
import { BadRequestException, NotFoundException } from "@nestjs/common";

const BASE_MODEL_ATTRIBUTES = [
  "id",
  "uuid",
  "frameworkKey",
  "projectId",
  "siteId",
  "nurseryId",
  "organisationId",
  "createdBy"
];

export class MediaOwnerProcessor {
  constructor(
    private readonly mediaOwnerType: MediaOwnerType,
    private readonly mediaOwnerUuid: string,
    private readonly mediaOwnerModel: EntityMediaOwnerClass<MediaOwnerModel>
  ) {}

  private _baseEntity: MediaOwnerModel;
  async getBaseEntity(): Promise<MediaOwnerModel> {
    if (this._baseEntity != null) return this._baseEntity;

    const attributes = intersection(BASE_MODEL_ATTRIBUTES, Object.keys(this.mediaOwnerModel.getAttributes()));

    const mediaOwnerClass = MEDIA_OWNER_MODELS[this.mediaOwnerType];
    const model = await mediaOwnerClass.findOne({ where: { uuid: this.mediaOwnerUuid }, attributes });

    if (model == null) {
      throw new NotFoundException(`Base entity not found: [${this.mediaOwnerModel.name}, ${this.mediaOwnerUuid}]`);
    }

    return (this._baseEntity = model);
  }
}

export const getBaseEntityByLaravelTypeAndId = async (laravelType: string, mediaOwnerId: number) => {
  const mediaOwnerModel = MEDIA_OWNER_MODEL_LARAVEL_TYPES[laravelType];
  if (mediaOwnerModel == null) {
    throw new BadRequestException(`Media owner type invalid: ${laravelType}`);
  }
  const modelKeys = Object.keys(mediaOwnerModel.getAttributes());
  let attributes = intersection(BASE_MODEL_ATTRIBUTES, modelKeys);
  // Ensure uuid is loaded when present (needed for DTO entityUuid in media index)
  if (!attributes.includes("uuid") && modelKeys.includes("uuid")) {
    attributes = [...attributes, "uuid"];
  }
  const model = await mediaOwnerModel.findOne({ where: { id: mediaOwnerId }, attributes });
  if (model == null) {
    throw new NotFoundException(`Base entity not found: [${mediaOwnerModel.name}, ${mediaOwnerId}]`);
  }
  return model;
};

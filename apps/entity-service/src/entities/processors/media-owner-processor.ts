import {
  EntityMediaOwnerClass,
  MEDIA_OWNER_MODELS,
  MediaOwnerModel,
  MediaOwnerType
} from "@terramatch-microservices/database/constants/media-owners";
import { intersection } from "lodash";
import { NotFoundException } from "@nestjs/common";

export class MediaOwnerProcessor {
  constructor(
    private readonly mediaOwnerType: MediaOwnerType,
    private readonly mediaOwnerUuid: string,
    private readonly mediaOwnerModel: EntityMediaOwnerClass<MediaOwnerModel>
  ) {}

  get baseModelAttributes() {
    // Only pull the attributes that are needed by the entity policies.
    return ["id", "frameworkKey", "projectId", "siteId", "nurseryId", "organisationId"];
  }

  private _baseEntity: MediaOwnerModel;
  async getBaseEntity(): Promise<MediaOwnerModel> {
    if (this._baseEntity != null) return this._baseEntity;

    const attributes = intersection(this.baseModelAttributes, Object.keys(this.mediaOwnerModel.getAttributes()));

    const mediaOwnerClass = MEDIA_OWNER_MODELS[this.mediaOwnerType];
    const model = await mediaOwnerClass.findOne({ where: { uuid: this.mediaOwnerUuid }, attributes });

    if (model == null) {
      throw new NotFoundException(`Base entity not found: [${this.mediaOwnerModel.name}, ${this.mediaOwnerUuid}]`);
    }

    return (this._baseEntity = model);
  }
}

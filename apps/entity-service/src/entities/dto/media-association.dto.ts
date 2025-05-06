import { Media } from "@terramatch-microservices/database/entities";
import { AssociationDto } from "./association.dto";
import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { EntityType } from "@terramatch-microservices/database/constants/entities";

export type MediaAssociationDtoAdditionalProps = {
  entityType: EntityType;
  entityUuid: string;
  url: string;
  thumbUrl: string;
};

export class MediaAssociationDto extends AssociationDto<MediaAssociationDto> {
  constructor(media: Media, additional: MediaAssociationDtoAdditionalProps) {
    super({
      ...pickApiProperties(media, MediaAssociationDto),
      ...additional
    });
  }
}

import { Media } from "@terramatch-microservices/database/entities";
import { AssociationDto, AssociationDtoAdditionalProps } from "./association.dto";
import { UserDto } from "@terramatch-microservices/common/dto/user.dto";
import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
export interface MediaAssociationDtoAdditionalProps extends AssociationDtoAdditionalProps {
  url: string;
  thumbUrl: string;
  createdBy: UserDto;
}

export class MediaAssociationDto extends AssociationDto<MediaAssociationDto> {
  constructor(media: Media, additional: MediaAssociationDtoAdditionalProps) {
    super({
      ...pickApiProperties(media, MediaAssociationDto),
      ...additional
    });
  }
}

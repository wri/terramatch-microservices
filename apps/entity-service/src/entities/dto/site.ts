import { JsonApiDto } from "@terramatch-microservices/common/decorators/json-api-dto.decorator";
import { EntityDto } from "./entity.dto";
import { Site } from "@terramatch-microservices/database/entities";
import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";

@JsonApiDto({ type: "sites" })
export class SiteLightDto extends EntityDto {
  constructor(site?: Site) {
    super();
    if (site != null) {
      this.populate(SiteLightDto, {
        ...pickApiProperties(site, SiteLightDto),
        lightResource: true
      });
    }
  }

  @ApiProperty({ nullable: true, description: "Framework key for this site" })
  frameworkKey: string | null;
}

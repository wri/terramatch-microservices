import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { ImpactStory } from "@terramatch-microservices/database/entities";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";
import { MediaDto } from "./media.dto";
import { EntityDto } from "./entity.dto";

@JsonApiDto({ type: "impactStories" })
export class ImpactStoryLightDto extends EntityDto {
  constructor(impactStory?: ImpactStory, props?: HybridSupportProps<ImpactStoryLightDto, ImpactStory>) {
    super();
    if (impactStory != null && props != null) {
      populateDto<ImpactStoryLightDto, ImpactStory>(this, impactStory, { lightResource: true, ...props });
    }
  }

  @ApiProperty({ nullable: true, type: Number })
  id: number | null;

  @ApiProperty({ nullable: true, type: String })
  uuid: string;

  @ApiProperty({ nullable: true, type: String })
  title: string | null;

  @ApiProperty({ nullable: true, type: String })
  status: string | null;

  @ApiProperty({ nullable: true, type: String })
  date: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  category: string[] | null;

  @ApiProperty({ type: () => MediaDto, isArray: true })
  thumbnail: MediaDto[] | null;

  @ApiProperty({ nullable: true, type: String })
  createdAt: string | null;

  @ApiProperty({ nullable: true, type: Object })
  organization: object | null;

  @ApiProperty({ nullable: true, type: String })
  updatedAt: string | null;
}

export type ImpactStoryMedia = Pick<ImpactStoryFullDto, keyof typeof ImpactStory.MEDIA>;
export class ImpactStoryFullDto extends ImpactStoryLightDto {
  constructor(impactStory: ImpactStory, props?: HybridSupportProps<ImpactStoryFullDto, ImpactStory>) {
    super(impactStory);
    if (impactStory != null && props != null) {
      populateDto<ImpactStoryFullDto, ImpactStory>(this, impactStory, { lightResource: false, ...props });
    }
  }

  @ApiProperty({ nullable: true, type: String })
  content: string | null;
}

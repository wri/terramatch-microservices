import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ImpactStory } from "@terramatch-microservices/database/entities";

@JsonApiDto({ type: "dashboardImpactStories" })
export class DashboardImpactStoryLightDto {
  constructor(impactStory: ImpactStory) {
    populateDto<DashboardImpactStoryLightDto, ImpactStory>(this, impactStory, {
      organization: null
    });
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  date: string;

  @ApiProperty({ type: [String] })
  category: string[];

  @ApiProperty({ type: String, nullable: true })
  thumbnail: string | null;

  @ApiProperty({ type: Object })
  organization: {
    name: string;
    countries: { label: string; icon: string | null }[];
    facebook_url: string | null;
    instagram_url: string | null;
    linkedin_url: string | null;
    twitter_url: string | null;
  } | null;

  @ApiProperty()
  status: string;
}

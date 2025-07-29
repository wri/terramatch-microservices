import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ImpactStory } from "@terramatch-microservices/database/entities";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";

@JsonApiDto({ type: "dashboardImpactStories" })
export class DashboardImpactStoryLightDto {
  constructor(impactStory?: ImpactStory, props?: HybridSupportProps<DashboardImpactStoryLightDto, ImpactStory>) {
    if (impactStory != null && props != null) {
      populateDto<DashboardImpactStoryLightDto, ImpactStory>(this, impactStory, { lightResource: true, ...props });
    }
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
  organisation: {
    name: string;
    countries: { label: string; icon: string | null }[];
    facebook_url: string | undefined;
    instagram_url: string | undefined;
    linkedin_url: string | undefined;
    twitter_url: string | undefined;
  } | null;

  @ApiProperty()
  status: string;
}

export class DashboardImpactStoryFullDto extends DashboardImpactStoryLightDto {
  constructor(impactStory: ImpactStory, props: HybridSupportProps<DashboardImpactStoryFullDto, ImpactStory>) {
    super(impactStory);
    if (impactStory != null && props != null) {
      populateDto<DashboardImpactStoryFullDto, ImpactStory>(this, impactStory, { lightResource: false, ...props });
    }
  }

  @ApiProperty({ nullable: true, type: String })
  content: string | null;
}

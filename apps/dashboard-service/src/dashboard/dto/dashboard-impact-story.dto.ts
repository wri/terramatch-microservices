import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { populateDto, AdditionalProps } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ImpactStory } from "@terramatch-microservices/database/entities";

type DashboardImpactStoryAdditionalProps = AdditionalProps<
  DashboardImpactStoryLightDto,
  Omit<ImpactStory, "category" | "thumbnail">
> & {
  organisation: {
    name: string;
    countries: { label: string; icon: string | null }[];
    facebook_url: string | undefined;
    instagram_url: string | undefined;
    linkedin_url: string | undefined;
    twitter_url: string | undefined;
  } | null;
  thumbnail: string;
  category: string[];
};

@JsonApiDto({ type: "dashboardImpactStories" })
export class DashboardImpactStoryLightDto {
  constructor(impactStory: ImpactStory, additional?: DashboardImpactStoryAdditionalProps) {
    populateDto<DashboardImpactStoryLightDto, Omit<ImpactStory, "category" | "thumbnail">>(
      this,
      impactStory,
      additional ?? {
        organisation: null,
        thumbnail: "",
        category: []
      }
    );
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

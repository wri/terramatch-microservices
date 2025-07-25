import { WhereOptions, Op } from "sequelize";
import { ImpactStory, Media } from "@terramatch-microservices/database/entities";
import { DashboardEntityProcessor, DtoResult } from "./dashboard-entity-processor";
import { DashboardQueryDto } from "../dto/dashboard-query.dto";
import { DashboardImpactStoryLightDto } from "../dto/dashboard-impact-story.dto";
import { CacheService } from "../dto/cache.service";
import { PolicyService } from "@terramatch-microservices/common";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { createOrganizationUrls } from "../utils/organization.utils";

export class DashboardImpactStoryProcessor extends DashboardEntityProcessor<
  ImpactStory,
  DashboardImpactStoryLightDto,
  DashboardImpactStoryLightDto
> {
  readonly LIGHT_DTO = DashboardImpactStoryLightDto;
  readonly FULL_DTO = DashboardImpactStoryLightDto;

  constructor(
    protected readonly cacheService: CacheService,
    protected readonly policyService: PolicyService,
    private readonly mediaService: MediaService
  ) {
    super(cacheService, policyService);
  }

  public async findOne(uuid: string): Promise<ImpactStory | null> {
    return await ImpactStory.findOne({
      where: { uuid },
      include: [
        {
          association: "organisation",
          attributes: ["uuid", "name", "type", "countries"]
        }
      ]
    });
  }

  public async findMany(query: DashboardQueryDto): Promise<ImpactStory[]> {
    const where: WhereOptions = {};
    const organisationWhere: WhereOptions = {};

    if (query.country != null && query.country !== "") {
      organisationWhere.countries = { [Op.like]: `%"${query.country}"%` };
    }

    if (query.organisationType != null && query.organisationType.length > 0) {
      organisationWhere.type = { [Op.in]: query.organisationType };
    }

    const impactStories = await ImpactStory.findAll({
      where,
      include: [
        {
          association: "organisation",
          attributes: ["uuid", "name", "type", "countries", "facebookUrl", "instagramUrl", "linkedinUrl", "twitterUrl"],
          where: Object.keys(organisationWhere).length > 0 ? organisationWhere : undefined
        }
      ],
      order: [["id", "ASC"]]
    });

    return impactStories;
  }

  public async getLightDto(impactStory: ImpactStory): Promise<DtoResult<DashboardImpactStoryLightDto>> {
    const org = impactStory.organisation;
    const organization = org != null ? createOrganizationUrls(org) : null;

    const mediaCollection = await Media.findAll({
      where: {
        modelType: ImpactStory.LARAVEL_TYPE,
        modelId: impactStory.id,
        collectionName: "thumbnail"
      }
    });
    const thumbnail = mediaCollection.length > 0 ? this.mediaService.getUrl(mediaCollection[0]) : "";

    const category = Array.isArray(impactStory.category)
      ? impactStory.category.filter((cat: string) => cat != null && cat !== "")
      : impactStory.category != null && impactStory.category !== ""
      ? [impactStory.category]
      : [];

    const dto = new DashboardImpactStoryLightDto(impactStory, {
      organization,
      thumbnail: thumbnail != null ? thumbnail : "",
      category
    });

    return { id: impactStory.uuid, dto };
  }

  public async getFullDto(impactStory: ImpactStory): Promise<DtoResult<DashboardImpactStoryLightDto>> {
    return this.getLightDto(impactStory);
  }
}

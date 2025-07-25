import { Injectable } from "@nestjs/common";
import { Op, WhereOptions } from "sequelize";
import { ImpactStory } from "@terramatch-microservices/database/entities";
import { MediaService } from "@terramatch-microservices/common/media/media.service";

interface DashboardImpactStoryParams {
  country?: string;
  organisationType?: string[];
}

@Injectable()
export class DashboardImpactStoryService {
  constructor(private readonly mediaService: MediaService) {}

  async getDashboardImpactStories(params: DashboardImpactStoryParams): Promise<ImpactStory[]> {
    const where: WhereOptions<ImpactStory> = {};
    const organisationWhere: WhereOptions = {};

    if (params.country != null && params.country !== "") {
      organisationWhere.countries = { [Op.like]: `%"${params.country}"%` };
    }

    if (params.organisationType != null && params.organisationType.length > 0) {
      organisationWhere.type = { [Op.in]: params.organisationType };
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

  async getDashboardImpactStoryById(uuid: string): Promise<ImpactStory | null> {
    const impactStory = await ImpactStory.findOne({
      where: { uuid },
      include: [
        {
          association: "organisation",
          attributes: ["uuid", "name", "type", "countries", "facebookUrl", "instagramUrl", "linkedinUrl", "twitterUrl"]
        }
      ]
    });

    return impactStory;
  }
}

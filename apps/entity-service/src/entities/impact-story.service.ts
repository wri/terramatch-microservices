import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ImpactStory, Project, WorldCountryGeneralized } from "@terramatch-microservices/database/entities";
import { Includeable, Op } from "sequelize";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { ImpactStoryQueryDto } from "./dto/impact-story-query.dto";

@Injectable()
export class ImpactStoryService {
  async getImpactStory(uuid: string) {
    const organisationAssociation: Includeable = {
      association: "organisation",
      attributes: [
        "uuid",
        "name",
        "type",
        "countries",
        "webUrl",
        "facebookUrl",
        "instagramUrl",
        "linkedinUrl",
        "twitterUrl"
      ]
    };
    const impactStory = await ImpactStory.findOne({ where: { uuid }, include: organisationAssociation });
    if (impactStory == null) {
      throw new NotFoundException("impactStory not found");
    }
    return impactStory;
  }

  async getImpactStories(query: ImpactStoryQueryDto) {
    const organisationAssociation: Includeable = {
      association: "organisation",
      attributes: ["uuid", "name", "type", "countries"]
    };
    const builder = PaginatedQueryBuilder.forNumberPage(ImpactStory, query.page, [organisationAssociation]);

    if (query.search != null) {
      builder.where({
        [Op.or]: [
          { title: { [Op.like]: `%${query.search}%` } },
          { "$organisation.name$": { [Op.like]: `%${query.search}%` } }
        ]
      });
    }

    const associationFieldMap = {
      organisationUuid: "$organisation.uuid$",
      organizationType: "$organisation.type$",
      organizationName: "$organisation.name$",
      country: "$organisation.countries$"
      // projectUuid: "$project.uuid$"
    };

    for (const key of ["status", "projectUuid", "organisationUuid", "country", "uuid"]) {
      const fieldKey = associationFieldMap[key] ?? key;
      if (query[key] != null) {
        if (
          ![
            "title",
            "status",
            "createdAt",
            "organisationUuid",
            "organizationType",
            "country",
            "uuid",
            "projectUuid"
          ].includes(key)
        ) {
          throw new BadRequestException(`Invalid filter key: ${key}`);
        }
        if (key == "country") {
          builder.where({
            "$organisation.countries$": {
              [Op.or]: Array.isArray(query[key])
                ? query[key].map(country => ({
                    [Op.like]: `%\"${country}\"%`
                  }))
                : [
                    {
                      [Op.like]: `%\"${query[key]}\"%`
                    }
                  ]
            }
          });
        } else if (key === "uuid") {
          const project = await Project.findOne({ where: { uuid: query[key] }, attributes: ["organisationId"] });
          if (project) {
            builder.where({
              "$organisation.id$": project.organisationId
            });
          }
        } else {
          builder.where({
            [fieldKey]: { [Op.like]: `%${query[key]}%` }
          });
        }
      }
    }
    if (query.sort?.field != null) {
      if (
        ["id", "organizationId", "title", "status", "createdAt", "organizationName", "organizationCountry"].includes(
          query.sort.field
        )
      ) {
        const fieldKey = associationFieldMap[query.sort.field] ?? query.sort.field;
        builder.order([fieldKey, query.sort.direction ?? "ASC"]);
      } else {
        throw new BadRequestException(`Invalid sort field: ${query.sort.field}`);
      }
    }
    return {
      data: await builder.execute(),
      paginationTotal: await builder.paginationTotal(),
      pageNumber: query.page?.number ?? 1
    };
  }
}

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ImpactStory, Project, Media, WorldCountryGeneralized } from "@terramatch-microservices/database/entities";
import { Includeable, Op } from "sequelize";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { ImpactStoryQueryDto } from "./dto/impact-story-query.dto";
import { groupBy, uniq } from "lodash";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";

const ORGANISATION_FIELDS_BASE = ["uuid", "name", "type", "countries"];

const ORGANISATION_ASSOCIATION_FULL: Includeable = {
  association: "organisation",
  attributes: [...ORGANISATION_FIELDS_BASE, "webUrl", "facebookUrl", "instagramUrl", "linkedinUrl", "twitterUrl"]
} as const;

const ORGANISATION_ASSOCIATION_LIGHT: Includeable = {
  association: "organisation",
  attributes: ORGANISATION_FIELDS_BASE
} as const;

const VALID_FILTER_KEYS: (keyof ImpactStoryQueryDto)[] = [
  "title",
  "status",
  "createdAt",
  "organisationUuid",
  "organisationType",
  "country",
  "uuid",
  "projectUuid",
  "category"
];

@Injectable()
export class ImpactStoryService {
  async getImpactStory(uuid: string) {
    const impactStory = await ImpactStory.findOne({ where: { uuid }, include: ORGANISATION_ASSOCIATION_FULL });
    if (impactStory == null) {
      throw new NotFoundException("impactStory not found");
    }
    return impactStory;
  }

  async getMediaForStories(stories: ImpactStory[]) {
    const ids = stories.map(s => s.id);
    const allMedia = await Media.findAll({
      where: { modelType: ImpactStory.LARAVEL_TYPE, modelId: { [Op.in]: ids } }
    });
    return groupBy(allMedia, "modelId");
  }

  async getCountriesForOrganizations(organizationCountries: string[][]) {
    const uniqueCountries = uniq(organizationCountries.flat());
    if (uniqueCountries.length === 0) return new Map();

    const countries = await WorldCountryGeneralized.findAll({
      where: {
        iso: {
          [Op.in]: uniqueCountries
        }
      }
    });

    return new Map(
      countries.map(country => [
        country.iso,
        {
          label: country.country ?? null,
          icon: country.iso != null && country.iso !== "" ? `/flags/${country.iso.toLowerCase()}.svg` : null
        }
      ])
    );
  }

  async getImpactStories(query: ImpactStoryQueryDto) {
    const builder = PaginatedQueryBuilder.forNumberPage(ImpactStory, query.page, [ORGANISATION_ASSOCIATION_LIGHT]);

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
      organisationType: "$organisation.type$",
      country: "$organisation.countries$"
    };

    for (const key of Object.keys(query)) {
      if (!["page", "sort", "search", ...VALID_FILTER_KEYS].includes(key)) {
        throw new BadRequestException(`Invalid filter key: ${key}`);
      }
    }

    for (const key of [
      "status",
      "projectUuid",
      "organisationUuid",
      "country",
      "uuid",
      "organisationType",
      "category"
    ]) {
      const fieldKey = associationFieldMap[key] ?? key;
      const value = query[key];
      if (value != null && value !== "") {
        if (key === "projectUuid") {
          const project = await Project.findOne({
            where: { uuid: value },
            attributes: ["organisationId"]
          });
          if (project != null) {
            builder.where({
              "$organisation.id$": project.organisationId
            });
          }
        } else if (key === "country") {
          builder.where({
            "$organisation.countries$": {
              [Op.or]: Array.isArray(value)
                ? value.map(country => ({
                    [Op.like]: `%"${country}"%`
                  }))
                : [
                    {
                      [Op.like]: `%"${value}"%`
                    }
                  ]
            }
          });
        } else if (key === "uuid") {
          builder.where({
            "$organisation.id$": Subquery.select(Project, "organisationId").eq("uuid", value).literal
          });
        } else {
          builder.where({
            [fieldKey]: { [Op.like]: `%${value}%` }
          });
        }
      }
    }

    if (query.sort?.field != null) {
      if (["id", "title", "status", "createdAt"].includes(query.sort.field)) {
        builder.order([query.sort.field, query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "organization.name") {
        builder.order(["organisation", "name", query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "organization.countries") {
        builder.order(["organisation", "countries", query.sort.direction ?? "ASC"]);
      } else if (query.sort.field !== "id") {
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

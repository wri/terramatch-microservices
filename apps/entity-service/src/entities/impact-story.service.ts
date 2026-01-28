import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ImpactStory,
  Organisation,
  Project,
  Media,
  WorldCountryGeneralized
} from "@terramatch-microservices/database/entities";
import { CreationAttributes, Includeable, Op } from "sequelize";
import { Sequelize } from "sequelize";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { ImpactStoryQueryDto } from "./dto/impact-story-query.dto";
import { groupBy, uniq } from "lodash";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";
import { CreateImpactStoryAttributes } from "./dto/create-impact-story.dto";
import { UpdateImpactStoryAttributes } from "./dto/update-impact-story.dto";

interface OrganizationData {
  uuid: string | null;
  name: string | null;
  type: string | null;
  countries: Array<{ label: string | null; icon: string | null }>;
  webUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
}

interface ImpactStoryWithMedia {
  impactStory: ImpactStory;
  mediaCollection: Media[];
  organization: OrganizationData;
}

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
        } else if (key === "category") {
          if (Array.isArray(value) && value.length > 0) {
            const categoryConditions = value.map(cat =>
              Sequelize.literal(`JSON_SEARCH(category, 'one', '${cat}') IS NOT NULL`)
            );
            builder.where({
              [Op.or]: categoryConditions
            });
          }
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

  async buildOrganizationData(impactStory: ImpactStory, includeFullDetails = false): Promise<OrganizationData> {
    const organisation = impactStory.organisation;
    if (organisation == null) {
      return {
        uuid: null,
        name: null,
        type: null,
        countries: []
      };
    }

    const organizationCountries = organisation.countries ?? [];
    const countriesMap = await this.getCountriesForOrganizations([organizationCountries]);
    const orgCountries = organizationCountries
      .map(iso => {
        if (iso == null || iso === "") return null;
        return countriesMap.get(iso);
      })
      .filter((country): country is { label: string | null; icon: string | null } => country != null);

    const organization: OrganizationData = {
      uuid: organisation.uuid ?? null,
      name: organisation.name ?? null,
      type: organisation.type ?? null,
      countries: orgCountries
    };

    if (includeFullDetails) {
      organization.webUrl = organisation.webUrl ?? null;
      organization.facebookUrl = organisation.facebookUrl ?? null;
      organization.instagramUrl = organisation.instagramUrl ?? null;
      organization.linkedinUrl = organisation.linkedinUrl ?? null;
      organization.twitterUrl = organisation.twitterUrl ?? null;
    }

    return organization;
  }

  async getImpactStoryWithMedia(uuid: string, includeFullOrganizationDetails = false): Promise<ImpactStoryWithMedia> {
    const impactStory = await this.getImpactStory(uuid);
    if (impactStory == null) {
      throw new NotFoundException(`Impact story with UUID ${uuid} not found`);
    }

    const mediaCollection = await Media.for(impactStory).findAll();
    const organization = await this.buildOrganizationData(impactStory, includeFullOrganizationDetails);

    return {
      impactStory,
      mediaCollection,
      organization
    };
  }

  async createImpactStory(attributes: CreateImpactStoryAttributes): Promise<ImpactStory> {
    const organisation = await Organisation.findOne({
      where: { uuid: attributes.organizationUuid },
      attributes: ["id"]
    });

    if (organisation == null) {
      throw new BadRequestException(`Organization with UUID ${attributes.organizationUuid} not found`);
    }

    const createData: Partial<CreationAttributes<ImpactStory>> = {
      title: attributes.title,
      status: attributes.status,
      organizationId: organisation.id,
      category: attributes.category ?? [],
      thumbnail: attributes.thumbnail ?? ""
    };

    if (attributes.date != null) {
      createData.date = attributes.date;
    }

    if (attributes.content != null) {
      createData.content = attributes.content;
    }

    const impactStory = await ImpactStory.create(createData as CreationAttributes<ImpactStory>);

    const reloadedStory = await ImpactStory.findOne({
      where: { uuid: impactStory.uuid },
      include: ORGANISATION_ASSOCIATION_FULL
    });

    if (reloadedStory == null) {
      throw new NotFoundException("Failed to reload created impact story");
    }

    return reloadedStory;
  }

  async updateImpactStory(uuid: string, attributes: UpdateImpactStoryAttributes): Promise<ImpactStory> {
    const impactStory = await ImpactStory.findOne({ where: { uuid }, include: ORGANISATION_ASSOCIATION_FULL });

    if (impactStory == null) {
      throw new NotFoundException(`Impact story with UUID ${uuid} not found`);
    }

    impactStory.status = attributes.status;

    if (attributes.title !== undefined) {
      impactStory.title = attributes.title;
    }

    if (attributes.date !== undefined && attributes.date != null) {
      impactStory.date = attributes.date;
    }

    if (attributes.category !== undefined) {
      impactStory.category = attributes.category ?? [];
    }

    if (attributes.content !== undefined && attributes.content != null) {
      impactStory.content = attributes.content;
    }

    if (attributes.thumbnail !== undefined) {
      impactStory.thumbnail = attributes.thumbnail ?? "";
    }

    if (attributes.organizationUuid !== undefined) {
      const organisation = await Organisation.findOne({
        where: { uuid: attributes.organizationUuid },
        attributes: ["id"]
      });

      if (organisation == null) {
        throw new BadRequestException(`Organization with UUID ${attributes.organizationUuid} not found`);
      }

      impactStory.organizationId = organisation.id;
    }

    await impactStory.save();

    const reloadedStory = await ImpactStory.findOne({
      where: { uuid: impactStory.uuid },
      include: ORGANISATION_ASSOCIATION_FULL
    });

    if (reloadedStory == null) {
      throw new NotFoundException("Failed to reload updated impact story");
    }

    return reloadedStory;
  }

  async deleteImpactStory(uuid: string): Promise<void> {
    const impactStory = await ImpactStory.findOne({ where: { uuid } });

    if (impactStory == null) {
      throw new NotFoundException(`Impact story with UUID ${uuid} not found`);
    }

    await impactStory.destroy();
  }

  async bulkDeleteImpactStories(uuids: string[]): Promise<string[]> {
    if (uuids.length === 0) {
      throw new BadRequestException("At least one impact story UUID must be provided");
    }

    const impactStories = await ImpactStory.findAll({
      where: { uuid: { [Op.in]: uuids } },
      attributes: ["id", "uuid"]
    });

    if (impactStories.length === 0) {
      throw new NotFoundException("No impact stories found with the provided UUIDs");
    }

    const foundUuids = impactStories.map(story => story.uuid).filter((uuid): uuid is string => uuid != null);
    const notFoundUuids = uuids.filter(uuid => !foundUuids.includes(uuid));

    if (notFoundUuids.length > 0) {
      throw new NotFoundException(`Impact stories not found with UUIDs: ${notFoundUuids.join(", ")}`);
    }

    const idsToDelete = impactStories.map(story => story.id).filter((id): id is number => id != null);

    if (idsToDelete.length > 0) {
      await ImpactStory.destroy({
        where: { id: { [Op.in]: idsToDelete } }
      });
    }

    return foundUuids;
  }
}

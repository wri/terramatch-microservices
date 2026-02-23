import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import {
  Organisation,
  User,
  FinancialIndicator,
  FinancialReport,
  Media,
  FundingType,
  Leadership,
  OwnershipStake,
  TreeSpecies
} from "@terramatch-microservices/database/entities";
import { OrganisationIndexQueryDto } from "./dto/organisation-query.dto";
import { OrganisationShowQueryDto } from "./dto/organisation-show-query.dto";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { Op } from "sequelize";
import { OrganisationUpdateAttributes } from "./dto/organisation-update.dto";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";
import { PolicyService } from "@terramatch-microservices/common";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { FinancialIndicatorDto } from "@terramatch-microservices/common/dto/financial-indicator.dto";
import { EmbeddedMediaDto, MediaDto } from "@terramatch-microservices/common/dto/media.dto";
import { FundingTypeDto } from "@terramatch-microservices/common/dto/funding-type.dto";
import { FinancialReportLightDto } from "@terramatch-microservices/common/dto/financial-report.dto";
import { LeadershipDto } from "@terramatch-microservices/common/dto/leadership.dto";
import { OwnershipStakeDto } from "@terramatch-microservices/common/dto/ownership-stake.dto";
import { TreeSpeciesDto } from "@terramatch-microservices/common/dto/tree-species.dto";

@Injectable()
export class OrganisationsService {
  private readonly logger = new TMLogger(OrganisationsService.name);

  constructor(private readonly policyService: PolicyService, private readonly mediaService: MediaService) {}

  async findMany(query: OrganisationIndexQueryDto) {
    const builder = PaginatedQueryBuilder.forNumberPage(Organisation, query.page);

    const permissions = await this.policyService.getPermissions();
    if (permissions.find(p => p.startsWith("framework-")) == null) {
      const userId = authenticatedUserId();
      if (userId == null) {
        throw new BadRequestException("User ID is required");
      }
      const orgUuids = await User.orgUuids(userId);
      const user = await User.findOne({
        where: { id: userId },
        attributes: ["id"]
      });
      if (user != null) {
        const projects = await user.$get("projects", { attributes: ["id", "organisationId"] });
        const projectOrgIds = projects
          .map(({ organisationId }) => organisationId)
          .filter((id): id is number => id != null);

        if (orgUuids.length > 0 || projectOrgIds.length > 0) {
          const conditions: Array<{ uuid?: { [Op.in]: string[] }; id?: { [Op.in]: number[] } }> = [];
          if (orgUuids.length > 0) {
            conditions.push({ uuid: { [Op.in]: orgUuids } });
          }
          if (projectOrgIds.length > 0) {
            conditions.push({ id: { [Op.in]: projectOrgIds } });
          }
          builder.where({ [Op.or]: conditions });
        } else {
          builder.where({ id: { [Op.in]: [] } });
        }
      }
    }

    if (query.fundingProgrammeUuid != null) {
      builder.where({
        uuid: { [Op.in]: Organisation.uuidForFundingProgramme(query.fundingProgrammeUuid) }
      });
    }

    if (query.search != null) {
      builder.where({ name: { [Op.like]: `%${query.search}%` } });
    }

    if (query.status != null) {
      builder.where({ status: query.status });
    }

    if (query.type != null) {
      builder.where({ type: query.type });
    }

    if (query.hqCountry != null) {
      builder.where({ hqCountry: query.hqCountry });
    }

    if (query.sort?.field != null) {
      const sortField = query.sort.field.startsWith("-") ? query.sort.field.substring(1) : query.sort.field;
      const direction = query.sort.field.startsWith("-") ? "DESC" : query.sort.direction ?? "ASC";

      const fieldMap: Record<string, string> = {
        created_at: "createdAt",
        trees_grown_total: "treesGrownTotal"
      };

      const entityField = fieldMap[sortField] ?? sortField;
      const validSortFields = ["createdAt", "name", "status", "type", "treesGrownTotal"];

      if (validSortFields.includes(entityField)) {
        builder.order([entityField, direction]);
      } else if (entityField !== "id") {
        throw new BadRequestException(`Invalid sort field: ${query.sort.field}`);
      }
    } else {
      builder.order(["createdAt", "DESC"]);
    }

    return {
      organisations: await builder.execute(),
      paginationTotal: await builder.paginationTotal()
    };
  }

  async findOne(uuid: string): Promise<Organisation> {
    const organisation = await Organisation.findOne({ where: { uuid } });
    if (organisation == null) {
      throw new NotFoundException(`Organisation with UUID ${uuid} not found`);
    }
    return organisation;
  }

  async update(organisation: Organisation, attributes: OrganisationUpdateAttributes): Promise<Organisation> {
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== undefined) {
        (organisation as Organisation & Record<string, unknown>)[key] = value;
      }
    }

    await organisation.save();
    return organisation;
  }

  async delete(organisation: Organisation): Promise<void> {
    await organisation.destroy();
  }

  async processSideloads(
    document: DocumentBuilder,
    organisation: Organisation,
    query: OrganisationShowQueryDto
  ): Promise<void> {
    if (query.sideloads == null || query.sideloads.length === 0) {
      return;
    }

    if (query.sideloads.includes("financialCollection")) {
      const financialIndicators = await FinancialIndicator.organisation(organisation.id).findAll();

      if (financialIndicators.length > 0) {
        const mediaCollection = await Media.for(financialIndicators).findAll({
          where: { collectionName: "documentation" }
        });

        const mediaByIndicatorId = mediaCollection.reduce((acc, media) => {
          if (acc[media.modelId] == null) {
            acc[media.modelId] = [];
          }
          acc[media.modelId].push(media);
          return acc;
        }, {} as Record<number, Media[]>);

        for (const indicator of financialIndicators) {
          const indicatorMedia = mediaByIndicatorId[indicator.id] ?? [];
          const mediaDtos =
            indicatorMedia.length > 0
              ? indicatorMedia.map(
                  media =>
                    new EmbeddedMediaDto(media, {
                      url: this.mediaService.getUrl(media),
                      thumbUrl: this.mediaService.getUrl(media, "thumbnail")
                    })
                )
              : null;

          const indicatorDto = new FinancialIndicatorDto(indicator, {
            entityType: "financialIndicators" as const,
            entityUuid: indicator.uuid,
            documentation: mediaDtos
          });
          Object.assign(indicatorDto, { organisationUuid: organisation.uuid });
          document.addData(indicator.uuid, indicatorDto);
        }
      }
    }

    if (query.sideloads.includes("financialReport")) {
      const financialReports = await FinancialReport.organisation(organisation.id).findAll();

      if (financialReports.length > 0) {
        for (const report of financialReports) {
          const dto = new FinancialReportLightDto(report, {
            entityType: "financialReports" as const,
            entityUuid: report.uuid
          });
          dto.organisationUuid = organisation.uuid;
          document.addData(report.uuid, dto);
        }
      }
    }

    if (query.sideloads.includes("media")) {
      const allMedia = await Media.for(organisation).findAll();

      if (allMedia.length > 0) {
        for (const media of allMedia) {
          document.addData(
            media.uuid,
            new MediaDto(media, {
              entityType: "organisations" as const,
              entityUuid: organisation.uuid,
              url: this.mediaService.getUrl(media),
              thumbUrl: this.mediaService.getUrl(media, "thumbnail")
            })
          );
        }
      }
    }

    if (query.sideloads.includes("fundingTypes")) {
      const fundingTypes = await FundingType.organisation(organisation.uuid).findAll();

      if (fundingTypes.length > 0) {
        for (const fundingType of fundingTypes) {
          document.addData(
            fundingType.uuid,
            new FundingTypeDto(fundingType, {
              // @ts-expect-error - fundingTypes is not in AssociationEntityType but is valid for JSON:API
              entityType: "fundingTypes" as const,
              entityUuid: fundingType.uuid
            })
          );
        }
      }
    }

    if (query.sideloads.includes("leadership")) {
      const leaderships = await Leadership.organisation(organisation.id).findAll();

      if (leaderships.length > 0) {
        for (const leadership of leaderships) {
          document.addData(
            leadership.uuid,
            new LeadershipDto(leadership, {
              entityType: "organisations" as const,
              entityUuid: organisation.uuid
            })
          );
        }
      }
    }

    if (query.sideloads.includes("ownershipStakes")) {
      const ownershipStakes = await OwnershipStake.organisation(organisation.uuid).findAll();

      if (ownershipStakes.length > 0) {
        for (const ownershipStake of ownershipStakes) {
          document.addData(
            ownershipStake.uuid,
            new OwnershipStakeDto(ownershipStake, {
              entityType: "organisations" as const,
              entityUuid: organisation.uuid
            })
          );
        }
      }
    }

    if (query.sideloads.includes("treeSpeciesHistorical")) {
      const treeSpecies = await TreeSpecies.for(organisation).collection("historical-tree-species").findAll();

      if (treeSpecies.length > 0) {
        for (const species of treeSpecies) {
          document.addData(
            species.uuid,
            new TreeSpeciesDto(species, {
              entityType: "organisations" as const,
              entityUuid: organisation.uuid
            })
          );
        }
      }
    }
  }
}

import { BadRequestException, Injectable, NotFoundException, Scope, UnauthorizedException } from "@nestjs/common";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { Organisation, OrganisationUser, User } from "@terramatch-microservices/database/entities";
import { OrganisationIndexQueryDto } from "./dto/organisation-query.dto";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { Op } from "sequelize";
import { OrganisationUpdateAttributes } from "./dto/organisation-update.dto";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";
import { PolicyService } from "@terramatch-microservices/common";
import { APPROVED } from "@terramatch-microservices/database/constants/status";

@Injectable({ scope: Scope.REQUEST })
export class OrganisationsService {
  private readonly logger = new TMLogger(OrganisationsService.name);

  constructor(private readonly policyService: PolicyService) {}

  async findMany(query: OrganisationIndexQueryDto) {
    const builder = PaginatedQueryBuilder.forNumberPage(Organisation, query.page);

    const permissions = await this.policyService.getPermissions();
    const hasFrameworkPermission = permissions.find(p => p.startsWith("framework-")) != null;

    if (query.listing === true) {
      builder.where({
        status: APPROVED,
        private: false,
        isTest: false
      });

      if (query.sort?.field == null) {
        builder.order(["name", "ASC"]);
      }
    } else if (!hasFrameworkPermission) {
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

    if (query.status != null && query.listing !== true) {
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
    } else if (query.listing !== true) {
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
    await User.update({ organisationId: null }, { where: { organisationId: organisation.id } });
    await OrganisationUser.destroy({ where: { organisationId: organisation.id } });

    await organisation.destroy();
  }

  async requestJoin(organisationUuid: string, userId: number): Promise<OrganisationUser> {
    const organisation = await this.findOne(organisationUuid);

    const user = await User.findOne({
      where: { id: userId },
      attributes: ["id"]
    });

    if (user == null) {
      throw new UnauthorizedException("Authenticated user not found");
    }

    const [orgUser, created] = await OrganisationUser.findOrCreate({
      where: {
        organisationId: organisation.id,
        userId: userId
      },
      defaults: {
        organisationId: organisation.id,
        userId: userId,
        status: "requested"
      } as OrganisationUser
    });

    if (!created && orgUser.status !== "requested") {
      orgUser.status = "requested";
      await orgUser.save();
    }

    return orgUser;
  }
}

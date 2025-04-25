import { Media, Nursery, NurseryReport, Project, ProjectUser } from "@terramatch-microservices/database/entities";
import { AdditionalNurseryFullProps, NurseryFullDto, NurseryLightDto, NurseryMedia } from "../dto/nursery.dto";
import { EntityProcessor } from "./entity-processor";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { col, fn, Includeable, Op } from "sequelize";
import { BadRequestException, NotAcceptableException } from "@nestjs/common";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { EntityUpdateAttributes } from "../dto/entity-update.dto";
import { Disturbance } from "@terramatch-microservices/database/entities/disturbance.entity";
import { DisturbanceFullDto, DisturbanceLightDto } from "../dto/disturbance.dto";

export class DisturbancesProcessor extends EntityProcessor<
  Disturbance,
  DisturbanceLightDto,
  DisturbanceFullDto,
  EntityUpdateAttributes
> {
  readonly LIGHT_DTO = DisturbanceLightDto;
  readonly FULL_DTO = DisturbanceFullDto;

  async findOne(uuid: string) {
    return await Disturbance.findOne({
      where: { uuid }
      /*include: [
        {
          association: "project",
          attributes: ["uuid", "name"],
          include: [{ association: "organisation", attributes: ["name"] }]
        }
      ]*/
    });
  }

  async findMany(query: EntityQueryDto) {
    const projectAssociation: Includeable = {
      association: "project",
      attributes: ["uuid", "name"],
      include: [{ association: "organisation", attributes: ["name"] }]
    };

    const builder = await this.entitiesService.buildQuery(Disturbance, query, [projectAssociation]);
    if (query.sort != null) {
      if (["name", "startDate", "status", "updateRequestStatus", "createdAt"].includes(query.sort.field)) {
        builder.order([query.sort.field, query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "organisationName") {
        builder.order(["project", "organisation", "name", query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "projectName") {
        builder.order(["project", "name", query.sort.direction ?? "ASC"]);
      } else if (query.sort.field !== "id") {
        throw new BadRequestException(`Invalid sort field: ${query.sort.field}`);
      }
    }

    const permissions = await this.entitiesService.getPermissions();
    const frameworkPermissions = permissions
      ?.filter(name => name.startsWith("framework-"))
      .map(name => name.substring("framework-".length) as FrameworkKey);
    if (frameworkPermissions?.length > 0) {
      builder.where({ frameworkKey: { [Op.in]: frameworkPermissions } });
    } else if (permissions?.includes("manage-own")) {
      builder.where({ projectId: { [Op.in]: ProjectUser.userProjectsSubquery(this.entitiesService.userId) } });
    } else if (permissions?.includes("projects-manage")) {
      builder.where({ projectId: { [Op.in]: ProjectUser.projectsManageSubquery(this.entitiesService.userId) } });
    }

    const associationFieldMap = {
      organisationUuid: "$project.organisation.uuid$",
      country: "$project.country$",
      projectUuid: "$project.uuid$"
    };

    for (const term of [
      "status",
      "updateRequestStatus",
      "frameworkKey",
      "organisationUuid",
      "country",
      "projectUuid"
    ]) {
      if (query[term] != null) {
        const field = associationFieldMap[term] ?? term;
        builder.where({ [field]: query[term] });
      }
    }

    if (query.search != null || query.searchFilter != null) {
      builder.where({
        [Op.or]: [
          { name: { [Op.like]: `%${query.search ?? query.searchFilter}%` } },
          { "$project.name$": { [Op.like]: `%${query.search}%` } },
          { "$project.organisation.name$": { [Op.like]: `%${query.search}%` } }
        ]
      });
    }

    return { models: await builder.execute(), paginationTotal: await builder.paginationTotal() };
  }

  async getFullDto(disturbance: Disturbance) {
    const nurseryId = disturbance.id;

    return { id: disturbance.uuid, dto: new DisturbanceFullDto(disturbance, null) };
  }

  async getLightDto(disturbance: Disturbance) {
    const nurseryId = disturbance.id;
    return { id: disturbance.uuid, dto: new DisturbanceLightDto(disturbance, null) };
  }

  async delete(disturbance: Disturbance) {
    const permissions = await this.entitiesService.getPermissions();
    const managesOwn = permissions.includes("manage-own"); // TODO validate this condition
    if (managesOwn) {
      const reportCount = await NurseryReport.count({ where: { nurseryId: disturbance.id } });
      if (reportCount > 0) {
        throw new NotAcceptableException("You can only delete nurseries that do not have reports");
      }
    }

    await super.delete(disturbance);
  }
}

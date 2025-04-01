import {
  Action,
  Media,
  Nursery,
  NurseryReport,
  Project,
  ProjectUser,
  Role,
  User
} from "@terramatch-microservices/database/entities";
import { NurseryLightDto, NurseryFullDto, AdditionalNurseryFullProps, NurseryMedia } from "../dto/nursery.dto";
import { EntityProcessor, PaginatedResult } from "./entity-processor";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { col, fn, Includeable, Op } from "sequelize";
import { BadRequestException, NotAcceptableException } from "@nestjs/common";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";

export class NurseryProcessor extends EntityProcessor<Nursery, NurseryLightDto, NurseryFullDto> {
  readonly LIGHT_DTO = NurseryLightDto;
  readonly FULL_DTO = NurseryFullDto;

  async findOne(uuid: string): Promise<Nursery> {
    return await Nursery.findOne({
      where: { uuid },
      include: [
        {
          association: "project",
          attributes: ["uuid", "name"],
          include: [{ association: "organisation", attributes: ["name"] }]
        }
      ]
    });
  }

  async findMany(query: EntityQueryDto, userId?: number, permissions?: string[]): Promise<PaginatedResult<Nursery>> {
    const projectAssociation: Includeable = {
      association: "project",
      attributes: ["uuid", "name"],
      include: [{ association: "organisation", attributes: ["name"] }]
    };

    const builder = await this.entitiesService.buildQuery(Nursery, query, [projectAssociation]);
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

    const frameworkPermissions = permissions
      ?.filter(name => name.startsWith("framework-"))
      .map(name => name.substring("framework-".length) as FrameworkKey);
    if (frameworkPermissions?.length > 0) {
      builder.where({ frameworkKey: { [Op.in]: frameworkPermissions } });
    } else if (permissions?.includes("manage-own")) {
      builder.where({ projectId: { [Op.in]: ProjectUser.userProjectsSubquery(userId) } });
    } else if (permissions?.includes("projects-manage")) {
      builder.where({ projectId: { [Op.in]: ProjectUser.projectsManageSubquery(userId) } });
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

    if (query.projectUuid != null) {
      const project = await Project.findOne({ where: { uuid: query.projectUuid }, attributes: ["id"] });
      if (project == null) {
        throw new BadRequestException(`Project with uuid ${query.projectUuid} not found`);
      }
      builder.where({ projectId: project.id });
    }

    return { models: await builder.execute(), paginationTotal: await builder.paginationTotal() };
  }

  async addFullDto(document: DocumentBuilder, nursery: Nursery): Promise<void> {
    const nurseryId = nursery.id;

    const nurseryReportsTotal = await NurseryReport.nurseries([nurseryId]).count();
    const seedlingsGrownCount = await this.getSeedlingsGrownCount(nurseryId);
    const overdueNurseryReportsTotal = await this.getTotalOverdueReports(nurseryId);
    const props: AdditionalNurseryFullProps = {
      seedlingsGrownCount,
      nurseryReportsTotal,
      overdueNurseryReportsTotal,

      ...(this.entitiesService.mapMediaCollection(
        await Media.nursery(nurseryId).findAll(),
        Nursery.MEDIA
      ) as NurseryMedia)
    };

    document.addData(nursery.uuid, new NurseryFullDto(nursery, props));
  }

  async addLightDto(document: DocumentBuilder, nursery: Nursery): Promise<void> {
    const nurseryId = nursery.id;

    const seedlingsGrownCount = await this.getSeedlingsGrownCount(nurseryId);
    document.addData(nursery.uuid, new NurseryLightDto(nursery, { seedlingsGrownCount }));
  }

  protected async getTotalOverdueReports(nurseryId: number) {
    const countOpts = { where: { dueAt: { [Op.lt]: new Date() } } };
    return await NurseryReport.incomplete().nurseries([nurseryId]).count(countOpts);
  }

  private async getSeedlingsGrownCount(nurseryId: number) {
    return (
      (
        await NurseryReport.nurseries([nurseryId])
          .approved()
          .findAll({
            raw: true,
            attributes: [[fn("SUM", col("seedlings_young_trees")), "seedlingsYoungTrees"]]
          })
      )[0].seedlingsYoungTrees ?? 0
    );
  }

  async delete(nursery: Nursery, userId: number) {
    const user = await User.findOne({ where: { id: userId }, include: [Role] });
    const isAdmin = user?.roles?.some(r => r.name.startsWith("admin"));
    const reports = await NurseryReport.count({ where: { nurseryId: nursery.id } });

    if (!isAdmin && reports > 0) {
      throw new NotAcceptableException("You can only delete nurseries that do not have reports");
    }

    await Action.targetable(Nursery.LARAVEL_TYPE, nursery.id).destroy();
    await nursery.destroy();
  }
}

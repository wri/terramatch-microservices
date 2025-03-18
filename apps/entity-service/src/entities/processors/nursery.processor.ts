import { Media, Nursery, NurseryReport, Project, ProjectUser } from "@terramatch-microservices/database/entities";
import { NurseryLightDto, NurseryFullDto, AdditionalNurseryFullProps, NurseryMedia } from "../dto/nursery.dto";
import { EntityProcessor, PaginatedResult } from "./entity-processor";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { col, fn, Includeable, Op } from "sequelize";
import { BadRequestException } from "@nestjs/common";
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

    const associations = [projectAssociation];
    const builder = await this.entitiesService.buildQuery(Nursery, query, associations);
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

    for (const term of ["status", "updateRequestStatus", "frameworkKey"]) {
      if (query[term] != null) builder.where({ [term]: query[term] });
    }

    // const options = {
    //   projectAssociation: {
    //     where: { name: { [Op.like]: `%${query.search}%` } }
    //   }
    // };

    // const options = {
    //   organisationAssociation: {
    //     where: { name: { [Op.like]: `%${query.search}%` } }
    //   }
    // };

    // if (query.search != null) {
    //   builder.where({
    //     [Op.and]: [
    //       { name: { [Op.like]: `%${query.search}%` } }, // Filtra por nombre en el modelo 'Nursery'
    //       // { '$project.name$': { [Op.like]: `%${query.search}%` } } // Filtra por nombre en el modelo asociado 'Project'
    //     ]
    //   });
    // }

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
}

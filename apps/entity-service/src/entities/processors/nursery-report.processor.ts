import { Media, Nursery, NurseryReport, Project, ProjectUser } from "@terramatch-microservices/database/entities";
import { NurseryLightDto, NurseryFullDto, AdditionalNurseryFullProps, NurseryMedia } from "../dto/nursery.dto";
import { EntityProcessor, PaginatedResult } from "./entity-processor";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { col, fn, Includeable, Op } from "sequelize";
import { BadRequestException } from "@nestjs/common";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { NurseryReportFullDto, NurseryReportMedia } from "../dto/nursery-report.dto";
import { NurseryReportLightDto } from "../dto/nursery-report.dto";

export class NurseryReportProcessor extends EntityProcessor<
  NurseryReport,
  NurseryReportLightDto,
  NurseryReportFullDto
> {
  readonly LIGHT_DTO = NurseryReportLightDto;
  readonly FULL_DTO = NurseryReportFullDto;

  async findOne(uuid: string): Promise<NurseryReport> {
    return await NurseryReport.findOne({
      where: { uuid },
      include: [
        {
          association: "nursery",
          attributes: ["uuid", "name"],
          include: [
            {
              association: "project",
              attributes: ["uuid", "name"],
              include: [{ association: "organisation", attributes: ["uuid", "name"] }]
            }
          ]
        }
      ]
    });
  }

  async findMany(
    query: EntityQueryDto,
    userId?: number,
    permissions?: string[]
  ): Promise<PaginatedResult<NurseryReport>> {
    const projectAssociation: Includeable = {
      association: "nursery",
      attributes: ["uuid", "name"],
      include: [
        {
          association: "project",
          attributes: ["uuid", "name"],
          include: [{ association: "organisation", attributes: ["uuid", "name"] }]
        }
      ]
    };

    const builder = await this.entitiesService.buildQuery(NurseryReport, query, [projectAssociation]);
    if (query.sort != null) {
      if (
        ["name", "status", "updateRequestStatus", "createdAt", "submittedAt", "updatedAt", "frameworkKey"].includes(
          query.sort.field
        )
      ) {
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
      builder.where({ "$nursery.project.id$": { [Op.in]: ProjectUser.userProjectsSubquery(userId) } });
    } else if (permissions?.includes("projects-manage")) {
      builder.where({ "$nursery.project.id$": { [Op.in]: ProjectUser.projectsManageSubquery(userId) } });
    }

    const associationFieldMap = {
      nurseryUuid: "$nursery.uuid$",
      organisationUuid: "$project.organisation.uuid$",
      country: "$project.country$",
      projectUuid: "$project.uuid$"
    };

    for (const term of ["status", "updateRequestStatus", "frameworkKey"]) {
      if (query[term] != null) {
        const field = associationFieldMap[term] || term;
        builder.where({ [field]: query[term] });
      }
    }

    if (query.search != null) {
      builder.where({
        [Op.or]: [
          { name: { [Op.like]: `%${query.search}%` } },
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
      builder.where({ "$nursery.project.id$": project.id });
    }

    return { models: await builder.execute(), paginationTotal: await builder.paginationTotal() };
  }

  async addFullDto(document: DocumentBuilder, nurseryReport: NurseryReport): Promise<void> {
    const nurseryReportId = nurseryReport.id;

    const nurseryReportsTotal = await NurseryReport.nurseries([nurseryReportId]).count();
    const seedlingsGrownCount = await this.getSeedlingsGrownCount(nurseryReportId);
    const overdueNurseryReportsTotal = await this.getTotalOverdueReports(nurseryReportId);
    const props: AdditionalNurseryFullProps = {
      seedlingsGrownCount,
      nurseryReportsTotal,
      overdueNurseryReportsTotal,

      ...(this.entitiesService.mapMediaCollection(
        await Media.nurseryReport(nurseryReportId).findAll(),
        NurseryReport.MEDIA
      ) as NurseryReportMedia)
    };

    document.addData(nurseryReport.uuid, new NurseryReportFullDto(nurseryReport, props));
  }

  async addLightDto(document: DocumentBuilder, nurseryReport: NurseryReport): Promise<void> {
    const nurseryReportId = nurseryReport.id;

    const seedlingsGrownCount = await this.getSeedlingsGrownCount(nurseryReportId);
    document.addData(nurseryReport.uuid, new NurseryReportLightDto(nurseryReport, { seedlingsGrownCount }));
  }

  protected async getTotalOverdueReports(nurseryId: number) {
    const countOpts = { where: { dueAt: { [Op.lt]: new Date() } } };
    return await NurseryReport.incomplete().nurseries([nurseryId]).count(countOpts);
  }

  private async getSeedlingsGrownCount(nurseryReportId: number) {
    return (
      (
        await NurseryReport.nurseries([nurseryReportId])
          .approved()
          .findAll({
            raw: true,
            attributes: [[fn("SUM", col("seedlings_young_trees")), "seedlingsYoungTrees"]]
          })
      )[0].seedlingsYoungTrees ?? 0
    );
  }
}

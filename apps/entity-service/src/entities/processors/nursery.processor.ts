import {
  Media,
  Nursery,
  NurseryReport,
  Project,
  ProjectUser,
  ScheduledJob,
  Task
} from "@terramatch-microservices/database/entities";
import { NurseryFullDto, NurseryLightDto, NurseryMedia } from "../dto/nursery.dto";
import { EntityProcessor, ExportAllOptions } from "./entity-processor";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { col, fn, Includeable, Op, WhereOptions } from "sequelize";
import {
  BadRequestException,
  InternalServerErrorException,
  NotAcceptableException,
  NotFoundException
} from "@nestjs/common";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { EntityUpdateAttributes } from "../dto/entity-update.dto";
import { EntityCreateAttributes } from "../dto/entity-create.dto";
import { DateTime } from "luxon";
import { Dictionary } from "lodash";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { Archiver } from "archiver";
import { Response } from "express";
import { normalizedFileName } from "@terramatch-microservices/common/util/filenames";
import { ServerResponse } from "node:http";
import { streamZipToResponse } from "@terramatch-microservices/common/util/zip-stream";
import { NurseryReportProcessor } from "./nursery-report.processor";

const SIMPLE_FILTERS: (keyof EntityQueryDto)[] = [
  "status",
  "updateRequestStatus",
  "frameworkKey",
  "organisationUuid",
  "country",
  "projectUuid"
];

const ASSOCIATION_FIELD_MAP = {
  organisationUuid: "$project.organisation.uuid$",
  country: "$project.country$",
  projectUuid: "$project.uuid$"
};

const ADMIN_CSV_COLUMNS: Dictionary<string> = {
  id: "id",
  uuid: "uuid",
  linkToTerramatch: "link_to_terramatch",
  organisationReadableType: "organization-readable_type",
  organisationName: "organization-name",
  projectName: "project_name",
  status: "status",
  updateRequestStatus: "update_request_status",
  createdAt: "created_at",
  updatedAt: "updated_at",
  projectExportId: "project_id"
};

const PD_CSV_COLUMNS: Dictionary<string> = {
  organisationReadableType: "organization-readable_type",
  organisationName: "organization-name",
  projectName: "project_name",
  status: "status",
  updateRequestStatus: "update_request_status",
  createdAt: "created_at",
  updatedAt: "updated_at"
};

const CSV_EXPORT_INCLUDES = [
  {
    association: "project",
    attributes: ["name", "id", "ppcExternalId"],
    include: [{ association: "organisation", attributes: ["name", "type"] }]
  }
];

const CSV_ATTRIBUTES = ["id", "uuid", "projectId", "status", "updateRequestStatus", "createdAt", "updatedAt"];

export class NurseryProcessor extends EntityProcessor<
  Nursery,
  NurseryLightDto,
  NurseryFullDto,
  EntityUpdateAttributes
> {
  readonly LIGHT_DTO = NurseryLightDto;
  readonly FULL_DTO = NurseryFullDto;

  async findOne(uuid: string) {
    return await Nursery.findOne({
      where: { uuid },
      include: [
        {
          association: "project",
          attributes: ["uuid", "name"],
          include: [{ association: "organisation", attributes: ["name", "uuid"] }]
        }
      ]
    });
  }

  async findMany(query: EntityQueryDto) {
    const projectAssociation: Includeable = {
      association: "project",
      attributes: ["uuid", "name"],
      include: [{ association: "organisation", attributes: ["name"] }]
    };

    const builder = await this.entitiesService.buildQuery(Nursery, query, [projectAssociation]);
    if (query.sort?.field != null) {
      if (["name", "startDate", "status", "updateRequestStatus", "createdAt"].includes(query.sort.field)) {
        builder.order([[query.sort.field, query.sort.direction ?? "ASC"]]);
      } else if (query.sort.field === "organisationName") {
        builder.order([["project", "organisation", "name", query.sort.direction ?? "ASC"]]);
      } else if (query.sort.field === "projectName") {
        builder.order([["project", "name", query.sort.direction ?? "ASC"]]);
      } else if (query.sort.field !== "id") {
        throw new BadRequestException(`Invalid sort field: ${query.sort.field}`);
      }
    }

    const permissions = this.entitiesService.permissions;
    const frameworkPermissions =
      permissions
        ?.filter(name => name.startsWith("framework-"))
        .map(name => name.substring("framework-".length) as FrameworkKey) ?? [];
    if (frameworkPermissions.length > 0) {
      builder.where({ frameworkKey: { [Op.in]: frameworkPermissions } });
    } else if (permissions?.includes("manage-own")) {
      builder.where({
        projectId: { [Op.in]: ProjectUser.userProjectsSubquery(this.entitiesService.userId as number) }
      });
    } else if (permissions?.includes("projects-manage")) {
      builder.where({
        projectId: { [Op.in]: ProjectUser.projectsManageSubquery(this.entitiesService.userId as number) }
      });
    }

    for (const term of SIMPLE_FILTERS) {
      if (query[term] != null) {
        const field = ASSOCIATION_FIELD_MAP[term] ?? term;
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

  async getFullDto(nursery: Nursery) {
    const nurseryId = nursery.id;

    const nurseryReportsTotal = await NurseryReport.nurseries([nurseryId]).count();
    const seedlingsGrownCount = await this.getSeedlingsGrownCount(nurseryId);
    const overdueNurseryReportsTotal = await this.getTotalOverdueReports(nurseryId);

    const dto = new NurseryFullDto(nursery, {
      ...(await this.getFeedback(nursery)),

      seedlingsGrownCount,
      nurseryReportsTotal,
      overdueNurseryReportsTotal,
      ...(this.entitiesService.mapMediaCollection(
        await Media.for(nursery).findAll(),
        Nursery.MEDIA,
        "nurseries",
        nursery.uuid
      ) as NurseryMedia)
    });

    await this.entitiesService.removeHiddenValues(nursery, dto);

    return { id: nursery.uuid, dto };
  }

  async getLightDto(nursery: Nursery) {
    const nurseryId = nursery.id;

    const seedlingsGrownCount = await this.getSeedlingsGrownCount(nurseryId);
    return { id: nursery.uuid, dto: new NurseryLightDto(nursery, { seedlingsGrownCount }) };
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

  async delete(nursery: Nursery) {
    const permissions = this.entitiesService.permissions;
    const managesOwn =
      permissions?.includes("manage-own") && !permissions.includes(`framework-${nursery.frameworkKey}`);
    if (managesOwn) {
      const reportCount = await NurseryReport.count({ where: { nurseryId: nursery.id } });
      if (reportCount > 0) {
        throw new NotAcceptableException("You can only delete nurseries that do not have reports");
      }
    }

    await super.delete(nursery);
  }

  async create({ parentUuid }: EntityCreateAttributes) {
    const project = await Project.findOne({ where: { uuid: parentUuid }, attributes: ["frameworkKey", "id"] });
    if (project == null) {
      throw new BadRequestException(`Project with uuid ${parentUuid} not found`);
    }

    const nursery = await this.authorizedCreation(Nursery, {
      projectId: project.id,
      frameworkKey: project.frameworkKey
    });

    const task = await Task.forProject(project.id).dueAtDesc().findOne();
    if (task != null) {
      // If we have a task due in the future, create a report
      let createReport = DateTime.now() <= DateTime.fromJSDate(task.dueAt);

      // Also, if we're more than 4 weeks before the next task will be generated, create a backdated
      // report for the previous period.
      if (!createReport) {
        const nextTask =
          project.frameworkKey == null ? undefined : await ScheduledJob.taskDue(project.frameworkKey).findOne();
        createReport =
          nextTask != null && DateTime.fromISO(nextTask.taskDefinition["dueAt"]) > DateTime.now().plus({ weeks: 4 });
      }

      if (createReport) {
        await NurseryReport.create({
          taskId: task.id,
          frameworkKey: project.frameworkKey,
          nurseryId: nursery.id,
          dueAt: task.dueAt,
          createdBy: this.entitiesService.userId
        });
      }
    }

    // Load the full nursery with necessary associations.
    return (await this.findOne(nursery.uuid)) as Nursery;
  }

  async export(uuid: string, target: Response | Archiver) {
    const nursery = await Nursery.findOne({ where: { uuid }, include: CSV_EXPORT_INCLUDES });
    if (nursery == null) throw new NotFoundException();

    const { frameworkKey } = nursery;
    if (frameworkKey == null) throw new InternalServerErrorException("Cannot export without a framework key");

    await this.entitiesService.authorize("read", nursery);

    const fillArchive = async (archive: Archiver) => {
      const fileNamePrefix = `${nursery.projectName} - ${nursery.name}`;
      await this.entitiesService.entityExport("nurseries", PD_CSV_COLUMNS, [nursery], {
        target: archive,
        frameworkKey,
        fileName: normalizedFileName(`${fileNamePrefix} - nursery establishment data`)
      });

      const reportProcessor = this.entitiesService.createEntityProcessor("nurseryReports") as NurseryReportProcessor;
      await reportProcessor.exportAll({ target: archive, frameworkKey, nurseryId: nursery.id, fileNamePrefix });
    };

    if (target instanceof ServerResponse) {
      await streamZipToResponse(`${nursery.name} export`, target, fillArchive);
    } else {
      await fillArchive(target);
    }
  }

  async exportAll({ target, frameworkKey, projectUuid, fileNamePrefix }: ExportAllOptions = {}) {
    const where: WhereOptions<Nursery> = {};
    if (projectUuid != null) {
      frameworkKey ??=
        (await Project.findOne({ where: { uuid: projectUuid }, attributes: ["frameworkKey"] }))?.frameworkKey ??
        undefined;
      where["$project.uuid$"] = projectUuid;
    } else {
      where.frameworkKey = frameworkKey;
      where["$project.is_test$"] = false;
      const permissions = this.entitiesService.permissions;
      if (permissions?.includes("manage-own")) {
        where["projectId"] = { [Op.in]: ProjectUser.userProjectsSubquery(this.entitiesService.userId as number) };
      } else if (permissions?.includes("projects-manage")) {
        where["projectId"] = { [Op.in]: ProjectUser.projectsManageSubquery(this.entitiesService.userId as number) };
      }
    }
    if (frameworkKey == null) throw new InternalServerErrorException("Framework key not found");
    await this.entitiesService.entityExport(
      "nurseries",
      ADMIN_CSV_COLUMNS,
      new PaginatedQueryBuilder(Nursery, 10, CSV_EXPORT_INCLUDES).where(where),
      {
        attributes: CSV_ATTRIBUTES,
        target,
        frameworkKey,
        ability: target instanceof ServerResponse ? "read" : undefined,
        fileName:
          fileNamePrefix == null ? undefined : normalizedFileName(`${fileNamePrefix} - nursery establishment data`)
      }
    );
  }
}

import { Controller, Delete, Get, NotFoundException, Param, Query, UnauthorizedException } from "@nestjs/common";
import { ApplicationGetQueryDto, ApplicationIndexQueryDto } from "./dto/application-query.dto";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { ApplicationDto, ApplicationHistoryDto, ApplicationHistoryEntryDto } from "./dto/application.dto";
import { Application, FormSubmission, Project, User } from "@terramatch-microservices/database/entities";
import { PolicyService } from "@terramatch-microservices/common";
import {
  buildDeletedResponse,
  buildJsonApi,
  getDtoType,
  getStableRequestQuery
} from "@terramatch-microservices/common/util";
import { FormDataService } from "../entities/form-data.service";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";
import { Op } from "sequelize";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { EmbeddedSubmissionDto, SubmissionDto } from "../entities/dto/submission.dto";
import { last, uniqBy } from "lodash";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { FormSubmissionStatus } from "@terramatch-microservices/database/constants/status";
import { DateTime } from "luxon";
import { JsonApiDeletedResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";
import { AuditStatusService } from "../entities/audit-status.service";
import { AuditStatusDto } from "../entities/dto/audit-status.dto";
import { AuditStatusType } from "@terramatch-microservices/database/constants";

const FILTER_COLUMNS = ["organisationUuid", "fundingProgrammeUuid"] as const;
const SORT_COLUMNS = ["createdAt", "updatedAt"] as const;

@Controller("applications/v3/applications")
export class ApplicationsController {
  constructor(
    private readonly policyService: PolicyService,
    private readonly formDataService: FormDataService,
    private readonly auditStatusService: AuditStatusService
  ) {}

  @Get()
  @ApiOperation({ operationId: "applicationIndex", summary: "Get a filtered, paginated view of applications" })
  @JsonApiResponse({ data: ApplicationDto, hasMany: true })
  @ExceptionResponse(NotFoundException, { description: "Application not found" })
  @ExceptionResponse(UnauthorizedException, { description: "User is not authorized to access this application" })
  @ExceptionResponse(BadRequestException, { description: "Invalid query params" })
  async index(@Query() query: ApplicationIndexQueryDto) {
    const builder = PaginatedQueryBuilder.forNumberPage(Application, query.page, [
      { association: "organisation", attributes: ["name"] },
      { association: "fundingProgramme", attributes: ["name"] }
    ]);

    const permissions = await this.policyService.getPermissions();
    if (permissions.find(p => p.startsWith("framework-")) == null) {
      const orgUuids = await User.orgUuids(authenticatedUserId());
      builder.where({ organisationUuid: { [Op.in]: orgUuids } });
    }

    if (query.currentSubmissionStatus != null) {
      builder.where({
        [Op.and]: [
          Subquery.select(FormSubmission, "id")
            .innerJoin(
              Subquery.select(FormSubmission, "id", {
                aggregate: { sqlFn: "MAX", groupColumn: "applicationId", as: "idAggregate" },
                additional: ["applicationId"]
              }).literal,
              "currentSubmission",
              "`currentSubmission`.`idAggregate` = `form_submissions`.`id` AND `currentSubmission`.`application_id` = `form_submissions`.`application_id`"
            )
            .eq("status", query.currentSubmissionStatus)
            .eq("applicationId", Subquery.fieldLiteral(Application, "id")).exists
        ]
      });
    }

    for (const column of FILTER_COLUMNS) if (query[column] != null) builder.where({ [column]: query[column] });
    if (query.sort?.field != null) {
      if (SORT_COLUMNS.includes(query.sort.field as (typeof SORT_COLUMNS)[number])) {
        builder.order([query.sort.field, query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "organisationName") {
        builder.order(["organisation", "name", query.sort.direction ?? "ASC"]);
      } else if (query.sort.field !== "id") {
        throw new BadRequestException(`Invalid sort field: ${query.sort.field}`);
      }
    }

    if (query.search != null) {
      builder.where({ "$organisation.name$": { [Op.like]: `%${query.search}%` } });
    }

    const applications = await builder.execute();
    if (applications.length > 0) await this.policyService.authorize("read", applications);

    const applicationIds = applications.map(({ id }) => id);
    const submissions = applications.length === 0 ? [] : await this.findSubmissions(applicationIds);
    const projects = applications.length === 0 ? [] : await this.findProjects(applicationIds);

    return applications.reduce(
      (document, application) => {
        return document.addData(
          application.uuid,
          new ApplicationDto(application, {
            submissions: submissions
              .filter(({ applicationId }) => applicationId === application.id)
              .map(submission => new EmbeddedSubmissionDto(submission)),
            projectUuid: projects.find(({ applicationId }) => applicationId === application.id)?.uuid ?? null
          })
        ).document;
      },
      buildJsonApi(ApplicationDto, { forceDataArray: true }).addIndex({
        requestPath: `/applications/v3/applications${getStableRequestQuery(query)}`,
        total: await builder.paginationTotal(),
        pageNumber: query.page?.number ?? 1
      })
    );
  }

  @Get(":uuid")
  @ApiOperation({ operationId: "applicationGet", summary: "Get a single application by UUID" })
  @JsonApiResponse(ApplicationDto)
  @ExceptionResponse(NotFoundException, { description: "Application not found" })
  @ExceptionResponse(UnauthorizedException, { description: "User is not authorized to access this application" })
  async get(@Param() { uuid }: SingleResourceDto, @Query() { sideloads, translated }: ApplicationGetQueryDto) {
    const application = await Application.findOne({
      where: { uuid },
      include: [
        { association: "organisation", attributes: ["name"] },
        { association: "fundingProgramme", attributes: ["name"] }
      ]
    });
    if (application == null) throw new NotFoundException("Application not found");

    await this.policyService.authorize("read", application);

    const submissions = await this.findSubmissions(application.id);
    const [project] = await this.findProjects(application.id);
    const document = buildJsonApi(ApplicationDto).addData(
      application.uuid,
      new ApplicationDto(application, {
        submissions: submissions.map(submission => new EmbeddedSubmissionDto(submission)),
        projectUuid: project?.uuid ?? null
      })
    ).document;

    if (sideloads?.includes("currentSubmission") && submissions.length > 0) {
      const submission = await this.formDataService.getFullSubmission(submissions[submissions.length - 1].uuid);
      if (submission != null) await this.formDataService.addSubmissionDto(document, submission);
    }

    if (sideloads?.includes("fundingProgramme")) {
      const fundingProgramme = await application.$get("fundingProgramme");
      if (fundingProgramme != null) {
        await this.formDataService.addFundingProgrammeDtos(
          document,
          [fundingProgramme],
          translated === false ? undefined : await User.findLocale(authenticatedUserId())
        );
      }
    }

    return document;
  }

  @Delete(":uuid")
  @ApiOperation({ operationId: "applicationDelete", summary: "Delete an application by UUID" })
  @JsonApiDeletedResponse(getDtoType(ApplicationDto), { description: "Application and its submissions were deleted" })
  @ExceptionResponse(NotFoundException, { description: "Application not found" })
  @ExceptionResponse(UnauthorizedException, { description: "User is not authorized to delete this application" })
  async delete(@Param() { uuid }: SingleResourceDto) {
    const application = await Application.findOne({ where: { uuid }, attributes: ["id", "uuid"] });
    if (application == null) throw new NotFoundException("Application not found");

    await this.policyService.authorize("delete", application);

    const submissions = await FormSubmission.findAll({
      where: { applicationId: application.id },
      attributes: ["id", "uuid"]
    });
    await FormSubmission.destroy({ where: { id: submissions.map(({ id }) => id) } });
    await application.destroy();

    return buildDeletedResponse(
      getDtoType(ApplicationDto),
      application.uuid,
      submissions.map(({ uuid }) => ({ resource: getDtoType(SubmissionDto), id: uuid }))
    );
  }

  @Get(":uuid/history")
  @ApiOperation({ operationId: "applicationHistoryGet", summary: "Get the history for an application by UUID" })
  @JsonApiResponse(ApplicationHistoryDto)
  @ExceptionResponse(NotFoundException, { description: "Application not found" })
  @ExceptionResponse(UnauthorizedException, { description: "User is not authorized to access this application" })
  async getHistory(@Param() { uuid }: SingleResourceDto) {
    const application = await Application.findOne({
      where: { uuid },
      include: [
        { association: "organisation", attributes: ["name"] },
        { association: "fundingProgramme", attributes: ["name"] }
      ]
    });
    if (application == null) throw new NotFoundException("Application not found");

    await this.policyService.authorize("read", application);

    const submissions = await this.findSubmissions(application.id);
    const auditStatusesBySubmissionId = await this.auditStatusService.getAuditStatusesForMultiple(submissions);

    const history: ApplicationHistoryEntryDto[] = [];
    for (const submission of submissions.reverse()) {
      const auditStatusDtos = auditStatusesBySubmissionId.get(submission.id) ?? [];

      for (const dto of auditStatusDtos) {
        const entry = this.createHistoryEntryDtoFromAuditStatusDto(dto, submission.stageName);
        this.addHistoryEntry(history, entry);
      }
    }

    return buildJsonApi(ApplicationHistoryDto).addData(
      application.uuid,
      populateDto(new ApplicationHistoryDto(), {
        applicationUuid: application.uuid,
        entries: history
      })
    );
  }

  private addHistoryEntry(history: ApplicationHistoryEntryDto[], entry: ApplicationHistoryEntryDto) {
    const earliestEntry = last(history);
    const earliestHistoryDate = earliestEntry == null ? undefined : DateTime.fromJSDate(earliestEntry.date);

    if (earliestHistoryDate != null && DateTime.fromJSDate(entry.date) > earliestHistoryDate) {
      return;
    }

    const earliest = last(history);
    if (
      earliest?.eventType === "updated" &&
      entry.eventType === "updated" &&
      DateTime.fromJSDate(earliest.date).diff(DateTime.fromJSDate(entry.date), "hours").hours < 12
    ) {
      return;
    }

    if (
      earliest?.eventType === "updated" &&
      entry.eventType === "status" &&
      entry.status === "started" &&
      DateTime.fromJSDate(earliest.date).diff(DateTime.fromJSDate(entry.date), "hours").hours < 12
    ) {
      history[history.length - 1] = entry;
    } else {
      history.push(entry);
    }
  }

  private createHistoryEntryDtoFromAuditStatusDto(
    dto: AuditStatusDto,
    stageName: string | null
  ): ApplicationHistoryEntryDto {
    let status: FormSubmissionStatus | null = null;
    if (dto.status != null) {
      if (dto.status === "Draft") {
        status = "started";
      } else {
        status = dto.status as FormSubmissionStatus;
      }
    }

    let eventType: AuditStatusType | null = dto.type as AuditStatusType | null;
    if (eventType == null) {
      eventType = status != null ? ("status" as AuditStatusType) : ("updated" as AuditStatusType);
    }

    return populateDto(new ApplicationHistoryEntryDto(), {
      eventType,
      status,
      date: dto.dateCreated ?? new Date(),
      stageName,
      comment: dto.comment
    });
  }

  private async findSubmissions(applicationIds: number | number[]) {
    return await FormSubmission.findAll({
      where: { applicationId: applicationIds },
      attributes: ["applicationId", "id", "uuid", "status", "createdAt", "updatedAt", "stageUuid", "userId"],
      include: [
        { association: "stage", attributes: ["name"] },
        { association: "user", attributes: ["firstName", "lastName"] }
      ]
    });
  }

  private async findProjects(applicationIds: number | number[]) {
    return uniqBy(
      await Project.findAll({
        where: { applicationId: applicationIds },
        order: [["createdAt", "DESC"]],
        attributes: ["applicationId", "uuid"]
      }),
      "applicationId"
    );
  }
}

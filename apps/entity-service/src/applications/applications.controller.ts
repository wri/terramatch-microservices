import { Controller, Delete, Get, NotFoundException, Param, Query, UnauthorizedException } from "@nestjs/common";
import { ApplicationGetQueryDto, ApplicationIndexQueryDto } from "./dto/application-query.dto";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { ApplicationDto, ApplicationHistoryDto, ApplicationHistoryEntryDto } from "./dto/application.dto";
import { Application, Audit, AuditStatus, FormSubmission, User } from "@terramatch-microservices/database/entities";
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
import { groupBy, last } from "lodash";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { FormSubmissionStatus } from "@terramatch-microservices/database/constants/status";
import { DateTime } from "luxon";
import { JsonApiDeletedResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";

const FILTER_COLUMNS = ["organisationUuid", "fundingProgrammeUuid"] as const;
const SORT_COLUMNS = ["createdAt", "updatedAt"] as const;

@Controller("applications/v3")
export class ApplicationsController {
  constructor(private readonly policyService: PolicyService, private readonly formDataService: FormDataService) {}

  @Get()
  @ApiOperation({ operationId: "applicationIndex", summary: "Get a filtered, paginated view of applications" })
  @JsonApiResponse({ data: ApplicationDto, hasMany: true })
  @ExceptionResponse(NotFoundException, { description: "Application not found" })
  @ExceptionResponse(UnauthorizedException, { description: "User is not authorized to access this application" })
  @ExceptionResponse(BadRequestException, { description: "Invalid query params" })
  async indexApplications(@Query() query: ApplicationIndexQueryDto) {
    const builder = PaginatedQueryBuilder.forNumberPage(Application, query.page, [
      { association: "organisation", attributes: ["name"] },
      { association: "fundingProgramme", attributes: ["name"] }
    ]);

    const permissions = await this.policyService.getPermissions();
    if (permissions.find(p => p.startsWith("framework-")) == null) {
      // admins have access to everything, so we just filter what's available for non-admins
      const orgUuids = await User.orgUuids(authenticatedUserId());
      builder.where({ organisationUuid: { [Op.in]: orgUuids } });
    }

    if (query.currentSubmissionStatus != null) {
      // Use EXISTS() with an INNER JOIN to find applications that have a current submission with the given status
      // within our builder query.
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

    const submissions = applications.length === 0 ? [] : await this.findSubmissions(applications.map(({ id }) => id));

    return applications.reduce(
      (document, application) => {
        return document.addData(
          application.uuid,
          new ApplicationDto(application, {
            submissions: submissions
              .filter(({ applicationId }) => applicationId === application.id)
              .map(submission => new EmbeddedSubmissionDto(submission))
          })
        ).document;
      },
      buildJsonApi(ApplicationDto, { forceDataArray: true }).addIndex({
        requestPath: `/applications/v3${getStableRequestQuery(query)}`,
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
  async getApplication(
    @Param() { uuid }: SingleResourceDto,
    @Query() { sideloads, translated }: ApplicationGetQueryDto
  ) {
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
    const document = buildJsonApi(ApplicationDto).addData(
      application.uuid,
      new ApplicationDto(application, {
        submissions: submissions.map(submission => new EmbeddedSubmissionDto(submission))
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
  async deleteApplication(@Param() { uuid }: SingleResourceDto) {
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
  async getApplicationHistory(@Param() { uuid }: SingleResourceDto) {
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
    const audits = groupBy(await Audit.for(submissions).findAll({ order: [["updatedAt", "DESC"]] }), "auditableId");
    const auditStatuses = groupBy(
      await AuditStatus.for(submissions).findAll({ order: [["updatedAt", "DESC"]] }),
      "auditableId"
    );
    const history: ApplicationHistoryEntryDto[] = [];
    // Reverse the submissions so we go through the history of the newest one first
    for (const { id, stageName } of submissions.reverse()) {
      // Consider audit statuses first, as that's the more modern system and will have the most
      // correct data.
      this.addHistory(history, auditStatuses[id] ?? [], stageName);
      this.addHistory(history, audits[id] ?? [], stageName);
    }

    return buildJsonApi(ApplicationHistoryDto).addData(
      application.uuid,
      populateDto(new ApplicationHistoryDto(), {
        applicationUuid: application.uuid,
        entries: history
      })
    );
  }

  private addHistory(history: ApplicationHistoryEntryDto[], audits: Audit[] | AuditStatus[], stageName: string | null) {
    const earliestEntry = last(history);
    const earliestHistoryDate = earliestEntry == null ? undefined : DateTime.fromJSDate(earliestEntry.date);
    const startIndex =
      earliestHistoryDate == null
        ? 0
        : audits.findIndex(
            ({ updatedAt }: Audit | AuditStatus) => DateTime.fromJSDate(updatedAt) <= earliestHistoryDate
          );
    if (startIndex < 0) return;

    for (const audit of audits.slice(startIndex)) {
      const dto = this.createHistoryEntryDto(audit, stageName);
      // don't record back-to-back updated events unless they're at least 12 hours apart
      const earliest = last(history);
      if (
        earliest?.eventType === "updated" &&
        dto.eventType === "updated" &&
        DateTime.fromJSDate(earliest.date).diff(DateTime.fromJSDate(dto.date), "hours").hours < 12
      ) {
        continue;
      }

      // If our earliest history event is an update and this one is "started", and they occurred within
      // 12 hours of each other, replace the update with the started
      if (
        earliest?.eventType === "updated" &&
        dto.eventType === "status" &&
        dto.status === "started" &&
        DateTime.fromJSDate(earliest.date).diff(DateTime.fromJSDate(dto.date), "hours").hours < 12
      ) {
        history[history.length - 1] = dto;
      } else {
        history.push(dto);
      }
    }
  }

  private createHistoryEntryDto(audit: Audit | AuditStatus, stageName: string | null) {
    if (audit instanceof AuditStatus) {
      return populateDto(new ApplicationHistoryEntryDto(), {
        eventType: audit.type,
        status: audit.status as FormSubmissionStatus,
        date: audit.updatedAt,
        stageName,
        comment: audit.comment
      });
    } else {
      const status = (audit.newValues?.status ?? null) as FormSubmissionStatus | null;
      const eventType = audit.event === "updated" && status == null ? audit.event : "status";
      const comment = eventType === "updated" ? null : (audit.newValues?.feedback as string) ?? null;
      return populateDto(new ApplicationHistoryEntryDto(), {
        eventType,
        status,
        date: audit.updatedAt,
        stageName,
        comment
      });
    }
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
}

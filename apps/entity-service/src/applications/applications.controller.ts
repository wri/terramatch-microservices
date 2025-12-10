import { Controller, Get, NotFoundException, Param, Query, UnauthorizedException } from "@nestjs/common";
import { ApplicationGetQueryDto, ApplicationIndexQueryDto } from "./dto/application-query.dto";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { ApplicationDto, SubmissionReferenceDto } from "./dto/application.dto";
import { Application, FormSubmission, User } from "@terramatch-microservices/database/entities";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { FormDataService } from "../entities/form-data.service";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";
import { Op } from "sequelize";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";

const FILTER_COLUMNS = ["organisationUuid", "fundingProgrammeUuid"] as const;
const SORT_COLUMNS = ["createdAt", "updatedAt"] as const;

@Controller("applications/v3")
export class ApplicationsController {
  constructor(private readonly policyService: PolicyService, private readonly formDataService: FormDataService) {}

  @Get()
  @ApiOperation({ operationId: "applicationIndex", summary: "Get a filtered, paginated view of applications" })
  @JsonApiResponse(ApplicationDto)
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

    const submissions =
      applications.length === 0
        ? []
        : await FormSubmission.findAll({
            where: { applicationId: applications.map(({ id }) => id) },
            attributes: ["applicationId", "uuid", "status"]
          });

    return applications.reduce(
      (document, application) => {
        return document.addData(
          application.uuid,
          new ApplicationDto(application, {
            submissions: submissions
              .filter(({ applicationId }) => applicationId === application.id)
              .map(submission => new SubmissionReferenceDto(submission))
          })
        ).document;
      },
      buildJsonApi(ApplicationDto, { forceDataArray: true }).addIndex({
        requestPath: `/applications/v3${getStableRequestQuery(query)}`,
        total: await builder.paginationTotal()
      })
    );
  }

  @Get(":uuid")
  @ApiOperation({ operationId: "applicationGet", summary: "Get a single application by UUID" })
  @JsonApiResponse(ApplicationDto)
  @ExceptionResponse(NotFoundException, { description: "Application not found" })
  @ExceptionResponse(UnauthorizedException, { description: "User is not authorized to access this application" })
  async getApplication(@Param() { uuid }: SingleResourceDto, @Query() { sideloads }: ApplicationGetQueryDto) {
    const application = await Application.findOne({
      where: { uuid },
      include: [
        { association: "organisation", attributes: ["name"] },
        { association: "fundingProgramme", attributes: ["name"] }
      ]
    });
    if (application == null) throw new NotFoundException("Application not found");

    await this.policyService.authorize("read", application);

    const submissions = await FormSubmission.findAll({
      where: { applicationId: application.id },
      attributes: ["uuid", "status"]
    });
    const document = buildJsonApi(ApplicationDto).addData(
      application.uuid,
      new ApplicationDto(application, {
        submissions: submissions.map(submission => new SubmissionReferenceDto(submission))
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
          await User.findLocale(authenticatedUserId())
        );
      }
    }

    return document;
  }
}

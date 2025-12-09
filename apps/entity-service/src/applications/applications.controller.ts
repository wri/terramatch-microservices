import { Controller, Get, NotFoundException, Param, Query, UnauthorizedException } from "@nestjs/common";
import { ApplicationGetQueryDto, ApplicationIndexQueryDto } from "./dto/application-query.dto";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { ApplicationDto } from "./dto/application.dto";
import { Application, FormSubmission, User } from "@terramatch-microservices/database/entities";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { FormDataService } from "../entities/form-data.service";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";
import { Op } from "sequelize";

@Controller("applications/v3")
export class ApplicationsController {
  constructor(private readonly policyService: PolicyService, private readonly formDataService: FormDataService) {}

  @Get()
  @ApiOperation({ operationId: "applicationIndex", summary: "Get a filtered, paginated view of applications" })
  @JsonApiResponse(ApplicationDto)
  @ExceptionResponse(NotFoundException, { description: "Application not found" })
  @ExceptionResponse(UnauthorizedException, { description: "User is not authorized to access this application" })
  async indexApplications(@Query() query: ApplicationIndexQueryDto) {
    const builder = PaginatedQueryBuilder.forNumberPage(Application, query.page, [
      { association: "organisation", attributes: ["name"] },
      { association: "fundingProgramme", attributes: ["uuid", "name"] }
    ]);

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

    const applications = await builder.execute();

    await this.policyService.authorize("read", applications);

    const currentSubmissions = await FormSubmission.findAll({
      where: {
        id: {
          [Op.in]: Subquery.select(FormSubmission, "id", {
            aggregate: { sqlFn: "MAX", groupColumn: "applicationId" }
          }).in(
            "applicationId",
            applications.map(({ id }) => id)
          ).literal
        }
      },
      attributes: ["applicationId", "uuid", "status"]
    });

    return applications.reduce(
      (document, application) => {
        const currentSubmission = currentSubmissions.find(({ applicationId }) => applicationId === application.id);
        return document.addData(
          application.uuid,
          new ApplicationDto(application, {
            currentSubmissionUuid: currentSubmission?.uuid ?? null,
            currentSubmissionStatus: currentSubmission?.status ?? null
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

    const currentSubmission = await FormSubmission.findOne({
      where: { applicationId: application.id },
      order: [["id", "DESC"]],
      attributes: ["uuid", "status"]
    });
    const document = buildJsonApi(ApplicationDto).addData(
      application.uuid,
      new ApplicationDto(application, {
        currentSubmissionUuid: currentSubmission?.uuid ?? null,
        currentSubmissionStatus: currentSubmission?.status ?? null
      })
    ).document;

    if (sideloads?.includes("currentSubmission") && currentSubmission != null) {
      const submission = await this.formDataService.getFullSubmission(currentSubmission.uuid);
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

import { Controller, Get, NotFoundException, Param, Query, UnauthorizedException } from "@nestjs/common";
import { ApplicationGetQueryDto } from "./dto/application-query.dto";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { ApplicationDto } from "./dto/application.dto";
import { Application, FormSubmission, User } from "@terramatch-microservices/database/entities";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { FormDataService } from "../entities/form-data.service";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";

@Controller("applications/v3")
export class ApplicationsController {
  constructor(private readonly policyService: PolicyService, private readonly formDataService: FormDataService) {}

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

    const currentSubmissionUuid =
      (
        await FormSubmission.findOne({
          where: { applicationId: application.id },
          order: [["id", "DESC"]],
          attributes: ["uuid"]
        })
      )?.uuid ?? null;
    const document = buildJsonApi(ApplicationDto).addData(
      application.uuid,
      new ApplicationDto(application, { currentSubmissionUuid })
    ).document;

    if (sideloads?.includes("currentSubmission") && currentSubmissionUuid != null) {
      const submission = await this.formDataService.getFullSubmission(currentSubmissionUuid);
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

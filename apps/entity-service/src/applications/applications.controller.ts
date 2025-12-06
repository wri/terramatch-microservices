import { Controller, Get, NotFoundException, Param, UnauthorizedException } from "@nestjs/common";
import { SingleApplicationDto } from "./dto/application-query.dto";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { ApplicationDto } from "./dto/application.dto";
import { Application, FormSubmission } from "@terramatch-microservices/database/entities";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi } from "@terramatch-microservices/common/util";

@Controller("applications/v3/applications")
export class ApplicationsController {
  constructor(private readonly policyService: PolicyService) {}

  @Get(":uuid")
  @ApiOperation({ operationId: "applicationGet", summary: "Get a single application by UUID" })
  @JsonApiResponse(ApplicationDto)
  @ExceptionResponse(NotFoundException, { description: "Application not found" })
  @ExceptionResponse(UnauthorizedException, { description: "User is not authorized to access this application" })
  async getApplication(@Param() { uuid }: SingleApplicationDto) {
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
    return buildJsonApi(ApplicationDto).addData(
      application.uuid,
      new ApplicationDto(application, { currentSubmissionUuid })
    );
  }
}

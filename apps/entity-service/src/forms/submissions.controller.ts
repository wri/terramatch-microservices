import { Controller, Get, NotFoundException, Param, UnauthorizedException } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { SubmissionDto } from "../entities/dto/submission.dto";
import { FormDataService } from "../entities/form-data.service";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";

@Controller("forms/v3/submissions")
export class SubmissionsController {
  constructor(private readonly policyService: PolicyService, private readonly formDataService: FormDataService) {}

  @Get(":uuid")
  @ApiOperation({ operationId: "submissionGet", summary: "Get a single form submission by UUID" })
  @JsonApiResponse(SubmissionDto)
  @ExceptionResponse(NotFoundException, { description: "Submission not found" })
  @ExceptionResponse(UnauthorizedException, { description: "User is not authorized to access this submission" })
  async submissionGet(@Param() { uuid }: SingleResourceDto) {
    const submission = await this.formDataService.getFullSubmission(uuid);
    if (submission == null) throw new NotFoundException("Submission not found");
    await this.policyService.authorize("read", submission);

    return await this.formDataService.addSubmissionDto(buildJsonApi(SubmissionDto), submission);
  }
}

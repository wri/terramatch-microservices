import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { SingleSubmissionDto } from "../entities/dto/submission-query.dto";
import { ApiOperation } from "@nestjs/swagger";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { SubmissionDto } from "../entities/dto/submission.dto";
import { FormDataService } from "../entities/form-data.service";

@Controller("forms/v3/submissions")
export class SubmissionsController {
  constructor(private readonly policyService: PolicyService, private readonly formDataService: FormDataService) {}

  @Get(":uuid")
  @ApiOperation({ operationId: "submissionGet", summary: "Get a single form submission by UUID" })
  async submissionGet(@Param() { uuid }: SingleSubmissionDto) {
    const submission = await this.formDataService.getFullSubmission(uuid);
    if (submission == null) throw new NotFoundException("Submission not found");
    await this.policyService.authorize("read", submission);

    return buildJsonApi(SubmissionDto).addData(
      submission.uuid,
      await this.formDataService.getSubmissionDto(submission)
    );
  }
}

import { Body, Controller, Get, NotFoundException, Param, Post, UnauthorizedException } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { CreateSubmissionBody, SubmissionDto } from "../entities/dto/submission.dto";
import { FormDataService } from "../entities/form-data.service";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { Application, Form, FormSubmission, ProjectPitch, User } from "@terramatch-microservices/database/entities";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";

@Controller("forms/v3/submissions")
export class SubmissionsController {
  constructor(private readonly policyService: PolicyService, private readonly formDataService: FormDataService) {}

  @Get(":uuid")
  @ApiOperation({ operationId: "submissionGet", summary: "Get a single form submission by UUID" })
  @JsonApiResponse(SubmissionDto)
  @ExceptionResponse(NotFoundException, { description: "Submission not found" })
  @ExceptionResponse(UnauthorizedException, { description: "User is not authorized to access this submission" })
  async get(@Param() { uuid }: SingleResourceDto) {
    const submission = await this.formDataService.getFullSubmission(uuid);
    if (submission == null) throw new NotFoundException("Submission not found");
    await this.policyService.authorize("read", submission);

    return await this.formDataService.addSubmissionDto(buildJsonApi(SubmissionDto), submission);
  }

  @Post()
  @ApiOperation({ operationId: "submissionCreate", description: "Create a new form submission" })
  @JsonApiResponse(SubmissionDto)
  @ExceptionResponse(UnauthorizedException, { description: "Form submission creation not allowed." })
  @ExceptionResponse(BadRequestException, { description: "Form submission payload malformed." })
  async create(@Body() payload: CreateSubmissionBody) {
    const { formUuid } = payload.data.attributes;
    const form =
      formUuid == null
        ? undefined
        : await Form.findOne({
            where: { uuid: formUuid },
            include: [{ association: "stage", attributes: ["uuid", "fundingProgrammeId"] }]
          });
    if (form?.stage == null) throw new BadRequestException("Form is not assigned to a stage");

    const user = await User.findByPk(authenticatedUserId(), {
      attributes: ["uuid", "locale"],
      include: [{ association: "organisation" }] // pull full org for DTO creation below
    });
    if (user?.organisation == null) {
      throw new BadRequestException("Authenticated user is not assigned to an organisation");
    }

    const submission = FormSubmission.build({
      formId: formUuid,
      stageUuid: form.stage.uuid,
      userId: user.uuid,
      organisationUuid: user.organisation.uuid,
      answers: {}
    });
    await this.policyService.authorize("create", submission);

    const pitch = await ProjectPitch.create({
      organisationId: user.organisation.uuid,
      fundingProgrammeId: form.stage.fundingProgrammeId
    });
    submission.projectPitchUuid = pitch.uuid;

    const application = await Application.create({
      organisationUuid: user.organisation.uuid,
      fundingProgrammeUuid: form.stage.fundingProgrammeId,
      updatedBy: authenticatedUserId()
    });
    submission.applicationId = application.id;

    await submission.save();
    // assign associations to avoid some additional queries in the DTO builder below
    submission.organisation = user.organisation;
    submission.projectPitch = pitch;

    return await this.formDataService.addSubmissionDto(buildJsonApi(SubmissionDto), submission, form, user.locale);
  }
}

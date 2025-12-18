import { Body, Controller, Get, NotFoundException, Param, Post, Put, UnauthorizedException } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { CreateSubmissionBody, SubmissionDto, UpdateSubmissionBody } from "../entities/dto/submission.dto";
import { FormDataService } from "../entities/form-data.service";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { Application, Form, FormSubmission, ProjectPitch, User } from "@terramatch-microservices/database/entities";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";
import { FormDataDto } from "../entities/dto/form-data.dto";
import { isEmpty } from "lodash";

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

  @Put()
  @ApiOperation({ operationId: "submissionUpdate", summary: "Update form submission." })
  @JsonApiResponse(FormDataDto)
  @ExceptionResponse(BadRequestException, { description: "Request params are invalid" })
  @ExceptionResponse(NotFoundException, { description: "Form submission or associated form not found" })
  @ExceptionResponse(UnauthorizedException, {
    description: "Current user is not authorized to access this form submission"
  })
  async update(@Param() { uuid }: SingleResourceDto, @Body() payload: UpdateSubmissionBody) {
    if (payload.data.id !== uuid) throw new BadRequestException("Submission id in path and payload do not match");

    const submission = await this.formDataService.getFullSubmission(uuid);
    if (submission == null) throw new NotFoundException("Submission not found");

    const form = submission.formId == null ? undefined : await Form.findOne({ where: { uuid: submission.formId } });
    if (form == null) throw new NotFoundException("Form for submission not found");

    const user = await User.findOne({ where: { id: authenticatedUserId() }, attributes: ["uuid", "locale"] });

    const attributes = payload.data.attributes;
    if (attributes.answers != null) {
      await this.policyService.authorize("updateAnswers", submission);
      await this.formDataService.storeSubmissionAnswers(submission, form, attributes.answers);

      await submission.update({ userId: user?.uuid });
      if (submission.applicationId != null) {
        await Application.update({ updatedBy: authenticatedUserId() }, { where: { id: submission.applicationId } });
      }
    }

    const hasFeedback = attributes.feedback != null || !isEmpty(attributes.feedbackFields);
    if (attributes.status != null || hasFeedback) {
      await this.policyService.authorize("update", submission);
      const updates: Parameters<typeof submission.update>[0] = {};
      if (attributes.status != null) {
        updates.status = attributes.status;
      }
      if (hasFeedback) {
        updates.feedback = attributes.feedback;
        updates.feedbackFields = attributes.feedbackFields;
      }
      await submission.update(updates);
    }

    return await this.formDataService.addSubmissionDto(buildJsonApi(SubmissionDto), submission, form, user?.locale);
  }
}

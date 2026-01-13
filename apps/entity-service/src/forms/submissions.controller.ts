import { Body, Controller, Get, NotFoundException, Param, Post, Put, UnauthorizedException } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { CreateSubmissionBody, SubmissionDto, UpdateSubmissionBody } from "../entities/dto/submission.dto";
import { FormDataService } from "../entities/form-data.service";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import {
  Application,
  AuditStatus,
  Form,
  FormSubmission,
  FundingProgramme,
  ProjectPitch,
  User
} from "@terramatch-microservices/database/entities";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";
import { FormDataDto } from "../entities/dto/form-data.dto";

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
    const { fundingProgrammeUuid, nextStageFromSubmissionUuid } = payload.data.attributes;
    const programme = await FundingProgramme.findOne({
      where: { uuid: fundingProgrammeUuid },
      include: [{ association: "stages", attributes: ["uuid", "order"], order: [["order", "ASC"]] }]
    });
    if (programme == null) throw new BadRequestException("Funding programme not found");
    if (programme.stages == null || programme.stages.length === 0) {
      throw new BadRequestException("Funding programme has no stages");
    }

    const previousSubmission =
      nextStageFromSubmissionUuid == null
        ? undefined
        : await FormSubmission.findOne({
            where: { uuid: nextStageFromSubmissionUuid },
            include: [{ association: "projectPitch" }]
          });
    if (nextStageFromSubmissionUuid != null && previousSubmission == null) {
      throw new BadRequestException("Previous submission not found");
    }
    const stageIndex =
      previousSubmission == null
        ? 0
        : programme.stages.findIndex(stage => stage.uuid === previousSubmission.stageUuid) + 1;
    if (previousSubmission != null) {
      if (previousSubmission.status !== "approved") {
        throw new BadRequestException("Previous submission is not approved");
      }
      if (previousSubmission.applicationId == null || previousSubmission.projectPitchUuid == null) {
        throw new BadRequestException("Previous submission is missing an application or project pitch");
      }
      if (stageIndex === 0) {
        throw new BadRequestException("Previous submission stage not found in funding programme");
      }
    }

    const stageUuid = programme.stages[stageIndex]?.uuid;
    if (stageUuid == null) {
      throw new BadRequestException("There is no next stage in the funding programme");
    }

    const form = await Form.findOne({ where: { stageId: stageUuid } });
    if (form == null) throw new BadRequestException("Form for stage not found");

    const user = await User.findByPk(authenticatedUserId(), {
      attributes: ["uuid", "locale"],
      include: [{ association: "organisation" }] // pull full org for DTO creation below
    });
    if (user?.organisation == null) {
      throw new BadRequestException("Authenticated user is not assigned to an organisation");
    }

    const submission = FormSubmission.build({
      formId: form.uuid,
      stageUuid: stageUuid,
      userId: user.uuid,
      organisationUuid: user.organisation.uuid,
      answers: {}
    });
    await this.policyService.authorize("create", submission);

    const pitch =
      previousSubmission?.projectPitch ??
      (await ProjectPitch.create({
        organisationId: user.organisation.uuid,
        fundingProgrammeId: programme.uuid
      }));
    submission.projectPitchUuid = pitch.uuid;

    submission.applicationId =
      previousSubmission?.applicationId ??
      (
        await Application.create({
          organisationUuid: user.organisation.uuid,
          fundingProgrammeUuid: programme.uuid,
          updatedBy: authenticatedUserId()
        })
      ).id;
    if (previousSubmission?.applicationId != null) {
      await Application.update(
        { updatedBy: authenticatedUserId() },
        { where: { id: previousSubmission?.applicationId } }
      );
    }

    await submission.save();
    // assign associations to avoid some additional queries in the DTO builder below
    submission.organisation = user.organisation;
    submission.projectPitch = pitch;

    return await this.formDataService.addSubmissionDto(buildJsonApi(SubmissionDto), submission, form, user.locale);
  }

  @Put(":uuid")
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

    if (attributes.status != null && attributes.status !== submission.status) {
      await this.policyService.authorize("update", submission);

      if (attributes.status != "awaiting-approval") {
        submission.feedback = attributes.feedback ?? null;
        submission.feedbackFields = attributes.feedbackFields ?? null;
      }

      submission.status = attributes.status;

      await submission.save();
    } else {
      await AuditStatus.ensureRecentAudit(submission, authenticatedUserId());
    }

    return await this.formDataService.addSubmissionDto(buildJsonApi(SubmissionDto), submission, form, user?.locale);
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UnprocessableEntityException
} from "@nestjs/common";
import { UserAssociationService } from "./user-association.service";
import { ApiOperation } from "@nestjs/swagger";
import { UserAssociationDto } from "./dto/user-association.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildDeletedResponse, buildJsonApi } from "@terramatch-microservices/common/util";
import { UserAssociationCreateBody } from "./dto/user-association-create.dto";
import { UserAssociationUpdateBody } from "./dto/user-association-update.dto";
import { PolicyService } from "@terramatch-microservices/common";
import { UserAssociationQueryDto } from "./dto/user-association-query.dto";
import { UserAssociationDeleteQueryDto } from "./dto/user-association-delete-query.dto";
import { UserAssociationModelParamDto } from "./dto/user-association-model.dto";
import { UserAssociationUpdateParamDto } from "./dto/user-association-update-param.dto";
import { OrganisationInviteRequestDto } from "./dto/organisation-invite-request.dto";
import { OrganisationInviteParamDto } from "./dto/organisation-invite-param.dto";
import { OrganisationInviteDto } from "@terramatch-microservices/common/dto";
import { ProjectInviteAcceptBodyDto } from "./dto/project-invite-accept-body.dto";
import { ProjectInviteAcceptanceDto } from "./dto/project-invite-acceptance.dto";
import { Organisation } from "@terramatch-microservices/database/entities";

@Controller("userAssociations/v3/:model")
export class UserAssociationController {
  constructor(
    private readonly userAssociationService: UserAssociationService,
    private readonly policyService: PolicyService
  ) {}

  @Get(":uuid")
  @ApiOperation({
    operationId: "getUserAssociation",
    summary: "Get the users associated with a project or organisation"
  })
  @JsonApiResponse([{ data: UserAssociationDto, hasMany: true }])
  @ExceptionResponse(NotFoundException, { description: "Resource not found" })
  async getUserAssociation(
    @Param() { model, uuid }: UserAssociationModelParamDto,
    @Query() query: UserAssociationQueryDto
  ) {
    const processor = this.userAssociationService.createProcessor(model, uuid);
    const entity = await processor.getEntity();
    await this.policyService.authorize(processor.readPolicy, entity);
    const document = buildJsonApi(UserAssociationDto, { forceDataArray: true });
    await processor.addDtos(document, query);
    return document;
  }

  @Post(":uuid")
  @ApiOperation({
    operationId: "createUserAssociation",
    summary: "Create a user association for a project, or request to join an organisation"
  })
  @JsonApiResponse({ data: UserAssociationDto })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Resource not found" })
  @ExceptionResponse(BadRequestException, { description: "Request params are malformed." })
  async createUserAssociation(
    @Param() { model, uuid }: UserAssociationModelParamDto,
    @Body() body?: UserAssociationCreateBody
  ) {
    const processor = this.userAssociationService.createProcessor(model, uuid);
    const entity = await processor.getEntity();
    await this.policyService.authorize(processor.createPolicy, entity);
    const document = buildJsonApi(UserAssociationDto);
    await processor.handleCreate(document, body, this.policyService.userId as number);
    return document;
  }

  @Patch(":uuid/:userUuid")
  @ApiOperation({
    operationId: "updateUserAssociation",
    summary: "Approve or reject a user's join request to an organisation"
  })
  @JsonApiResponse({ data: UserAssociationDto })
  @ExceptionResponse(UnauthorizedException, {
    description: "User not authorized to approve/reject join requests."
  })
  @ExceptionResponse(NotFoundException, { description: "Resource or user not found." })
  @ExceptionResponse(BadRequestException, { description: "Request is invalid." })
  async updateUserAssociation(
    @Param() { model, uuid, userUuid }: UserAssociationUpdateParamDto,
    @Body() body: UserAssociationUpdateBody
  ) {
    const processor = this.userAssociationService.createProcessor(model, uuid);
    const entity = await processor.getEntity();
    await this.policyService.authorize(processor.approveRejectPolicy, entity);
    const document = buildJsonApi(UserAssociationDto);
    await processor.handleUpdate(document, userUuid, body.data.attributes.status);
    return document;
  }

  @Post(":uuid/invite")
  @ApiOperation({
    operationId: "inviteOrganisationUser",
    summary: "Invite a new user to join an organisation"
  })
  @JsonApiResponse({ data: OrganisationInviteDto })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Organisation not found" })
  @ExceptionResponse(BadRequestException, { description: "Request params are malformed." })
  @ExceptionResponse(UnprocessableEntityException, {
    description: "A user with this email already exists."
  })
  async inviteOrganisationUser(
    @Param() { uuid }: OrganisationInviteParamDto,
    @Body() body: OrganisationInviteRequestDto
  ) {
    const processor = this.userAssociationService.createProcessor("organisations", uuid);
    const organisation = await processor.getEntity();
    await this.policyService.authorize("update", organisation);

    const invite = await this.userAssociationService.inviteOrganisationUser(
      organisation as never,
      body.emailAddress,
      body.callbackUrl
    );

    return buildJsonApi(OrganisationInviteDto).addData(invite.uuid, new OrganisationInviteDto(invite)).document;
  }

  @Post("invites/accept")
  @ApiOperation({
    operationId: "acceptProjectInvite",
    summary: "Accept a project invite by token"
  })
  @JsonApiResponse({ data: ProjectInviteAcceptanceDto })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or user not found."
  })
  @ExceptionResponse(NotFoundException, {
    description: "Project invite not found or project associated with invite not found."
  })
  @ExceptionResponse(BadRequestException, {
    description: "Project invite has already been accepted, or this endpoint is only available for projects."
  })
  async acceptProjectInvite(@Param("model") model: string, @Body() body: ProjectInviteAcceptBodyDto) {
    if (model !== "projects") {
      throw new BadRequestException("This endpoint is only available for projects");
    }

    const userId = this.policyService.userId;
    if (userId == null) {
      throw new UnauthorizedException("User must be authenticated");
    }

    const { invite, project } = await this.userAssociationService.acceptProjectInvite(body.token, userId);

    const document = buildJsonApi(ProjectInviteAcceptanceDto);
    document.addData(invite.uuid, new ProjectInviteAcceptanceDto(invite, project.name ?? null));

    return document;
  }

  @Delete(":uuid")
  @ApiOperation({
    operationId: "deleteUserAssociation",
    summary: "Delete user associations for a project or organisation"
  })
  @JsonApiResponse({ data: UserAssociationDto })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Resource not found" })
  async deleteUserAssociations(
    @Param() { model, uuid }: UserAssociationModelParamDto,
    @Query() query: UserAssociationDeleteQueryDto
  ) {
    const processor = this.userAssociationService.createProcessor(model, uuid);
    const entity = await processor.getEntity();
    await this.policyService.authorize(processor.updatePolicy, entity);
    await processor.handleDelete(query.uuids);
    return buildDeletedResponse("associatedUsers", query.uuids);
  }
}

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
  UnauthorizedException
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
    @Param() { model, uuid }: UserAssociationModelParamDto,
    @Param("userUuid") userUuid: string,
    @Body() body: UserAssociationUpdateBody
  ) {
    const processor = this.userAssociationService.createProcessor(model, uuid);
    const entity = await processor.getEntity();
    await this.policyService.authorize(processor.approveRejectPolicy, entity);
    const document = buildJsonApi(UserAssociationDto);
    await processor.handleUpdate(document, userUuid, body.data.attributes.status);
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

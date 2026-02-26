import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UnauthorizedException
} from "@nestjs/common";
import { UserAssociationService } from "./user-association.service";
import { Organisation, Project } from "@terramatch-microservices/database/entities";
import { ApiOperation } from "@nestjs/swagger";
import { UserAssociationDto } from "./dto/user-association.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildDeletedResponse, buildJsonApi } from "@terramatch-microservices/common/util";
import { UserAssociationCreateBody } from "./dto/user-association-create.dto";
import { PolicyService } from "@terramatch-microservices/common";
import { UserAssociationQueryDto } from "./dto/user-association-query.dto";
import { UserAssociationDeleteQueryDto } from "./dto/user-association-delete-query.dto";

@Controller("userAssociations/v3")
export class UserAssociationController {
  constructor(
    private readonly userAssociationService: UserAssociationService,
    private readonly policyService: PolicyService
  ) {}

  @Get("projects/:uuid")
  @ApiOperation({
    operationId: "getUserAssociation",
    summary: "Get the users associated with a project"
  })
  @JsonApiResponse([{ data: UserAssociationDto, hasMany: true }])
  @ExceptionResponse(NotFoundException, { description: "Project not found" })
  async getUserAssociation(@Param("uuid") uuid: string, @Query() query: UserAssociationQueryDto) {
    const project = await Project.findOne({
      where: { uuid },
      attributes: ["id", "uuid", "frameworkKey", "organisationId"]
    });
    if (project == null) {
      throw new NotFoundException("Project not found");
    }
    await this.policyService.authorize("read", project);
    const projectUsers = await this.userAssociationService.query(project, query);
    const document = buildJsonApi(UserAssociationDto, { forceDataArray: true });
    await this.userAssociationService.addIndex(document, project, projectUsers, query);
    return document;
  }

  @Post("projects/:uuid")
  @ApiOperation({
    operationId: "createUserAssociation",
    summary: "Create a new user association for a project"
  })
  @JsonApiResponse({ data: UserAssociationDto })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Project not found" })
  @ExceptionResponse(BadRequestException, { description: "Request params are malformed." })
  async createUserAssociation(@Param("uuid") uuid: string, @Body() body: UserAssociationCreateBody) {
    const project = await Project.findOne({
      where: { uuid },
      attributes: ["id", "uuid", "frameworkKey", "organisationId"]
    });
    if (project == null) {
      throw new NotFoundException("Project not found");
    }
    await this.policyService.authorize("update", project);
    const document = buildJsonApi(UserAssociationDto);
    const userAssociation = await this.userAssociationService.createUserAssociation(project, body.data.attributes);
    if (userAssociation != null) {
      document.addData(userAssociation.uuid as string, new UserAssociationDto(userAssociation));
    }
    return document;
  }

  @Delete("projects/:uuid")
  @ApiOperation({
    operationId: "deleteUserAssociation",
    summary: "Delete a user association for a project"
  })
  @JsonApiResponse({ data: UserAssociationDto })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Project not found" })
  async deleteBulkUserAssociations(@Param("uuid") uuid: string, @Query() query: UserAssociationDeleteQueryDto) {
    const project = await Project.findOne({
      where: { uuid },
      attributes: ["id", "uuid", "frameworkKey", "organisationId"]
    });
    if (project == null) {
      throw new NotFoundException("Project not found");
    }
    await this.policyService.authorize("update", project);
    await this.userAssociationService.deleteBulkUserAssociations(project.id, query.uuids);
    return buildDeletedResponse("associatedUsers", query.uuids);
  }

  @Post("organisations/:uuid")
  @ApiOperation({
    operationId: "createOrgUserAssociation",
    summary: "Request to join an existing organisation as the authenticated user"
  })
  @JsonApiResponse({ data: UserAssociationDto })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or user not permitted to request joining organisations."
  })
  @ExceptionResponse(NotFoundException, { description: "Organisation not found." })
  async createOrgUserAssociation(@Param("uuid") uuid: string) {
    const organisation = await Organisation.findOne({
      where: { uuid },
      attributes: ["id", "uuid"]
    });
    if (organisation == null) {
      throw new NotFoundException("Organisation not found");
    }

    await this.policyService.authorize("joinRequest", organisation);

    const user = await this.userAssociationService.requestOrgJoin(organisation, this.policyService.userId as number);

    const document = buildJsonApi(UserAssociationDto);
    document.addData(user.uuid as string, new UserAssociationDto(user, { status: "requested", isManager: false }));
    return document;
  }
}

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
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { OrganisationCreateBody } from "./dto/organisation-create.dto";
import { OrganisationUpdateBody } from "./dto/organisation-update.dto";
import { OrganisationUserUpdateBody } from "./dto/organisation-user-update.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { JsonApiDeletedResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";
import { OrganisationFullDto, OrganisationLightDto, UserDto } from "@terramatch-microservices/common/dto";
import { PolicyService } from "@terramatch-microservices/common";
import { USER_ORG_RELATIONSHIP } from "../users/users.controller";
import { OrganisationCreationService } from "./organisation-creation.service";
import { ApiOperation } from "@nestjs/swagger";
import {
  buildDeletedResponse,
  buildJsonApi,
  getStableRequestQuery,
  getDtoType
} from "@terramatch-microservices/common/util";
import { Organisation, Notification, User } from "@terramatch-microservices/database/entities";
import { OrganisationIndexQueryDto } from "./dto/organisation-query.dto";
import { OrganisationShowQueryDto } from "./dto/organisation-show-query.dto";
import { OrganisationsService } from "./organisations.service";
import { FinancialIndicatorDto } from "@terramatch-microservices/common/dto/financial-indicator.dto";
import { MediaDto } from "@terramatch-microservices/common/dto/media.dto";
import { FundingTypeDto } from "@terramatch-microservices/common/dto/funding-type.dto";
import { FinancialReportLightDto } from "@terramatch-microservices/common/dto/financial-report.dto";
import { LeadershipDto } from "@terramatch-microservices/common/dto/leadership.dto";
import { OwnershipStakeDto } from "@terramatch-microservices/common/dto/ownership-stake.dto";
import { TreeSpeciesDto } from "@terramatch-microservices/common/dto/tree-species.dto";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { OrganisationApprovedEmail } from "@terramatch-microservices/common/email/organisation-approved.email";
import { OrganisationRejectedEmail } from "@terramatch-microservices/common/email/organisation-rejected.email";
import { OrganisationJoinRequestEmail } from "@terramatch-microservices/common/email/organisation-join-request.email";
import { OrganisationUserApprovedEmail } from "@terramatch-microservices/common/email/organisation-user-approved.email";
import { OrganisationUserRejectedEmail } from "@terramatch-microservices/common/email/organisation-user-rejected.email";

@Controller("organisations/v3/organisations")
export class OrganisationsController {
  private readonly logger = new TMLogger(OrganisationsController.name);

  constructor(
    private readonly policyService: PolicyService,
    private readonly organisationsService: OrganisationsService,
    private readonly organisationCreationService: OrganisationCreationService,
    @InjectQueue("email") private readonly emailQueue: Queue
  ) {}

  @Get()
  @ApiOperation({ operationId: "organisationIndex" })
  @JsonApiResponse([
    { data: OrganisationLightDto, pagination: "number" },
    { data: OrganisationFullDto, pagination: "number" }
  ])
  @ExceptionResponse(UnauthorizedException, { description: "Organisation listing not allowed." })
  @ExceptionResponse(BadRequestException, { description: "Query params are invalid" })
  async index(@Query() query: OrganisationIndexQueryDto) {
    const { organisations, paginationTotal } = await this.organisationsService.findMany(query);

    if (organisations.length > 0) {
      const action = query.view === "public" ? "listing" : "read";
      await this.policyService.authorize(action, organisations);
    }

    const dtoType = query.lightResource === true ? OrganisationLightDto : OrganisationFullDto;

    return organisations.reduce(
      (document, org) => {
        const dto = query.lightResource === true ? new OrganisationLightDto(org) : new OrganisationFullDto(org);
        return document.addData(org.uuid, dto).document;
      },
      buildJsonApi(dtoType, { forceDataArray: true }).addIndex({
        requestPath: `/organisations/v3/organisations${getStableRequestQuery(query)}`,
        total: paginationTotal,
        pageNumber: query.page?.number ?? 1
      })
    );
  }

  @Get(":uuid")
  @ApiOperation({ operationId: "organisationShow", summary: "Get a single organisation by UUID" })
  @JsonApiResponse({
    data: OrganisationFullDto,
    included: [
      FinancialIndicatorDto,
      FinancialReportLightDto,
      MediaDto,
      FundingTypeDto,
      LeadershipDto,
      OwnershipStakeDto,
      TreeSpeciesDto
    ]
  })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  async show(@Param("uuid") uuid: string, @Query() query: OrganisationShowQueryDto) {
    const organisation = await this.organisationsService.findOne(uuid);
    await this.policyService.authorize("read", organisation);

    const document = buildJsonApi(OrganisationFullDto).addData(
      organisation.uuid,
      new OrganisationFullDto(organisation)
    ).document;

    await this.organisationsService.processSideloads(document, organisation, query);

    return document;
  }

  @Patch(":uuid")
  @ApiOperation({
    operationId: "organisationUpdate",
    summary: "Update organisation fields directly"
  })
  @JsonApiResponse({ data: OrganisationFullDto })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  @ExceptionResponse(BadRequestException, { description: "Request params are malformed." })
  async update(@Param("uuid") uuid: string, @Body() updatePayload: OrganisationUpdateBody) {
    if (uuid !== updatePayload.data.id) {
      throw new BadRequestException("Entity id in path and payload do not match");
    }

    const organisation = await this.organisationsService.findOne(uuid);

    const newStatus = updatePayload.data.attributes.status;
    const isStatusChange = newStatus === "approved" || newStatus === "rejected";
    const oldStatus = organisation.status;

    if (isStatusChange) {
      await this.policyService.authorize("approveReject", organisation);
    } else {
      await this.policyService.authorize("update", organisation);
    }

    await this.organisationsService.update(organisation, updatePayload.data.attributes);

    if (isStatusChange && oldStatus !== newStatus) {
      const userId = authenticatedUserId();
      if (userId != null) {
        try {
          if (newStatus === "approved") {
            await new OrganisationApprovedEmail({
              organisationId: organisation.id,
              approvedByUserId: userId
            }).sendLater(this.emailQueue);
            this.logger.log(`Queued organisation approved email for organisation ${organisation.id}`);
          } else if (newStatus === "rejected") {
            await new OrganisationRejectedEmail({
              organisationId: organisation.id,
              rejectedByUserId: userId
            }).sendLater(this.emailQueue);
            this.logger.log(`Queued organisation rejected email for organisation ${organisation.id}`);
          }
        } catch (error) {
          this.logger.error(
            `Failed to queue organisation ${newStatus} email for organisation ${organisation.id}`,
            error
          );
        }
      }
    }

    return buildJsonApi(OrganisationFullDto).addData(organisation.uuid, new OrganisationFullDto(organisation));
  }

  @Delete(":uuid")
  @ApiOperation({
    operationId: "organisationDelete",
    summary: "Soft delete organisation resource by UUID"
  })
  @JsonApiDeletedResponse(getDtoType(OrganisationFullDto), {
    description: "Associated organisation was deleted"
  })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  async delete(@Param("uuid") uuid: string) {
    const organisation = await this.organisationsService.findOne(uuid);
    await this.policyService.authorize("delete", organisation);
    await this.organisationsService.delete(organisation);
    return buildDeletedResponse(getDtoType(OrganisationFullDto), organisation.uuid);
  }

  @Post(":uuid/join-request")
  @ApiOperation({
    operationId: "organisationJoinRequest",
    summary: "Request to join an existing organisation"
  })
  @JsonApiResponse({ data: OrganisationLightDto })
  @ExceptionResponse(UnauthorizedException, {
    description: "User not authorized to request joining organisations."
  })
  @ExceptionResponse(NotFoundException, { description: "Organisation not found." })
  @ExceptionResponse(BadRequestException, { description: "Request is invalid." })
  async joinRequest(@Param("uuid") uuid: string) {
    const userId = this.policyService.userId as number;
    const organisation = await this.organisationsService.findOne(uuid);

    await this.policyService.authorize("joinRequest", organisation);

    await this.organisationsService.requestJoin(uuid, userId);

    const owners = await User.findAll({
      where: { organisationId: organisation.id },
      attributes: ["id"]
    });

    if (owners.length > 0) {
      await Notification.bulkCreate(
        owners.map(owner => ({
          userId: owner.id,
          title: "A user has requested to join your organization",
          body: "A user has requested to join your organization. Please go to the 'Meet the Team' page to review this request.",
          action: "user_join_organisation_requested",
          referencedModel: Organisation.LARAVEL_TYPE,
          referencedModelId: organisation.id
        }))
      );
    }

    try {
      await new OrganisationJoinRequestEmail({
        organisationId: organisation.id,
        requestingUserId: userId
      }).sendLater(this.emailQueue);
    } catch (error) {
      this.logger.error(`Failed to queue organisation join request email for organisation ${organisation.id}`, error);
    }

    return buildJsonApi(OrganisationLightDto).addData(organisation.uuid, new OrganisationLightDto(organisation));
  }

  @Patch(":uuid/users/:userUuid")
  @ApiOperation({
    operationId: "organisationUserUpdate",
    summary: "Approve or reject a user's join request to an organisation"
  })
  @JsonApiResponse({
    data: UserDto,
    included: [{ type: OrganisationLightDto, relationships: [USER_ORG_RELATIONSHIP] }]
  })
  @ExceptionResponse(UnauthorizedException, {
    description: "User not authorized to approve/reject join requests."
  })
  @ExceptionResponse(NotFoundException, { description: "Organisation or user not found." })
  @ExceptionResponse(BadRequestException, { description: "Request is invalid." })
  async updateUserStatus(
    @Param("uuid") organisationUuid: string,
    @Param("userUuid") userUuid: string,
    @Body() updatePayload: OrganisationUserUpdateBody
  ) {
    const organisation = await this.organisationsService.findOne(organisationUuid);
    await this.policyService.authorize("approveReject", organisation);

    const status = updatePayload.data.attributes.status;
    await this.organisationsService.updateUserStatus(organisationUuid, userUuid, status);

    const user = await User.findOne({
      where: { uuid: userUuid },
      include: ["roles", "organisation", "frameworks"]
    });

    if (user == null) {
      throw new NotFoundException(`User with UUID ${userUuid} not found`);
    }

    try {
      if (status === "approved") {
        await new OrganisationUserApprovedEmail({
          organisationId: organisation.id,
          userId: user.id
        }).sendLater(this.emailQueue);
        this.logger.log(
          `Queued organisation user approved email for user ${user.id} in organisation ${organisation.id}`
        );
      } else {
        await new OrganisationUserRejectedEmail({
          organisationId: organisation.id,
          userId: user.id
        }).sendLater(this.emailQueue);
        this.logger.log(
          `Queued organisation user rejected email for user ${user.id} in organisation ${organisation.id}`
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to queue organisation user ${status} email for user ${user.id} in organisation ${organisation.id}`,
        error
      );
    }

    const document = buildJsonApi(UserDto);
    const userResource = document.addData(user.uuid ?? "no-uuid", new UserDto(user, await user.myFrameworks()));
    const orgResource = document.addData(organisation.uuid, new OrganisationLightDto(organisation));
    userResource.relateTo("org", orgResource, { meta: { userStatus: status } });

    return document;
  }

  @Post()
  @ApiOperation({
    operationId: "organisationCreation",
    description: "Create an organisation. Pending status creates the first user and onboarding records."
  })
  @JsonApiResponse({
    data: OrganisationLightDto,
    included: [{ type: UserDto, relationships: [USER_ORG_RELATIONSHIP] }]
  })
  @ExceptionResponse(UnauthorizedException, { description: "Organisation creation not allowed." })
  @ExceptionResponse(BadRequestException, { description: "One or more attributes are invalid or missing." })
  async create(@Body() payload: OrganisationCreateBody) {
    await this.policyService.authorize("create", Organisation);

    const { user, organisation } = await this.organisationCreationService.createOrganisation(payload.data.attributes);

    const document = buildJsonApi(OrganisationLightDto);
    const orgResource = document.addData(organisation.uuid, new OrganisationLightDto(organisation));
    if (user != null) {
      const userResource = document.addData(user.uuid ?? "no-uuid", new UserDto(user, await user.myFrameworks()));
      userResource.relateTo("org", orgResource, { meta: { userStatus: "na" } });
    }
    return document;
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException
} from "@nestjs/common";
import { User } from "@terramatch-microservices/database/entities";
import { PolicyService } from "@terramatch-microservices/common";
import { ApiOperation, ApiParam } from "@nestjs/swagger";
import { OrganisationLightDto, UserDto } from "@terramatch-microservices/common/dto";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { JsonApiDeletedResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";
import {
  buildDeletedResponse,
  buildJsonApi,
  DocumentBuilder,
  getDtoType,
  getStableRequestQuery
} from "@terramatch-microservices/common/util";
import { UserUpdateBody } from "./dto/user-update.dto";
import { OptionalBearerAuth } from "@terramatch-microservices/common/guards";
import { UserCreateBaseBody } from "./dto/user-create.dto";
import { UserCreationService } from "./user-creation.service";
import { UserQueryDto } from "./dto/user-query.dto";
import { UsersService } from "./users.service";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";

export const USER_ORG_RELATIONSHIP = {
  name: "org",
  type: OrganisationLightDto,
  meta: {
    userStatus: {
      type: "string",
      enum: ["approved", "requested", "rejected", "na"]
    }
  }
};
const USER_RESPONSE_SHAPE = {
  data: {
    type: UserDto,
    relationships: [USER_ORG_RELATIONSHIP]
  },
  included: [OrganisationLightDto]
};

@Controller("users/v3/users")
export class UsersController {
  constructor(
    private readonly policyService: PolicyService,
    private readonly userCreationService: UserCreationService,
    private readonly usersService: UsersService
  ) {}

  @Get()
  @ApiOperation({ operationId: "userIndex", description: "Fetch a paginated list of users" })
  @JsonApiResponse([{ data: UserDto, pagination: "number" }])
  @ExceptionResponse(UnauthorizedException, { description: "Authorization failed" })
  async userIndex(@Query() query: UserQueryDto) {
    const { users, paginationTotal } = await this.usersService.findMany(query);
    if (users.length > 0) {
      await this.policyService.authorize("read", users);
    }

    const document = buildJsonApi(UserDto, { forceDataArray: true }).addIndex({
      requestPath: `/users/v3/users${getStableRequestQuery(query)}`,
      total: paginationTotal,
      pageNumber: query.page?.number ?? 1
    });

    await this.usersService.addUsersToDocument(document, users);
    return document;
  }

  @Get(":uuid")
  @ApiOperation({ operationId: "usersFind", description: "Fetch a user by UUID, or with the 'me' identifier" })
  @ApiParam({ name: "uuid", example: "me", description: 'A valid user UUID or "me"' })
  @JsonApiResponse(USER_RESPONSE_SHAPE)
  @ExceptionResponse(UnauthorizedException, { description: "Authorization failed" })
  @ExceptionResponse(NotFoundException, { description: "User with that UUID not found" })
  async findOne(@Param("uuid") pathId: string) {
    const userWhere = pathId === "me" ? { id: authenticatedUserId() } : { uuid: pathId };
    const user = await User.findOne({
      include: ["roles", "organisation", "frameworks"],
      where: userWhere
    });
    if (user == null) throw new NotFoundException();

    await this.policyService.authorize("read", user);

    return await this.addUserResource(buildJsonApi(UserDto), user);
  }

  @Patch(":uuid")
  @ApiOperation({ operationId: "userUpdate", description: "Update a user by UUID" })
  @ApiParam({ name: "uuid", description: "A valid user uuid" })
  @JsonApiResponse(USER_RESPONSE_SHAPE)
  @ExceptionResponse(UnauthorizedException, { description: "Authorization failed" })
  @ExceptionResponse(NotFoundException, { description: "User with that ID not found" })
  @ExceptionResponse(BadRequestException, { description: "Something is malformed about the request" })
  async update(@Param("uuid") uuid: string, @Body() updatePayload: UserUpdateBody) {
    if (uuid !== updatePayload.data.id) {
      throw new BadRequestException("Path uuid and payload id do not match");
    }

    const user = await User.findOne({
      include: ["roles", "organisation", "frameworks"],
      where: { uuid }
    });
    if (user == null) throw new NotFoundException();

    await this.policyService.authorize("update", user);

    const updatedUser = await this.usersService.update(user, updatePayload.data.attributes);

    return await this.addUserResource(buildJsonApi(UserDto), updatedUser as User);
  }

  @Delete(":uuid")
  @ApiOperation({ operationId: "userDelete", summary: "Delete a user by UUID" })
  @JsonApiDeletedResponse(getDtoType(UserDto), { description: "User was deleted" })
  @ExceptionResponse(NotFoundException, { description: "User with that UUID not found" })
  @ExceptionResponse(UnauthorizedException, { description: "User is not authorized to delete this user" })
  async delete(@Param() { uuid }: SingleResourceDto) {
    const user = await User.findOne({ where: { uuid }, attributes: ["id", "uuid"] });
    if (user == null) throw new NotFoundException();

    await this.policyService.authorize("delete", user);

    await this.usersService.delete(user);

    return buildDeletedResponse(getDtoType(UserDto), uuid);
  }

  @Post()
  @OptionalBearerAuth
  @ApiOperation({
    operationId: "userCreation",
    description: "Create a new user"
  })
  @JsonApiResponse(USER_RESPONSE_SHAPE)
  @ExceptionResponse(UnauthorizedException, { description: "user creation failed." })
  async create(@Body() payload: UserCreateBaseBody) {
    const isAuthenticated = authenticatedUserId() != null;
    if (isAuthenticated) {
      await this.policyService.authorize("create", User);
    }
    const user = await this.userCreationService.createNewUser(isAuthenticated, payload.data.attributes);
    return await this.addUserResource(buildJsonApi(UserDto), user);
  }
  @Patch("verifyUser/:uuid")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: "userVerify",
    description: "Verify a user's email by UUID (admin or self)."
  })
  @ApiParam({ name: "uuid", description: "User UUID" })
  @JsonApiResponse(USER_RESPONSE_SHAPE)
  @ExceptionResponse(UnauthorizedException, { description: "Not authorized" })
  @ExceptionResponse(NotFoundException, { description: "No user found" })
  async verifyUser(@Param("uuid") uuid: string) {
    const user = await User.findOne({
      include: ["roles", "organisation", "frameworks"],
      where: { uuid }
    });
    if (user == null) throw new NotFoundException("No user found.");

    await this.policyService.authorize("verify", user);

    if (user.emailAddressVerifiedAt == null) {
      user.emailAddressVerifiedAt = new Date();
      await user.save();
    }

    return await this.addUserResource(buildJsonApi(UserDto), user);
  }

  private async addUserResource(document: DocumentBuilder, user: User) {
    const userResource = document.addData(
      user.uuid ?? "no-uuid",
      new UserDto(user, user.frameworks ?? [], (await user.myFrameworks()) ?? [])
    );

    const org = await user.primaryOrganisation();
    if (org != null) {
      const orgResource = document.addData(org.uuid, new OrganisationLightDto(org));
      const userStatus = org.OrganisationUser?.status ?? "na";
      userResource.relateTo("org", orgResource, { meta: { userStatus } });
    }

    return document;
  }
}

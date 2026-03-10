import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Res,
  UnauthorizedException
} from "@nestjs/common";
import { Response } from "express";
import { User } from "@terramatch-microservices/database/entities";
import { PolicyService } from "@terramatch-microservices/common";
import { ApiOperation, ApiParam, ApiResponse } from "@nestjs/swagger";
import { OrganisationLightDto, UserDto } from "@terramatch-microservices/common/dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, DocumentBuilder } from "@terramatch-microservices/common/util";
import { UserUpdateBody } from "./dto/user-update.dto";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { UserCreateBody } from "./dto/user-create.dto";
import { UserCreationService } from "./user-creation.service";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";
import { AdminUsersService } from "./admin-users.service";

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
    private readonly adminUsersService: AdminUsersService
  ) {}

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

    // The only thing allowed to update for now is the locale
    const { locale } = updatePayload.data.attributes;
    if (locale != null) {
      user.locale = locale;
      await user.save();
    }

    return await this.addUserResource(buildJsonApi(UserDto), user);
  }

  @Post()
  @NoBearerAuth
  @ApiOperation({
    operationId: "userCreation",
    description: "Create a new user"
  })
  @JsonApiResponse(USER_RESPONSE_SHAPE)
  @ExceptionResponse(UnauthorizedException, { description: "user creation failed." })
  async create(@Body() payload: UserCreateBody) {
    const user = await this.userCreationService.createNewUser(payload.data.attributes);
    return await this.addUserResource(buildJsonApi(UserDto), user);
  }

  @Put("admin/reset-password/:uuid")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: "adminUsersResetPassword",
    description: "Reset a user's password by UUID (admin or self). V2-compatible."
  })
  @ApiParam({ name: "uuid", description: "User UUID" })
  @ApiResponse({
    status: 200,
    description: "Password updated",
    schema: { type: "string", example: "Password Updated" }
  })
  @ExceptionResponse(UnauthorizedException, { description: "Not authorized" })
  @ExceptionResponse(NotFoundException, { description: "No user found" })
  @ExceptionResponse(BadRequestException, { description: "Validation failed (e.g. password too weak)" })
  async adminResetPassword(@Param("uuid") uuid: string, @Body() dto: { password: string }, @Res() res: Response) {
    const user = await User.findOne({ where: { uuid }, attributes: ["id", "uuid"] });
    if (user == null) throw new NotFoundException("No user found.");

    await this.policyService.authorize("resetPassword", user);
    await this.adminUsersService.resetPasswordByUuid(uuid, dto.password);

    return res.status(HttpStatus.OK).json("Password Updated");
  }

  @Patch("admin/verify/:uuid")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: "adminUsersVerify",
    description: "Verify a user's email by UUID (admin or self). V2-compatible."
  })
  @ApiParam({ name: "uuid", description: "User UUID" })
  @ApiResponse({ status: 200, description: "User verified", schema: { type: "string", example: "User verified." } })
  @ExceptionResponse(UnauthorizedException, { description: "Not authorized" })
  @ExceptionResponse(NotFoundException, { description: "No user found" })
  async adminVerify(@Param("uuid") uuid: string, @Res() res: Response) {
    const user = await User.findOne({ where: { uuid }, attributes: ["id", "uuid"] });
    if (user == null) throw new NotFoundException("No user found.");

    await this.policyService.authorize("verify", user);
    await this.adminUsersService.verifyByUuid(uuid);

    return res.status(HttpStatus.OK).json("User verified.");
  }

  private async addUserResource(document: DocumentBuilder, user: User) {
    const userResource = document.addData(user.uuid ?? "no-uuid", new UserDto(user, await user.myFrameworks()));

    const org = await user.primaryOrganisation();
    if (org != null) {
      const orgResource = document.addData(org.uuid, new OrganisationLightDto(org));
      const userStatus = org.OrganisationUser?.status ?? "na";
      userResource.relateTo("org", orgResource, { meta: { userStatus } });
    }

    return document;
  }
}

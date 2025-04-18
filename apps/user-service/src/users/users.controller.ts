import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Request,
  UnauthorizedException
} from "@nestjs/common";
import { User } from "@terramatch-microservices/database/entities";
import { PolicyService } from "@terramatch-microservices/common";
import { ApiOperation, ApiParam } from "@nestjs/swagger";
import { OrganisationDto, UserDto } from "@terramatch-microservices/common/dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, DocumentBuilder, JsonApiDocument } from "@terramatch-microservices/common/util";
import { UserUpdateBody } from "./dto/user-update.dto";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { UserNewRequest } from "./dto/user-new-request.dto";
import { UserCreationService } from "./user-creation.service";

const USER_RESPONSE_SHAPE = {
  data: {
    type: UserDto,
    relationships: [
      {
        name: "org",
        type: OrganisationDto,
        meta: {
          userStatus: {
            type: "string",
            enum: ["approved", "requested", "rejected", "na"]
          }
        }
      }
    ]
  },
  included: [OrganisationDto]
};

@Controller("users/v3/users")
export class UsersController {
  constructor(
    private readonly policyService: PolicyService,
    private readonly userCreationService: UserCreationService
  ) {}

  @Get(":uuid")
  @ApiOperation({ operationId: "usersFind", description: "Fetch a user by UUID, or with the 'me' identifier" })
  @ApiParam({ name: "uuid", example: "me", description: 'A valid user UUID or "me"' })
  @JsonApiResponse(USER_RESPONSE_SHAPE)
  @ExceptionResponse(UnauthorizedException, { description: "Authorization failed" })
  @ExceptionResponse(NotFoundException, { description: "User with that UUID not found" })
  async findOne(@Param("uuid") pathId: string, @Request() { authenticatedUserId }) {
    const userWhere = pathId === "me" ? { id: authenticatedUserId } : { uuid: pathId };
    const user = await User.findOne({
      include: ["roles", "organisation", "frameworks"],
      where: userWhere
    });
    if (user == null) throw new NotFoundException();

    await this.policyService.authorize("read", user);

    return (await this.addUserResource(buildJsonApi(UserDto), user)).serialize();
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
      throw new BadRequestException(`Path uuid and payload id do not match`);
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

    return (await this.addUserResource(buildJsonApi(UserDto), user)).serialize();
  }

  @Post()
  @NoBearerAuth
  @ApiOperation({
    operationId: "userCreation",
    description: "Create a new user"
  })
  @JsonApiResponse(USER_RESPONSE_SHAPE)
  @ExceptionResponse(UnauthorizedException, { description: "user creation failed." })
  async create(@Body() payload: UserNewRequest): Promise<JsonApiDocument> {
    const user = await this.userCreationService.createNewUser(payload);
    return (await this.addUserResource(buildJsonApi(UserDto), user)).serialize();
  }

  private async addUserResource(document: DocumentBuilder, user: User) {
    const userResource = document.addData(user.uuid, new UserDto(user, await user.myFrameworks()));

    const org = await user.primaryOrganisation();
    if (org != null) {
      const orgResource = document.addIncluded(org.uuid, new OrganisationDto(org));
      const userStatus = org.OrganisationUser?.status ?? "na";
      userResource.relateTo("org", orgResource, { userStatus });
    }

    return document;
  }
}

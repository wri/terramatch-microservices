import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Request,
  UnauthorizedException
} from "@nestjs/common";
import { User } from "@terramatch-microservices/database/entities";
import { PolicyService } from "@terramatch-microservices/common";
import { ApiOperation, ApiParam } from "@nestjs/swagger";
import { OrganisationDto, UserDto } from "@terramatch-microservices/common/dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, DocumentBuilder } from "@terramatch-microservices/common/util";
import { UserUpdateBodyDto } from "./dto/user-update.dto";

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
  included: [{ type: OrganisationDto }]
};

@Controller("users/v3/users")
export class UsersController {
  constructor(private readonly policyService: PolicyService) {}

  @Get(":uuid")
  @ApiOperation({ operationId: "usersFind", description: "Fetch a user by ID, or with the 'me' identifier" })
  @ApiParam({ name: "uuid", example: "me", description: 'A valid user uuid or "me"' })
  @JsonApiResponse(USER_RESPONSE_SHAPE)
  @ExceptionResponse(UnauthorizedException, { description: "Authorization failed" })
  @ExceptionResponse(NotFoundException, { description: "User with that ID not found" })
  async findOne(@Param("uuid") pathId: string, @Request() { authenticatedUserId }) {
    const userWhere = pathId === "me" ? { id: authenticatedUserId } : { uuid: pathId };
    const user = await User.findOne({
      include: ["roles", "organisation", "frameworks"],
      where: userWhere
    });
    if (user == null) throw new NotFoundException();

    await this.policyService.authorize("read", user);

    return (await this.addUserResource(buildJsonApi(), user)).serialize();
  }

  @Patch(":uuid")
  @ApiOperation({ operationId: "userUpdate", description: "Update a user by ID" })
  @ApiParam({ name: "uuid", description: "A valid user uuid" })
  @JsonApiResponse(USER_RESPONSE_SHAPE)
  @ExceptionResponse(UnauthorizedException, { description: "Authorization failed" })
  @ExceptionResponse(NotFoundException, { description: "User with that ID not found" })
  @ExceptionResponse(BadRequestException, { description: "Something is malformed about the request" })
  async update(@Param("uuid") uuid: string, @Body() updatePayload: UserUpdateBodyDto) {
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

    return (await this.addUserResource(buildJsonApi(), user)).serialize();
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

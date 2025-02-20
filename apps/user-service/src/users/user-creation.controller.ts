import { Body, Controller, Post, UnauthorizedException } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, DocumentBuilder, JsonApiDocument } from "@terramatch-microservices/common/util";
import { UserCreationService } from "./user-creation.service";
import { USER_RESPONSE_SHAPE } from "./users.controller";
import { UserNewRequest } from "./dto/user-new-request.dto";
import { User } from "@terramatch-microservices/database/entities";
import { OrganisationDto, UserDto } from "@terramatch-microservices/common/dto";

@Controller("auth/v3/users")
export class UserCreationController {
  constructor(private readonly userCreationService: UserCreationService) {}

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

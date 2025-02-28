import { Body, Controller, Post, UnauthorizedException } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, JsonApiDocument } from "@terramatch-microservices/common/util";
import { UserCreationService } from "./user-creation.service";
import { USER_RESPONSE_SHAPE } from "./users.controller";
import { UserNewRequest } from "./dto/user-new-request.dto";
import { addUserResource } from "./util";
import { UserDto } from "@terramatch-microservices/common/dto";

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
    return (await addUserResource(buildJsonApi(UserDto), user)).serialize();
  }
}

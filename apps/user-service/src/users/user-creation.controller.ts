import { Body, Controller, Post, UnauthorizedException } from "@nestjs/common";
import { LoginRequest } from "../auth/dto/login-request.dto";
import { ApiOperation } from "@nestjs/swagger";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, JsonApiDocument } from "@terramatch-microservices/common/util";
import { UserCreationService } from "./user-creation.service";
import { USER_RESPONSE_SHAPE } from "./users.controller";

@Controller("auth/v3/users")
export class UserCreationController {
  constructor(private readonly userCreationService: UserCreationService) {}

  @Post()
  @NoBearerAuth
  @ApiOperation({
    operationId: "userCreation",
    description: "Receive a JWT Token in exchange for login credentials"
  })
  @JsonApiResponse(USER_RESPONSE_SHAPE)
  @ExceptionResponse(UnauthorizedException, { description: "user creation failed." })
  async create(@Body() payload: LoginRequest): Promise<JsonApiDocument> {
    return buildJsonApi().addData(null, null).document.serialize();
  }
}

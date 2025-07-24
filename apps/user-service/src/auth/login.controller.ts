import { Body, Controller, HttpStatus, Post, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginBody } from "./dto/login-request.dto";
import { LoginDto } from "./dto/login.dto";
import { ApiOperation } from "@nestjs/swagger";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

@Controller("auth/v3/logins")
export class LoginController {
  constructor(private readonly authService: AuthService) {}

  @Post()
  @NoBearerAuth
  @ApiOperation({
    operationId: "authLogin",
    description: "Receive a JWT Token in exchange for login credentials"
  })
  @JsonApiResponse(LoginDto, { status: HttpStatus.CREATED })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  async create(@Body() payload: LoginBody) {
    const { emailAddress, password } = payload.data.attributes;
    const { token, userUuid } = (await this.authService.login(emailAddress, password)) ?? {};
    if (token == null || userUuid == null) {
      // there are multiple reasons for the token to be null (bad email address, wrong password),
      // but we don't want to report on the specifics because it opens an attack vector: if we
      // report that an email address isn't valid, that lets an attacker know which email addresses
      // _are_ valid in our system.
      throw new UnauthorizedException();
    }

    return buildJsonApi(LoginDto).addData(userUuid, populateDto(new LoginDto(), { token })).document.serialize();
  }
}

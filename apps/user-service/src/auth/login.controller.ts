import { Body, Controller, HttpStatus, Post, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginRequest } from "./dto/login-request.dto";
import { LoginDto } from "./dto/login.dto";
import { ApiException } from "@nanogiants/nestjs-swagger-api-exception-decorator";
import { ApiOperation } from "@nestjs/swagger";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, JsonApiDocument } from "@terramatch-microservices/common/util";

@Controller("auth/v3/logins")
export class LoginController {
  constructor(private readonly authService: AuthService) {}

  @Post()
  @NoBearerAuth
  @ApiOperation({
    operationId: "authLogin",
    description: "Receive a JWT Token in exchange for login credentials"
  })
  @JsonApiResponse({ status: HttpStatus.CREATED, data: { type: LoginDto } })
  @ApiException(() => UnauthorizedException, { description: "Authentication failed." })
  async create(@Body() { emailAddress, password }: LoginRequest): Promise<JsonApiDocument> {
    const { token, userUuid } = (await this.authService.login(emailAddress, password)) ?? {};
    if (token == null) {
      // there are multiple reasons for the token to be null (bad email address, wrong password),
      // but we don't want to report on the specifics because it opens an attack vector: if we
      // report that an email address isn't valid, that lets an attacker know which email addresses
      // _are_ valid in our system.
      throw new UnauthorizedException();
    }

    return buildJsonApi().addData(userUuid, new LoginDto({ token })).document.serialize();
  }
}

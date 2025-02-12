import { Controller, Body, Post, HttpStatus, BadRequestException, Request } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, JsonApiDocument } from "@terramatch-microservices/common/util";
import { VerificationUserService } from "./verification-user.service";
import { VerificationUserRequest } from "./dto/verification-user-request.dto";
import { VerificationUserResponse } from "./dto/verification-user-response.dto";

@Controller("auth/v3/verifications")
export class VerificationUserController {
  constructor(private readonly verificationUserService: VerificationUserService) {}

  @Post()
  @ApiOperation({
    operationId: "verifyUser",
    description: "Receive a token to verify an user"
  })
  @JsonApiResponse({ status: HttpStatus.CREATED, data: { type: VerificationUserResponse } })
  @ExceptionResponse(BadRequestException, { description: "Invalid request" })
  async verifyUser(
    @Request() { authenticatedUserId },
    @Body() { token }: VerificationUserRequest
  ): Promise<JsonApiDocument> {
    const { uuid, isVerified } = await this.verificationUserService.verify(authenticatedUserId, token);
    return buildJsonApi()
      .addData(uuid, new VerificationUserResponse({ verified: isVerified }))
      .document.serialize();
  }
}

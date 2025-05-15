import { Controller, Body, Post, HttpStatus, BadRequestException } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, JsonApiDocument } from "@terramatch-microservices/common/util";
import { VerificationUserService } from "./verification-user.service";
import { VerificationUserRequest } from "./dto/verification-user-request.dto";
import { VerificationUserResponseDto } from "./dto/verification-user-response.dto";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

@Controller("auth/v3/verifications")
export class VerificationUserController {
  constructor(private readonly verificationUserService: VerificationUserService) {}

  @Post()
  @NoBearerAuth
  @ApiOperation({
    operationId: "verifyUser",
    description: "Receive a token to verify a user and return the verification status"
  })
  @JsonApiResponse(VerificationUserResponseDto, { status: HttpStatus.CREATED })
  @ExceptionResponse(BadRequestException, { description: "Invalid request" })
  async verifyUser(@Body() { token }: VerificationUserRequest): Promise<JsonApiDocument> {
    const { uuid, isVerified } = await this.verificationUserService.verify(token);
    return buildJsonApi(VerificationUserResponseDto)
      .addData(uuid ?? "no-uuid", populateDto(new VerificationUserResponseDto(), { verified: isVerified }))
      .document.serialize();
  }
}

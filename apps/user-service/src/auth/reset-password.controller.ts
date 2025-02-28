import { Controller, Body, Post, HttpStatus, BadRequestException, Param, Put } from "@nestjs/common";
import { ResetPasswordService } from "./reset-password.service";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, JsonApiDocument } from "@terramatch-microservices/common/util";
import { ResetPasswordRequest } from "./dto/reset-password-request.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";
import { ResetPasswordResponseDto } from "./dto/reset-password-response.dto";

@Controller("auth/v3/passwordResets")
export class ResetPasswordController {
  constructor(private readonly resetPasswordService: ResetPasswordService) {}

  @Post()
  @NoBearerAuth
  @ApiOperation({
    operationId: "requestPasswordReset",
    description: "Send password reset email with a token"
  })
  @JsonApiResponse(ResetPasswordResponseDto, { status: HttpStatus.CREATED })
  @ExceptionResponse(BadRequestException, { description: "Invalid request or email." })
  async requestReset(@Body() { emailAddress, callbackUrl }: ResetPasswordRequest): Promise<JsonApiDocument> {
    const { email, uuid } = await this.resetPasswordService.sendResetPasswordEmail(emailAddress, callbackUrl);
    return buildJsonApi(ResetPasswordResponseDto)
      .addData(uuid, new ResetPasswordResponseDto({ emailAddress: email }))
      .document.serialize();
  }

  @Put(":token")
  @NoBearerAuth
  @ApiOperation({
    operationId: "resetPassword",
    description: "Reset password using the provided token"
  })
  @JsonApiResponse(ResetPasswordResponseDto)
  @ExceptionResponse(BadRequestException, { description: "Invalid or expired token." })
  async resetPassword(
    @Param("token") token: string,
    @Body() { newPassword }: ResetPasswordDto
  ): Promise<JsonApiDocument> {
    const { email, uuid } = await this.resetPasswordService.resetPassword(token, newPassword);
    return buildJsonApi(ResetPasswordResponseDto)
      .addData(uuid, new ResetPasswordResponseDto({ emailAddress: email }))
      .document.serialize();
  }
}

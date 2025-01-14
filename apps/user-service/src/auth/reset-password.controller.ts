import {
  Controller,
  Body,
  Post,
  HttpStatus,
  BadRequestException,
  Param,
} from '@nestjs/common';
import { ResetPasswordService } from './reset-password.service';
import { ApiOperation } from '@nestjs/swagger';
import { JsonApiResponse } from '@terramatch-microservices/common/decorators';
import { buildJsonApi, JsonApiDocument } from '@terramatch-microservices/common/util';
import { ApiException } from '@nanogiants/nestjs-swagger-api-exception-decorator';
import { RequestResetPasswordDto } from './dto/reset-password-request.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { NoBearerAuth } from '@terramatch-microservices/common/guards';

@Controller('auth/v3/reset-password')
export class ResetPasswordController {
  constructor(private readonly resetPasswordService: ResetPasswordService) {}

  @Post('request')
  @NoBearerAuth
  @ApiOperation({
    operationId: 'requestPasswordReset',
    description: 'Send password reset email with a token',
  })
  @JsonApiResponse({ status: HttpStatus.CREATED, data: { type: RequestResetPasswordDto } })
  @ApiException(() => BadRequestException, { description: 'Invalid request or email.' })
  async requestReset(@Body() { emailAddress }: RequestResetPasswordDto): Promise<JsonApiDocument> {
    const response = await this.resetPasswordService.sendResetPasswordEmail(emailAddress);
    return buildJsonApi()
      .addData('sdad',response)
      .document.serialize();
  }

  @Post('reset/:token')
  @ApiOperation({
    operationId: 'resetPassword',
    description: 'Reset password using the provided token',
  })
  @JsonApiResponse({ status: HttpStatus.OK, data: { type: ResetPasswordDto } })
  @ApiException(() => BadRequestException, { description: 'Invalid or expired token.' })
  async resetPassword(
    @Param('token') token: string,
    @Body() { newPassword }: { newPassword: string }
  ): Promise<JsonApiDocument> {
    const response = await this.resetPasswordService.resetPassword(token, newPassword);
    return buildJsonApi()
      .addData('sads',response)
      .document.serialize();
  }
}

import {
  Body,
  Controller,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginRequest } from './dto/login-request.dto';
import { LoginDto } from './dto/login.dto';
import { ApiException } from '@nanogiants/nestjs-swagger-api-exception-decorator';
import { ApiOperation } from '@nestjs/swagger';
import { NoBearerAuth } from '@terramatch-microservices/common/guards';
import { JsonApiResponse } from '@terramatch-microservices/common/decorators';
import { JsonApiDto } from '@terramatch-microservices/common/interfaces';

@Controller('auth/v3')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('logins')
  @NoBearerAuth()
  @ApiOperation({
    operationId: 'authLogin',
    description: 'Receive a JWT Token in exchange for login credentials',
  })
  @JsonApiResponse({ status: HttpStatus.CREATED, data: LoginDto })
  @ApiException(() => UnauthorizedException, {
    description: 'Authentication failed.',
    template: { statusCode: '$status', message: '$description' },
  })
  async login(
    @Body() { emailAddress, password }: LoginRequest
  ): Promise<JsonApiDto<LoginDto>> {
    const { token, userId } =
      (await this.authService.login(emailAddress, password)) ?? {};
    if (token == null) {
      // there are multiple reasons for the token to be null (bad email address, wrong password),
      // but we don't want to report on the specifics because it opens an attack vector: if we
      // report that an email address isn't valid, that lets an attacker know which email addresses
      // _are_ valid in our system.
      throw new UnauthorizedException();
    }

    return {
      id: `${userId}`,
      attributes: new LoginDto({ token }),
    };
  }
}

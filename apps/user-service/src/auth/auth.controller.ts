import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginRequest } from './dto/login-request.dto';
import { JsonApiResponse } from '../decorators/json-api-response.decorator';
import { LoginResponse } from './dto/login-response.dto';
import { ApiException } from '@nanogiants/nestjs-swagger-api-exception-decorator';
import { ApiOperation } from '@nestjs/swagger';

@Controller('auth')
export class AuthController {
  constructor (private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Receive a JWT Token in exchange for login credentials' })
  @JsonApiResponse({ dataType: LoginResponse })
  @ApiException(
    () => UnauthorizedException,
    { description: 'Authentication failed.', template: { statusCode: '$status', message: '$description', } }
  )
  async login(@Body() { emailAddress, password }: LoginRequest): Promise<LoginResponse> {
    const token = await this.authService.login(emailAddress, password);
    if (token == null) {
      // there are multiple reasons for the token to be null (bad email address, wrong password),
      // but we don't want to report on the specifics because it opens an attack vector: if we
      // report that an email address isn't valid, that lets an attacker know which email addresses
      // _are_ valid in our system.
      throw new UnauthorizedException();
    }

    return { token };
  }
}

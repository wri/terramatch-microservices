import { Body, Controller, HttpStatus, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginRequest } from './dto/login-request.dto';
import { JsonApiResponse } from '../decorators/json-api-response.decorator';
import { LoginResponse } from './dto/login-response.dto';
import { ApiException } from '@nanogiants/nestjs-swagger-api-exception-decorator';
import { ApiOperation } from '@nestjs/swagger';

@Controller('auth')
export class AuthController {
  constructor (protected readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Receive a JWT Token in exchange for login credentials' })
  @JsonApiResponse({ status: HttpStatus.OK, dataType: LoginResponse })
  @ApiException(
    () => UnauthorizedException,
    { description: 'Authentication failed.', template: { statusCode: '$status', message: '$description', } }
  )
  async login(@Body() { emailAddress, password }: LoginRequest): Promise<LoginResponse> {
    const token = await this.authService.login(emailAddress, password);
    if (token == null) {
      throw new UnauthorizedException();
    }

    return { token };
  }
}

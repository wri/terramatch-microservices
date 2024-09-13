import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginRequest } from './dto/login-request.dto';
import { JsonApiResponse } from '../decorators/json-api-response.decorator';
import { LoginResponse } from './dto/login-response.dto';

@Controller('auth')
export class AuthController {
  constructor (protected readonly authService: AuthService) {}

  @Post('login')
  @JsonApiResponse({
    status: 201,
    description: 'Receive a JWT Token in exchange for login credentials',
    dataType: LoginResponse
  })
  async login(@Body() { emailAddress, password }: LoginRequest): Promise<LoginResponse> {
    const token = await this.authService.login(emailAddress, password);
    return { token };
  }
}

import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Login } from './entities/login.entity';
import { JsonApiResponse } from '../decorators/json-api-response.decorator';

@Controller('auth')
export class AuthController {
  constructor (protected readonly authService: AuthService) {}

  @Post('login')
  @JsonApiResponse({
    status: 201,
    description: 'Receive a JWT Token in exchange for login credentials',
    dataType: Login
  })
  login(@Body() loginDto: LoginDto): Login {
    const token = this.authService.login(loginDto.email_address, loginDto.password);
    return { token };
  }
}

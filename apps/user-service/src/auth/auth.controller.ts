import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ApiResponse } from './interfaces/api-response.interface';
import { Login } from './interfaces/login.interface';

@Controller('auth')
export class AuthController {
  constructor (protected readonly authService: AuthService) {}

  @Post('login')
  login(@Body() loginDto: LoginDto): ApiResponse<Login> {
    const token = this.authService.login(loginDto.email_address, loginDto.password);
    return { data: { token } };
  }
}

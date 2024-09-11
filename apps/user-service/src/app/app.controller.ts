import { Controller, Get } from '@nestjs/common';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(protected readonly appService: AppService) {}

  @Get('auth/login')
  login() {
    return this.appService.login();
  }
}

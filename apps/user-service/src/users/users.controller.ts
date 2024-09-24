import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@terramatch-microservices/common';

@Controller('users/v3')
export class UsersController {
  @UseGuards(AuthGuard)
  @Get('users/:id')
  async findOne(@Param('id') id: string, @Request() req): Promise<string> {
    if (id === 'me') id = req.authorizedUserId;
    return id;
  }
}

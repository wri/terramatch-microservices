import { Controller, Get, Param, Request } from '@nestjs/common';

@Controller('users/v3')
export class UsersController {
  @Get('users/:id')
  async findOne(@Param('id') id: string, @Request() req): Promise<string> {
    if (id === 'me') id = req.authorizedUserId;
    return id;
  }
}

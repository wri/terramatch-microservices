import { Controller, Get, Param, Request } from '@nestjs/common';
import { User } from '@terramatch-microservices/database/entities';
import { PolicyService } from '@terramatch-microservices/common';

@Controller('users/v3')
export class UsersController {
  constructor(private readonly policyService: PolicyService) {}

  @Get('users/:id')
  async findOne(@Param('id') id: string, @Request() req: any): Promise<string> {
    const userId = id === 'me' ? req.authenticatedUserId : parseInt(id);
    const user = await User.findOneBy({ id: userId })
    await this.policyService.authorize('read', user);

    return `email: ${user.emailAddress}, id: ${user.id}`;
  }
}

import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@terramatch-microservices/database/entities';
import { PolicyService } from '@terramatch-microservices/common';
import { ApiOperation } from '@nestjs/swagger';
import { UserDto } from '@terramatch-microservices/common/dto';
import { ApiException } from '@nanogiants/nestjs-swagger-api-exception-decorator';
import { JsonApiResponse } from '@terramatch-microservices/common/decorators';
import { JsonApiDto } from '@terramatch-microservices/common/interfaces';

@Controller('users/v3')
export class UsersController {
  constructor(private readonly policyService: PolicyService) {}

  @Get('users/:id')
  @ApiOperation({
    operationId: 'usersFind',
    description: "Fetch a user by ID, or with the 'me' identifier",
  })
  @JsonApiResponse({ data: UserDto })
  @ApiException(() => UnauthorizedException, {
    description: 'Authorization failed',
    template: { statusCode: '$status', message: '$description' },
  })
  @ApiException(() => NotFoundException, {
    description: 'User with that ID not found',
  })
  async findOne(
    @Param('id') pathId: string,
    @Request() { authenticatedUserId }
  ): Promise<JsonApiDto<UserDto>> {
    const userId = pathId === 'me' ? authenticatedUserId : parseInt(pathId);
    const user = await User.findOneBy({ id: userId });
    if (user == null) throw new NotFoundException();

    await this.policyService.authorize('read', user);

    const primaryOrganisation = await user.primaryOrganisation();

    const {
      uuid,
      emailAddress,
      firstName,
      lastName,
      emailAddressVerifiedAt,
      locale,
    } = user;
    return {
      id: uuid,
      attributes: new UserDto({
        firstName,
        lastName,
        fullName:
          firstName == null || lastName == null
            ? null
            : `${firstName} ${lastName}`,
        primaryRole: 'asdfasdfasdf',
        emailAddress,
        emailAddressVerifiedAt,
        locale,
        // organisation:
        //   primaryOrganisation == null
        //     ? null
        //     : {
        //       uuid: primaryOrganisation.uuid,
        //       status: 'requested',
        //     },
      })
    }
  }
}

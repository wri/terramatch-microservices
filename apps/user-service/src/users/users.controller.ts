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
import { ApiOperation, ApiParam } from '@nestjs/swagger';
import { OrganisationDto, UserDto } from '@terramatch-microservices/common/dto';
import { ApiException } from '@nanogiants/nestjs-swagger-api-exception-decorator';
import { JsonApiResponse } from '@terramatch-microservices/common/decorators';
import {
  buildJsonApi,
  JsonApiDocument,
} from '@terramatch-microservices/common/util';

@Controller('users/v3/users')
export class UsersController {
  constructor(private readonly policyService: PolicyService) {}

  @Get(':id')
  @ApiOperation({ operationId: 'usersFind', description: "Fetch a user by ID, or with the 'me' identifier" })
  @ApiParam({ name: 'id', example: 'me', description: 'A valid user id or "me"' })
  @JsonApiResponse({
    data: {
      type: UserDto,
      relationships: [
        {
          name: 'org',
          type: OrganisationDto,
          meta: {
            userStatus: {
              type: 'string',
              enum: ['approved', 'requested', 'rejected', 'na'],
            },
          },
        },
      ],
    },
    included: [{ type: OrganisationDto }],
  })
  @ApiException(() => UnauthorizedException, {
    description: 'Authorization failed',
  })
  @ApiException(() => NotFoundException, {
    description: 'User with that ID not found',
  })
  async findOne(
    @Param('id') pathId: string,
    @Request() { authenticatedUserId }
  ): Promise<JsonApiDocument> {
    const userId = pathId === 'me' ? authenticatedUserId : parseInt(pathId);
    const user = await User.findOne({ include: ['roles', 'organisation'], where: { id: userId }, });
    if (user == null) throw new NotFoundException();

    await this.policyService.authorize('read', user);

    const document = buildJsonApi();
    const userResource = document.addData(user.uuid, new UserDto(user, await user.frameworks()));

    const org = await user.primaryOrganisation();
    if (org != null) {
      const orgResource = document.addIncluded(org.uuid, new OrganisationDto(org));
      const userStatus = org.OrganisationUser?.status ?? 'na';
      userResource.relateTo('org', orgResource, { userStatus });
    }

    return document.serialize();
  }
}

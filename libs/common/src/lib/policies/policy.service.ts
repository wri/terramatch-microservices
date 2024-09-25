import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { RequestContext } from 'nestjs-request-context';
import { UserPolicy } from '@terramatch-microservices/common/policies/user.policy';
import { BaseEntity } from 'typeorm';
import { EntityPolicy } from '@terramatch-microservices/common/policies/entity.policy';
import { Permission, User } from '@terramatch-microservices/database/entities';

type EntityClass = {
  new (...args: any[]): BaseEntity;
}

type PolicyClass = {
  new (userId: number, permissions: string[]): EntityPolicy;
}

const POLICIES: [ [EntityClass, PolicyClass] ] = [
  [User, UserPolicy]
];

/**
 * A service for finding the correct policy given an entity subject, building rules for the currently
 * authenticated user and checking the given action and subject against those rules.
 *
 * In the future, this will need some additional methods for acting on an array of subjects, and
 * potentially subjects of different types.
 *
 * @throws UnauthorizedException if there is no authenticated user id, there's no policy defined for
 *   the subject, or if the requested action is not allowed against the subject for this user.
 */
@Injectable()
export class PolicyService {
  async authorize<T extends BaseEntity>(action: string, subject: T): Promise<void> {
    // Added by AuthGuard
    const userId = RequestContext.currentContext.req.authenticatedUserId;
    if (userId == null) throw new UnauthorizedException();

    const [, PolicyClass] = POLICIES.find(([entityClass]) => subject instanceof entityClass) ?? [];
    if (PolicyClass == null) {
      console.error('No policy found for subject type', subject);
      throw new UnauthorizedException();
    }

    const permissions = await Permission.getUserPermissionNames(userId);
    const ability = await (new PolicyClass(userId, permissions)).build();

    if (!ability.can(action, subject)) throw new UnauthorizedException();
  }
}

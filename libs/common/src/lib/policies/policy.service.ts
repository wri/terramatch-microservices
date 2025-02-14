import { Injectable, LoggerService, UnauthorizedException } from "@nestjs/common";
import { RequestContext } from "nestjs-request-context";
import { UserPolicy } from "./user.policy";
import { BuilderType, EntityPolicy } from "./entity.policy";
import { Permission, SitePolygon, User } from "@terramatch-microservices/database/entities";
import { AbilityBuilder, createMongoAbility } from "@casl/ability";
import { Model } from "sequelize-typescript";
import { TMLogService } from "../util/tm-log.service";
import { SitePolygonPolicy } from "./site-polygon.policy";

type EntityClass = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (...args: any[]): Model;
  name?: string;
};

type PolicyClass = {
  new (userId: number, permissions: string[], builder: AbilityBuilder<BuilderType>): EntityPolicy;
};

const POLICIES: [EntityClass, PolicyClass][] = [
  [User, UserPolicy],
  [SitePolygon, SitePolygonPolicy]
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
  private readonly log: LoggerService = new TMLogService(PolicyService.name);

  async authorize(action: string, subject: Model | EntityClass): Promise<void> {
    // Added by AuthGuard
    const userId = RequestContext.currentContext.req.authenticatedUserId;
    if (userId == null) throw new UnauthorizedException();

    const [, PolicyClass] =
      POLICIES.find(([entityClass]) => subject instanceof entityClass || subject === entityClass) ?? [];
    if (PolicyClass == null) {
      this.log.error(`No policy found for subject type [${subject.constructor.name}]`);
      throw new UnauthorizedException();
    }

    const permissions = await Permission.getUserPermissionNames(userId);
    const builder = new AbilityBuilder(createMongoAbility);
    await new PolicyClass(userId, permissions, builder).addRules();

    const ability = builder.build();
    if (!ability.can(action, subject)) throw new UnauthorizedException();
  }
}

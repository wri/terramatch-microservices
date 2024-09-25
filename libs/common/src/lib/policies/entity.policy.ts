import { AbilityBuilder, createMongoAbility } from '@casl/ability';

export type BuilderType = ReturnType<typeof createMongoAbility>;

export abstract class EntityPolicy {
  /**
   * Most policies can create their rule set based on the user id and the user permissions. For
   * those that need access to more resources (like the user's organisation_id), the addRules()
   * method below is async so that calls to the DB can be made.
   *
   * Note that the builder is passed in instead of created here. This is so that the PolicyService
   * can support
   */
  constructor(
    protected userId: number,
    protected permissions: string[],
    protected builder: AbilityBuilder<BuilderType>,
  ) {}

  public abstract addRules(): Promise<void>;
}

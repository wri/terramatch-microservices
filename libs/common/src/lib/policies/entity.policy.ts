import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { User } from '@terramatch-microservices/database/entities';

type BuilderType = ReturnType<typeof createMongoAbility>;

export abstract class EntityPolicy {
  protected ability: AbilityBuilder<BuilderType>;

  constructor(protected userId: number, protected permissions: string[]) {
    this.ability = new AbilityBuilder(createMongoAbility);
  }

  public abstract build(): Promise<BuilderType>;
}

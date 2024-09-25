import { User } from '@terramatch-microservices/database/entities';
import { EntityPolicy } from './entity.policy';

export class UserPolicy extends EntityPolicy {
  async build() {
    if (this.permissions.includes('users-manage')) {
      this.ability.can('read', User);
    } else {
      this.ability.can('read', User, { id: this.userId });
    }

    return this.ability.build();
  }
}

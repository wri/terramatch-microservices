import { AsyncLocalStorage } from "node:async_hooks";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import { PolicyBuilder } from "../policies/policy.service";

export class UserContext {
  static contextStore = new AsyncLocalStorage<UserContext>();

  static get current() {
    return this.contextStore.getStore();
  }

  static use(userId: number, permissions: string[], locale: ValidLocale, next: () => void) {
    UserContext.contextStore.run(new UserContext(userId, permissions, locale), next);
  }

  static get authenticatedUserId() {
    return UserContext.current?.authenticatedUserId;
  }

  static get permissions() {
    return UserContext.current?.permissions;
  }

  static get policyBuilder() {
    return UserContext.current?.policyBuilder;
  }

  static get userLocale() {
    return UserContext.current?.userLocale;
  }

  public policyBuilder: PolicyBuilder;

  constructor(
    readonly authenticatedUserId: number,
    readonly permissions: string[],
    readonly userLocale: ValidLocale
  ) {
    this.policyBuilder = new PolicyBuilder(authenticatedUserId, permissions);
  }
}

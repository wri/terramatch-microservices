import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as Entities from "./entities";
import { SequelizeModuleOptions, SequelizeOptionsFactory } from "@nestjs/sequelize";
import { Model } from "sequelize-typescript";
import { getStateMachine, getStateMachineProperties } from "./util/model-column-state-machine";

export const SEQUELIZE_GLOBAL_HOOKS = {
  afterSave: async function (model: Model) {
    // After any model saves, check if we have a state machine defined on one or more of its
    // columns, and if so, call afterSave on the state machine instance for the possible
    // processing of afterTransitionHooks. See StateMachineColumn decorator in
    // model-column-state-machine.ts
    for (const key of getStateMachineProperties(model)) {
      await getStateMachine(model, key)?.afterSave();
    }
  }
};

@Injectable()
export class SequelizeConfigService implements SequelizeOptionsFactory {
  constructor(protected readonly configService: ConfigService) {}

  createSequelizeOptions(): SequelizeModuleOptions {
    const logger = new Logger("Sequelize");
    return {
      dialect: "mariadb",
      host: this.configService.get<string>("DB_HOST"),
      port: this.configService.get<number>("DB_PORT"),
      username: this.configService.get<string>("DB_USERNAME"),
      password: this.configService.get<string>("DB_PASSWORD"),
      database: this.configService.get<string>("DB_DATABASE"),
      synchronize: false,
      models: Object.values(Entities),
      hooks: SEQUELIZE_GLOBAL_HOOKS,
      logging: sql => logger.log(sql)
    };
  }
}

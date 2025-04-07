import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as Entities from "./entities";
import { SequelizeModuleOptions, SequelizeOptionsFactory } from "@nestjs/sequelize";
import { Model } from "sequelize-typescript";
import { StateMachineModel } from "./util/model-column-state-machine";

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
      logging: sql => logger.log(sql),
      hooks: {
        afterSave: function (model: Model) {
          // After any model saves, check if we have a state machine defined on one or more of its
          // columns, and if so, call afterSave on the state machine instance for the possible
          // processing of afterTransitionHooks. See model-column-state-machine.ts
          const stateMachineMetadataKeys = Reflect.getMetadataKeys(model).filter(key =>
            key.startsWith("model-column-state-machine:")
          );
          for (const key of stateMachineMetadataKeys) {
            const propertyName = key.split(":").pop();
            if (!Reflect.getMetadata(key, model)) continue;

            (model as StateMachineModel<Model, string>)._stateMachines?.[propertyName]?.afterSave();
          }
        }
      }
    };
  }
}

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SequelizeModule } from "@nestjs/sequelize";
import { SequelizeConfigService } from "./sequelize-config.service";
import { EventEmitter2, EventEmitterModule } from "@nestjs/event-emitter";
import { Model } from "sequelize-typescript";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SequelizeModule.forRootAsync({
      useClass: SequelizeConfigService,
      imports: [ConfigModule.forRoot({ isGlobal: true })]
    }),
    EventEmitterModule.forRoot()
  ]
})
export class DatabaseModule {
  /**
   * This is made statically available _only_ for use in the database model classes and their
   * direct dependencies. Doing it this way is a bit of an anti-pattern, but our DB layer does
   * not support NestJS dependency injection in a way that would give access to this event emitter
   * in model code.
   */
  private static eventEmitter?: EventEmitter2;

  constructor(readonly eventEmitter: EventEmitter2) {
    DatabaseModule.eventEmitter = eventEmitter;
  }

  static async emitModelEvent(eventName: string, model: Model) {
    await this.eventEmitter?.emitAsync(`database.${eventName}`, model);
  }
}

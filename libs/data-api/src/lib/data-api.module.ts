import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { DataApiService } from "./data-api.service";
import { RedisModule } from "@nestjs-modules/ioredis";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule.forRootAsync({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: "single",
        url: `redis://${configService.get("REDIS_HOST")}:${configService.get("REDIS_PORT")}`
      })
    })
  ],
  providers: [DataApiService],
  exports: [DataApiService]
})
export class DataApiModule {}

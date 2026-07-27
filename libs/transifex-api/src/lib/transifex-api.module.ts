import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TransifexApiService } from "./transifex-api.service";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [TransifexApiService],
  exports: [TransifexApiService]
})
export class TransifexApiModule {}

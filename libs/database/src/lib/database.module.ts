import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeConfigService } from './sequelize-config.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    SequelizeModule.forRootAsync({
      useClass: SequelizeConfigService,
      imports: [ConfigModule],
    }),
  ],
})
export class DatabaseModule {}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Framework,
  ModelHasRole, Organisation, OrganisationUser,
  Permission,
  Project,
  ProjectUser,
  Role,
  User
} from './entities';
import {
  SequelizeModuleOptions,
  SequelizeOptionsFactory,
} from '@nestjs/sequelize';

@Injectable()
export class SequelizeConfigService implements SequelizeOptionsFactory {
  constructor(protected readonly configService: ConfigService) {}

  createSequelizeOptions(): SequelizeModuleOptions {
    return {
      dialect: 'mariadb',
      host: this.configService.get<string>('DB_HOST'),
      port: this.configService.get<number>('DB_PORT'),
      username: this.configService.get<string>('DB_USERNAME'),
      password: this.configService.get<string>('DB_PASSWORD'),
      database: this.configService.get<string>('DB_DATABASE'),
      synchronize: false,
      models: [
        Framework,
        ModelHasRole,
        Organisation,
        OrganisationUser,
        Permission,
        Project,
        ProjectUser,
        Role,
        User,
      ],
    };
  }
}

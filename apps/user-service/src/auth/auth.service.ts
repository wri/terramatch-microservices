import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '@terramatch-microservices/database';

@Injectable()
export class AuthService {
  constructor(private readonly dataSource: DataSource) {}

  async login(email_address: string, password: string) {
    const user = await this.dataSource.manager.findOneBy(User, { email_address });

    return `Auth Service [${email_address}, ${user.id}, ${user.uuid}]`;
  }
}

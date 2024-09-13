import { Injectable } from '@nestjs/common';
import { User } from '@terramatch-microservices/database';

@Injectable()
export class AuthService {
  async login(email_address: string, password: string) {
    const user = await User.findOneBy({ email_address });

    return `Auth Service [${email_address}, ${user.id}, ${user.uuid}]`;
  }
}

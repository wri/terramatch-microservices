import { Injectable } from '@nestjs/common';
import { User } from '@terramatch-microservices/database';
import bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  async login(emailAddress: string, password: string) {
    // TODO: what additional fields do we need for JWT generation? This could simply be
    //  User.findOneBy(), but it's nice not to have to pull the whole role from this fairly large
    //  table
    const { password: passwordHash } =
      await User.findOne({ select: { password: true }, where: { emailAddress } }) ?? {};
    if (passwordHash == null) return null;

    const passwordValid = await bcrypt.compare(password, passwordHash);
    if (!passwordValid) return null;

    return `Auth Service [${passwordHash}]`;
  }
}

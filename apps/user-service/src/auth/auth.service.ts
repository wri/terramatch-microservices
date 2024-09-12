import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  login(email_address: string, password: string) {
    return `Auth Service [${email_address}, ${password}]`;
  }
}

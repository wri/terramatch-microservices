import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  login(): { message: string } {
    return { message: 'Login endpoint' };
  }
}

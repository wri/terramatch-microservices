import { Injectable } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { JwtService } from "@nestjs/jwt";
import { User } from "@terramatch-microservices/database/entities";

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async login(emailAddress: string, password: string) {
    const { id, password: passwordHash } =
      (await User.findOne({ where: { emailAddress }, attributes: ["id", "password"] })) ?? {};
    if (passwordHash == null) return null;

    const passwordValid = await bcrypt.compare(password, passwordHash);
    if (!passwordValid) return null;

    await User.update({ lastLoggedInAt: new Date() }, { where: { id } });

    const token = await this.jwtService.signAsync(
      {
        sub: id,
        // sha1 hash of 'App\\Models\\V2\\User'. Needed for the PHP Backend to
        // successfully find a user based on the JWT token generated here.
        prv: "71af459e0508a77644680012c8d33882322544be"
      },
      {
        expiresIn: "12h"
      }
    );
    return { token, userId: id };
  }
}

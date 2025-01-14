import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { User } from '@terramatch-microservices/database/entities';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RequestResetPasswordDto } from './dto/reset-password-request.dto';
import { ResetPasswordResponseDto } from './dto/reset-password-response.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class ResetPasswordService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    //private readonly userService: UserService  // Assuming you have a User service to interact with the database
  ) {}

  async sendResetPasswordEmail(emailAddress: string) {
    const user = await User.findOne({ where: { emailAddress } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const resetToken = await this.jwtService.signAsync(
      { sub: user.uuid }, // user id as the subject
      { expiresIn: '1h', secret: 'reset_password_secret' } // token expires in 1 hour
    );

    const resetLink = `https://your-app.com/reset-password?token=${resetToken}`;
    await this.emailService.sendEmail(
      user.emailAddress,
      'Reset Password',
      `Click the link to reset your password: ${resetLink}`
    );

    const resetPasswordResponse = new ResetPasswordResponseDto({emailAddress: user.emailAddress, uuid: user.uuid});
    return resetPasswordResponse;
  }

  async resetPassword(resetToken: string, newPassword: string) {
    let userId;
    try {
      const payload = await this.jwtService.verifyAsync(resetToken, {
        secret: 'reset_password_secret',
      });
      userId = payload.sub;
    } catch (error) {
      throw new BadRequestException('Invalid or expired token');
    }

    const user = await User.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.update({ password: hashedPassword }, { where: { id: userId } });

    return { message: 'Password successfully reset' };
  }
}

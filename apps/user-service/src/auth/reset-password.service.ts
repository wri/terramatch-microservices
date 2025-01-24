import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { User, LocalizationKeys } from '@terramatch-microservices/database/entities';
import { ResetPasswordResponseDto } from './dto/reset-password-response.dto';
import { EmailService } from '../email/email.service';
import { ResetPasswordResponseOperationDto } from "./dto/reset-password-response-operation.dto";

@Injectable()
export class ResetPasswordService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async sendResetPasswordEmail(emailAddress: string, callbackUrl: string) {
    const user = await User.findOne({ where: { emailAddress } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const resetToken = await this.jwtService.signAsync(
      { sub: user.uuid }, // user id as the subject
      { expiresIn: '1h', secret: 'reset_password_secret' } // token expires in 1 hour
    );

    const localizationKeys = await LocalizationKeys.findOne({where: { key: 'reset-password.body'}});

    if (!localizationKeys) {
      throw new NotFoundException('Localization body not found');
    }

    const resetLink = `${callbackUrl}/${resetToken}`;
    const bodyEmail = localizationKeys.value.replace('link', `<a href="${resetLink}">link</a>`);
    await this.emailService.sendEmail(
      user.emailAddress,
      'Reset Password',
      bodyEmail,
    );

    return new ResetPasswordResponseDto({emailAddress: user.emailAddress, uuid: user.uuid, userId: user.id});
  }

  async resetPassword(resetToken: string, newPassword: string) {
    console.log(" token: ", resetToken)
    let userId;
    try {
      const payload = await this.jwtService.verifyAsync(resetToken, {
        secret: 'reset_password_secret',
      });
      userId = payload.sub;
    } catch (error) {
      console.log(error)
      throw new BadRequestException('Invalid or provide token is expired');
    }

    const user = await User.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.update({ password: hashedPassword }, { where: { id: userId } });

    return new ResetPasswordResponseOperationDto({ userId: user.id, message: 'Password successfully reset' });
  }
}

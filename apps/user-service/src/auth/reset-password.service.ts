import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { User, LocalizationKey } from '@terramatch-microservices/database/entities';
import { ResetPasswordResponseDto } from './dto/reset-password-response.dto';
import { ResetPasswordResponseOperationDto } from "./dto/reset-password-response-operation.dto";
import { EmailService } from "@terramatch-microservices/common/email/email.service";

@Injectable()
export class ResetPasswordService {

  private readonly logger: Logger;

  constructor(
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,

  ) {
    this.logger = new Logger(ResetPasswordService.name);
  }

  async sendResetPasswordEmail(emailAddress: string, callbackUrl: string) {
    const user = await User.findOne({ where: { emailAddress } });
    if (user == null) {
      throw new NotFoundException('User not found');
    }

    const localizationKeys = await LocalizationKey.findOne({where: { key: 'reset-password.body'}});

    if (localizationKeys == null) {
      throw new NotFoundException('Localization body not found');
    }

    const resetToken = await this.jwtService.signAsync(
      { sub: user.uuid }, // user id as the subject
      { expiresIn: '2h' } // token expires in 2 hour
    );

    const resetLink = `${callbackUrl}/${resetToken}`;
    const bodyEmail = localizationKeys.value.replace('link', `<a href="${resetLink}" target="_blank">link</a>`);
    await this.emailService.sendEmail(
      user.emailAddress,
      'Reset Password', // TODO add localization
      bodyEmail,
    );

    return {email: user.emailAddress, uuid: user.uuid, userId: user.id};
  }

  async resetPassword(resetToken: string, newPassword: string) {
    let userId;
    try {
      const payload = await this.jwtService.verifyAsync(resetToken);
      userId = payload.sub;
    } catch (error) {
      this.logger.error(error);
      throw new BadRequestException('Provided token is invalid or expired');
    }

    const user = await User.findOne({ where: { uuid: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.update({ password: hashedPassword }, { where: { id: userId } });

    return new ResetPasswordResponseOperationDto({ userId: user.id, message: 'Password successfully reset' });
  }
}

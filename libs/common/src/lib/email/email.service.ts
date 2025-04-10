import { Injectable } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { ConfigService } from "@nestjs/config";
import * as Mail from "nodemailer/lib/mailer";

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>("MAIL_HOST"),
      port: this.configService.get<number>("MAIL_PORT"),
      secure: this.configService.get<number>("MAIN_PORT") === 465,
      auth: {
        user: this.configService.get<string>("MAIL_USERNAME"),
        pass: this.configService.get<string>("MAIL_PASSWORD")
      }
    });
  }

  async sendEmail(to: string, subject: string, body: string) {
    const headers = {} as { [p: string]: string | string[] | { prepared: boolean; value: string } };
    const mailOptions: Mail.Options = {
      from: this.configService.get<string>("MAIL_FROM_ADDRESS"),
      to,
      subject,
      html: body,
      headers
    };

    const mailRecipients = (this.configService.get<string>("MAIL_RECIPIENTS") ?? "").split(",");
    if (mailRecipients[0] !== "") {
      // This will likely expand to include multiple to / cc / bcc addresses, so preparing for that now
      // with a more complex structure than a simple string
      headers["X-Original-Recipients"] = { prepared: true, value: JSON.stringify({ to }) };

      mailOptions.to = mailRecipients;
    }

    await this.transporter.sendMail(mailOptions);
  }
}

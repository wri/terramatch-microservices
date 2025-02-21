import { Injectable } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { ConfigService } from "@nestjs/config";
import * as Handlebars from "handlebars";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  private template: Handlebars.TemplateDelegate;

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

    const templatePath = path.join(__dirname, "..", "user-service/views", "default-email.hbs");
    const templateSource = fs.readFileSync(templatePath, "utf-8");
    this.template = Handlebars.compile(templateSource);
  }

  renderTemplate(data: any): string {
    return this.template(data);
  }

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    const mailOptions = {
      from: this.configService.get<string>("MAIL_FROM_ADDRESS"),
      sender: this.configService.get<string>("MAIL_FROM_NAME"),
      to,
      subject,
      html: body
    };

    await this.transporter.sendMail(mailOptions);
  }
}

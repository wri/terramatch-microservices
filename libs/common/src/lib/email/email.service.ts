import { Injectable, InternalServerErrorException } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { ConfigService } from "@nestjs/config";
import * as Mail from "nodemailer/lib/mailer";
import { Dictionary, isEmpty } from "lodash";
import { LocalizationService } from "../localization/localization.service";
import { TemplateService } from "./template.service";
import { User } from "@terramatch-microservices/database/entities";

type I18nEmailOptions = {
  i18nReplacements?: Dictionary<string>;
  additionalValues?: Dictionary<string>;
};

const EMAIL_TEMPLATE = "libs/common/src/lib/views/default-email.hbs";

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly configService: ConfigService,
    private readonly localizationService: LocalizationService,
    private readonly templateService: TemplateService
  ) {
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

  filterEntityEmailRecipients(recipients: User[]) {
    const entityDoNotEmailList = this.configService.get("ENTITY_UPDATE_DO_NOT_EMAIL");
    if (isEmpty(entityDoNotEmailList)) return recipients;

    const doNotEmail = entityDoNotEmailList.split(",");
    return recipients.filter(({ emailAddress }) => !doNotEmail.includes(emailAddress));
  }

  async renderI18nTemplateEmail(
    locale: string,
    i18nKeys: Dictionary<string>,
    { i18nReplacements, additionalValues }: I18nEmailOptions = {}
  ) {
    if (i18nKeys["subject"] == null) throw new InternalServerErrorException("Email subject is required");
    const { subject, ...translated } = await this.localizationService.translateKeys(
      i18nKeys,
      locale,
      i18nReplacements ?? {}
    );

    const body = this.templateService.render(EMAIL_TEMPLATE, { ...translated, ...(additionalValues ?? {}) });
    return { subject, body };
  }

  async sendI18nTemplateEmail(
    to: string | string[],
    locale: string,
    i18nKeys: Dictionary<string>,
    { i18nReplacements, additionalValues }: I18nEmailOptions = {}
  ) {
    const { subject, body } = await this.renderI18nTemplateEmail(locale, i18nKeys, {
      i18nReplacements,
      additionalValues
    });
    await this.sendEmail(to, subject, body);
  }

  async sendEmail(to: string | string[], subject: string, body: string) {
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

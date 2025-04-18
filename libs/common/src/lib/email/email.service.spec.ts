import { Test } from "@nestjs/testing";
import { EmailService } from "./email.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { LocalizationService } from "../localization/localization.service";
import { UserFactory } from "@terramatch-microservices/database/factories";
import { TemplateService } from "../templates/template.service";

jest.mock("nodemailer");

describe("EmailService", () => {
  let service: EmailService;
  let configService: DeepMocked<ConfigService>;
  let transporter: nodemailer.Transporter;
  let localizationService: DeepMocked<LocalizationService>;
  let templateService: DeepMocked<TemplateService>;

  beforeEach(async () => {
    // @ts-expect-error mock compiler confusion
    nodemailer.createTransport.mockReturnValue({ sendMail: jest.fn() });

    const module = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: (configService = createMock<ConfigService>()) },
        { provide: LocalizationService, useValue: (localizationService = createMock<LocalizationService>()) },
        { provide: TemplateService, useValue: (templateService = createMock<TemplateService>()) }
      ]
    }).compile();

    service = module.get(EmailService);
    transporter = (service as unknown as { transporter: nodemailer.Transporter }).transporter;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  it("sends email", async () => {
    configService.get.mockImplementation((envName: string) => {
      if (envName === "MAIL_FROM_ADDRESS") return "person@terramatch.org";
      if (envName === "MAIL_RECIPIENTS") return "";
      return "";
    });
    await service.sendEmail("foo@bar.com", "Subject", "Body");
    expect(transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "person@terramatch.org",
        to: "foo@bar.com",
        subject: "Subject",
        html: "Body"
      })
    );
  });

  it("changes the to addresses based on MAIL_RECIPIENTS in env", async () => {
    configService.get.mockImplementation((envName: string) => {
      if (envName === "MAIL_FROM_ADDRESS") return "person@terramatch.org";
      if (envName === "MAIL_RECIPIENTS") return "person@wri.org";
      return "";
    });
    await service.sendEmail("foo@bar.com", "Subject", "Body");
    expect(transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "person@terramatch.org",
        to: ["person@wri.org"],
        subject: "Subject",
        html: "Body",
        headers: {
          "X-Original-Recipients": { prepared: true, value: JSON.stringify({ to: "foo@bar.com" }) }
        }
      })
    );
  });

  it("filters email addresses based on ENTITY_UPDATE_DO_NOT_EMAIL in env", async () => {
    const u1 = await UserFactory.create();
    const u2 = await UserFactory.create();
    const u3 = await UserFactory.create();
    configService.get.mockImplementation((envName: string) => {
      if (envName === "ENTITY_UPDATE_DO_NOT_EMAIL") return `${u1.emailAddress},vader@empire.com`;
      return "";
    });

    const filtered = service.filterEntityEmailRecipients([u1, u2, u3]);
    expect(filtered.length).toBe(2);
    expect(filtered.map(({ id }) => id)).toEqual([u2, u3].map(({ id }) => id));
  });

  it("returns the list of users when there is no do not email list", async () => {
    const users = await UserFactory.createMany(3);
    configService.get.mockImplementation((envName: string) => {
      if (envName === "ENTITY_UPDATE_DO_NOT_EMAIL") return "";
      return "";
    });
    expect(service.filterEntityEmailRecipients(users)).toBe(users);
  });

  it("throws if the template subject key is not provided", async () => {
    await expect(service.sendI18nTemplateEmail("", "en-GB", {})).rejects.toThrow("Email subject is required");
  });

  it("translates and renders template, then sends email", async () => {
    configService.get.mockImplementation((envName: string) => {
      if (envName === "MAIL_FROM_ADDRESS") return "person@terramatch.org";
      if (envName === "MAIL_RECIPIENTS") return "";
      return "";
    });

    const to = ["pd@wri.org", "monitoring-partner@wri.org"];
    const locale = "es-MX";
    const i18nKeys = { subject: "foo-email.subject", body: "foo-email.body" };
    const i18nReplacements = { "{thing}": "replacement" };
    const additionalValues = { link: "aclu.org" };
    await service.sendI18nTemplateEmail(to, locale, i18nKeys, {
      i18nReplacements,
      additionalValues
    });

    expect(localizationService.translateKeys).toHaveBeenCalledWith(i18nKeys, locale, i18nReplacements);
    expect(templateService.render).toHaveBeenCalled();
    expect(transporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: "person@terramatch.org", to }));
  });
});

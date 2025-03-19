import { Test } from "@nestjs/testing";
import { EmailService } from "./email.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

jest.mock("nodemailer");

describe("EmailService", () => {
  let service: EmailService;
  let configService: DeepMocked<ConfigService>;
  let transporter: nodemailer.Transporter;

  beforeEach(async () => {
    // @ts-expect-error mock compiler confusion
    nodemailer.createTransport.mockReturnValue({ sendMail: jest.fn() });

    const module = await Test.createTestingModule({
      providers: [EmailService, { provide: ConfigService, useValue: (configService = createMock<ConfigService>()) }]
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
});

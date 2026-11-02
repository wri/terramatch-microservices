import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { EmailService } from "./email.service";
import { OrganisationApprovedEmail } from "./organisation-approved.email";
import { OrganisationFactory, UserFactory } from "@terramatch-microservices/database/factories";

describe("OrganisationApprovedEmail", () => {
  let emailService: DeepMocked<EmailService>;

  beforeEach(() => {
    emailService = createMock<EmailService>();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends the approval email to the organisation's primary owner", async () => {
    const organisation = await OrganisationFactory.create();
    const owner = await UserFactory.create({ organisationId: organisation.id, locale: "es-MX" });
    const approver = await UserFactory.create();

    await new OrganisationApprovedEmail({
      organisationId: organisation.id,
      approvedByUserId: approver.id
    }).send(emailService);

    expect(emailService.sendI18nTemplateEmail).toHaveBeenCalledWith(
      owner.emailAddress,
      "es-MX",
      {
        subject: "organisation-approved.subject",
        title: "organisation-approved.title",
        body: "organisation-approved.body",
        cta: "organisation-approved.cta"
      },
      { additionalValues: { link: "/auth/login" } }
    );
  });

  it("does not send if the organisation does not exist", async () => {
    await new OrganisationApprovedEmail({ organisationId: -1, approvedByUserId: 1 }).send(emailService);

    expect(emailService.sendI18nTemplateEmail).not.toHaveBeenCalled();
  });

  it("does not send if the organisation has no owner", async () => {
    const organisation = await OrganisationFactory.create();

    await new OrganisationApprovedEmail({ organisationId: organisation.id, approvedByUserId: 1 }).send(emailService);

    expect(emailService.sendI18nTemplateEmail).not.toHaveBeenCalled();
  });

  it("does not send if the owner has no email address", async () => {
    const organisation = await OrganisationFactory.create();
    // The users.email_address column is nullable, but the entity types it as a non-null string.
    await UserFactory.create({ organisationId: organisation.id, emailAddress: null as unknown as string });

    await new OrganisationApprovedEmail({ organisationId: organisation.id, approvedByUserId: 1 }).send(emailService);

    expect(emailService.sendI18nTemplateEmail).not.toHaveBeenCalled();
  });
});

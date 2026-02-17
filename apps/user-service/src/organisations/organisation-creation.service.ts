import { BadRequestException, Injectable } from "@nestjs/common";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { CreateOrganisationStatus, OrganisationCreateAttributes } from "./dto/organisation-create.dto";
import {
  Application,
  Form,
  FormSubmission,
  FundingProgramme,
  ModelHasRole,
  Organisation,
  ProjectPitch,
  Role,
  Stage,
  User
} from "@terramatch-microservices/database/entities";
import { DRAFT, PENDING } from "@terramatch-microservices/database/constants/status";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { AdminUserCreationEmail } from "@terramatch-microservices/common/email/admin-user-creation.email";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";

@Injectable()
export class OrganisationCreationService {
  protected readonly logger = new TMLogger(OrganisationCreationService.name);

  constructor(@InjectQueue("email") private readonly emailQueue: Queue) {}

  async createOrganisation(attributes: OrganisationCreateAttributes) {
    const status = attributes.status ?? PENDING;

    if (status !== DRAFT && status !== PENDING) {
      throw new BadRequestException("Only draft and pending statuses are allowed during organisation creation");
    }

    if (status === DRAFT) {
      return this.createDraft(attributes);
    }

    return this.createWithUser(attributes);
  }

  private async createDraft(attributes: OrganisationCreateAttributes) {
    if (attributes.name != null && (await Organisation.count({ where: { name: attributes.name } })) !== 0) {
      throw new BadRequestException("Organisation already exists");
    }

    const organisation = await Organisation.create(this.buildOrganisationData(attributes, DRAFT) as Organisation);

    const userId = authenticatedUserId();
    if (userId != null) {
      await User.update({ organisationId: organisation.id }, { where: { id: userId } });
    }

    return { user: null, organisation };
  }

  private async createWithUser(attributes: OrganisationCreateAttributes) {
    if (attributes.name != null && (await Organisation.count({ where: { name: attributes.name } })) !== 0) {
      throw new BadRequestException("Organisation already exists");
    }

    const organisation = await Organisation.create(this.buildOrganisationData(attributes, PENDING) as Organisation);

    const hasAllUserFields =
      attributes.userFirstName != null &&
      attributes.userLastName != null &&
      attributes.userEmailAddress != null &&
      attributes.userRole != null &&
      attributes.userLocale != null &&
      attributes.fundingProgrammeUuid != null;

    if (!hasAllUserFields) {
      return { user: null, organisation };
    }

    const { roleId, stageUuid, formUuid, fundingProgrammeName } = await this.validatePendingAssociations(attributes);

    // create User (we know these fields are not null due to hasAllUserFields check)
    const userData: Partial<User> = {
      organisationId: organisation.id,
      emailAddress: attributes.userEmailAddress ?? "",
      firstName: attributes.userFirstName ?? "",
      lastName: attributes.userLastName ?? "",
      locale: attributes.userLocale ?? "en-US",
      // We can set the verified stamp for this user, because they only way they can log in is by following the
      // set password link in the email sent.
      emailAddressVerifiedAt: new Date()
    };
    const user = await User.create(userData as User);
    await ModelHasRole.create({ roleId, modelId: user.id, modelType: User.LARAVEL_TYPE } as ModelHasRole);

    // create Project Pitch, Application and Form Submission for chosen funding programme
    const pitch = await ProjectPitch.create({
      organisationId: organisation.uuid,
      fundingProgrammeId: attributes.fundingProgrammeUuid ?? "",
      level0Proposed: attributes.level0Proposed,
      level1Proposed: attributes.level1Proposed
    } as ProjectPitch);
    const application = await Application.create({
      organisationUuid: organisation.uuid,
      fundingProgrammeUuid: attributes.fundingProgrammeUuid ?? "",
      updatedBy: user.id
    } as Application);
    await FormSubmission.create({
      formId: formUuid,
      stageUuid,
      organisationUuid: organisation.uuid,
      projectPitchUuid: pitch.uuid,
      applicationId: application.id,
      status: "started",
      answers: {}
    });

    // send verification email
    await new AdminUserCreationEmail({ userId: user.id, fundingProgrammeName }).sendLater(this.emailQueue);

    return { user, organisation };
  }

  private buildOrganisationData(
    attributes: OrganisationCreateAttributes,
    status: CreateOrganisationStatus
  ): Partial<Organisation> {
    return {
      status,
      private: false, // required by DB schema, but not in use
      isTest: false, // This endpoint does not create test orgs
      name: attributes.name ?? null,
      type: attributes.type ?? null,
      hqStreet1: attributes.hqStreet1 ?? null,
      hqStreet2: attributes.hqStreet2 ?? null,
      hqCity: attributes.hqCity ?? null,
      hqZipcode: attributes.hqZipcode ?? null,
      hqState: attributes.hqState ?? null,
      hqCountry: attributes.hqCountry ?? null,
      phone: attributes.phone ?? null,
      countries: attributes.countries ?? null,
      currency: attributes.currency ?? "USD",
      level0PastRestoration: attributes.level0PastRestoration ?? null,
      level1PastRestoration: attributes.level1PastRestoration ?? null
    };
  }

  private async validatePendingAssociations(attributes: OrganisationCreateAttributes) {
    const fundingProgramme = await FundingProgramme.findOne({
      where: { uuid: attributes.fundingProgrammeUuid },
      attributes: ["name"]
    });
    if (fundingProgramme == null) {
      throw new BadRequestException("Funding programme not found");
    }

    const stage = await Stage.findOne({
      where: { fundingProgrammeId: attributes.fundingProgrammeUuid },
      order: [["order", "ASC"]],
      attributes: ["id", "uuid"]
    });
    if (stage == null) {
      throw new BadRequestException("Funding programme has no stages");
    }

    const form = await Form.findOne({ where: { stageId: stage.uuid }, attributes: ["uuid"] });
    if (form == null) {
      throw new BadRequestException("Funding programme first stage has no form");
    }

    if ((await User.count({ where: { emailAddress: attributes.userEmailAddress } })) !== 0) {
      throw new BadRequestException("User already exists");
    }

    const role = await Role.findOne({ where: { name: attributes.userRole }, attributes: ["id"] });
    if (role == null) {
      throw new BadRequestException("User role not found");
    }

    return { roleId: role.id, stageUuid: stage.uuid, formUuid: form.uuid, fundingProgrammeName: fundingProgramme.name };
  }
}

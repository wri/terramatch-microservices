import { BadRequestException, Injectable } from "@nestjs/common";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { EmailService } from "@terramatch-microservices/common/email/email.service";
import { OrganisationCreateAttributes } from "./dto/organisation-create.dto";
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

@Injectable()
export class OrganisationCreationService {
  protected readonly logger = new TMLogger(OrganisationCreationService.name);

  constructor(private readonly emailService: EmailService) {}

  async createNewOrganisation(attributes: OrganisationCreateAttributes) {
    const { roleId, stageUuid, formUuid } = await this.validateAttributes(attributes);

    // create Organisation
    const orgData: Partial<Organisation> = {
      status: "pending",
      private: false, // required by DB schema, but not in use
      isTest: false, // This endpoint does not create test orgs
      name: attributes.name,
      type: attributes.type,
      hqStreet1: attributes.hqStreet1,
      hqStreet2: attributes.hqStreet2,
      hqCity: attributes.hqCity,
      hqZipcode: attributes.hqZipcode,
      hqCountry: attributes.hqCountry,
      phone: attributes.phone,
      countries: attributes.countries,
      currency: attributes.currency ?? "USD",
      level0PastRestoration: attributes.level0PastRestoration ?? null,
      level1PastRestoration: attributes.level1PastRestoration ?? null
    };
    const organisation = await Organisation.create(orgData as Organisation);

    // create User
    const userData: Partial<User> = {
      organisationId: organisation.id,
      emailAddress: attributes.userEmailAddress,
      firstName: attributes.userFirstName,
      lastName: attributes.userLastName,
      locale: attributes.userLocale
    };
    const user = await User.create(userData as User);
    await ModelHasRole.create({ roleId, modelId: user.id, modelType: User.LARAVEL_TYPE } as ModelHasRole);

    // create Project Pitch, Application and Form Submission for chosen funding programme
    const pitch = await ProjectPitch.create({
      organisationId: organisation.uuid,
      fundingProgrammeId: attributes.fundingProgrammeUuid,
      level0Proposed: attributes.level0Proposed,
      level1Proposed: attributes.level1Proposed
    } as ProjectPitch);
    const application = await Application.create({
      organisationUuid: organisation.uuid,
      fundingProgrammeUuid: attributes.fundingProgrammeUuid,
      updatedBy: user.id
    } as Application);
    await FormSubmission.create({
      formId: formUuid,
      stageUuid,
      organisationUuid: organisation.uuid,
      projectPitchUuid: pitch.uuid,
      applicationId: application.id,
      status: "started",
      answers: []
    } as FormSubmission);

    // send verification email

    return { user, organisation };
  }

  private async validateAttributes(attributes: OrganisationCreateAttributes) {
    if ((await Organisation.count({ where: { name: attributes.name } })) !== 0) {
      throw new BadRequestException("Organisation already exists");
    }

    if ((await FundingProgramme.count({ where: { uuid: attributes.fundingProgrammeUuid } })) !== 1) {
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

    return { roleId: role.id, stageUuid: stage.uuid, formUuid: form.uuid };
  }
}

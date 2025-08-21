import { BadRequestException, Injectable } from "@nestjs/common";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { EmailService } from "@terramatch-microservices/common/email/email.service";
import { OrganisationCreateAttributes } from "./dto/organisation-create.dto";
import { FundingProgramme, Organisation, Role, Stage, User } from "@terramatch-microservices/database/entities";

@Injectable()
export class OrganisationCreationService {
  protected readonly logger = new TMLogger(OrganisationCreationService.name);

  constructor(private readonly emailService: EmailService) {}

  async createNewOrganisation(attributes: OrganisationCreateAttributes) {
    await this.validateAttributes(attributes);
  }

  private async validateAttributes(attributes: OrganisationCreateAttributes) {
    if ((await Organisation.count({ where: { name: attributes.organisationName } })) !== 0) {
      throw new BadRequestException("Organisation already exists");
    }

    if ((await FundingProgramme.count({ where: { uuid: attributes.fundingProgrammeUuid } })) !== 1) {
      throw new BadRequestException("Funding programme not found");
    }

    if ((await Stage.count({ where: { fundingProgrammeId: attributes.fundingProgrammeUuid } })) === 0) {
      throw new BadRequestException("Funding programme has no stages");
    }

    if ((await User.count({ where: { emailAddress: attributes.userEmailAddress } })) !== 0) {
      throw new BadRequestException("User already exists");
    }

    if ((await Role.count({ where: { name: attributes.userRole } })) === 0) {
      throw new BadRequestException("User role not found");
    }
  }
}

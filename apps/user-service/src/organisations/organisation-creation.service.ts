import { Injectable } from "@nestjs/common";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { EmailService } from "@terramatch-microservices/common/email/email.service";
import { OrganisationCreateAttributes } from "./dto/organisation-create.dto";

@Injectable()
export class OrganisationCreationService {
  protected readonly logger = new TMLogger(OrganisationCreationService.name);

  constructor(private readonly emailService: EmailService) {}

  async createNewOrganisation(attributes: OrganisationCreateAttributes) {}
}

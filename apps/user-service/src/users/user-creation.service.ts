import { Injectable, NotFoundException, BadRequestException, LoggerService } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { User } from "@terramatch-microservices/database/entities";
import { EmailService } from "@terramatch-microservices/common/email/email.service";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { TMLogService } from "@terramatch-microservices/common/util/tm-log.service";

@Injectable()
export class UserCreationService {
  protected readonly logger: LoggerService = new TMLogService(UserCreationService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly localizationService: LocalizationService
  ) {}

  //public const DEFAULT_USER_ROLE = 'project-developer';
  // public const USER_SELECTABLE_ROLES = [self::DEFAULT_USER_ROLE, 'funder', 'government'];

  async createNewUser() {
    // receive a callback_url from the request
    // perform the validation for payload of the user
    // save the user, assign the rol passing on the payload, if the rol is invalid, will assign a default rol 'project-developer'
    // send the email verification using te callback_url and user
    return { email: null, uuid: null };
  }
}

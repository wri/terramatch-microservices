import { EmailService } from "./email.service";

export abstract class EmailProcessor {
  abstract send(emailService: EmailService): Promise<void>;
}

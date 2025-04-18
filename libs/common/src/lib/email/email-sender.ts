import { EmailService } from "./email.service";

export abstract class EmailSender {
  abstract send(emailService: EmailService): Promise<void>;
}

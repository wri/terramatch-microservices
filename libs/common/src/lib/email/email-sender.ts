import { EmailService } from "./email.service";
import { Queue } from "bullmq";

export abstract class EmailSender<Data> {
  protected constructor(private readonly name: string, protected readonly data: Data) {}

  async sendLater(emailQueue: Queue) {
    await emailQueue.add(this.name, this.data);
  }

  abstract send(emailService: EmailService): Promise<void>;
}

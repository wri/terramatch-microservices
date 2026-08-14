import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { Task } from "@terramatch-microservices/database/entities";
import {
  FRAMEWORK_KEYS_TF_REPORT_REMINDER,
  FrameworkKeyTFReportReminder
} from "@terramatch-microservices/database/constants";
import { TerrafundReportReminderEmail } from "../email/terrafund-report-reminder.email";

@Injectable()
export class ProductEventService {
  constructor(@InjectQueue("email") private readonly emailQueue: Queue) {}

  async taskCreated(task: Task) {
    // TODO: This method is going to get a lot more sophisticated over time. For now, it's simply
    //   handling the email send that was going out in ScheduledJobsProcessor on reporting task
    //   creation

    if (task.category === "project-reporting") {
      const project = await task.$get("project", { attributes: ["id", "frameworkKey"] });
      const frameworkKey = project?.frameworkKey;
      if (
        frameworkKey != null &&
        FRAMEWORK_KEYS_TF_REPORT_REMINDER.includes(frameworkKey as FrameworkKeyTFReportReminder)
      ) {
        await new TerrafundReportReminderEmail({
          projectIds: [project?.id as number],
          dueAt: task.dueAt?.toISOString()
        }).sendLater(this.emailQueue);
      }
    }
  }
}

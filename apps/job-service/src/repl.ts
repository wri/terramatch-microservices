import { DateTime } from "luxon";
import { AppModule } from "./app.module";
import { bootstrapRepl } from "@terramatch-microservices/common/util/bootstrap-repl";
import { ScheduledJob } from "@terramatch-microservices/database/entities";
import {
  EPA,
  FRAMEWORK_KEYS_TF,
  FUNDO_FLORA_1,
  HBF,
  PPC,
  TERRAFUND
} from "@terramatch-microservices/database/constants";

bootstrapRepl("Job Service", AppModule, {
  // One off scripts for running in the REPL. Should be cleared out occasionally once they've been
  // run in all relevant environments.
  oneOff: {
    // https://gfw.atlassian.net/browse/TM-2031 and https://gfw.atlassian.net/browse/TM-2264.
    // May be removed after the JJ release in July 2025
    seedScheduledJobs: async () => {
      const utcDate = (year: number, month: number, day: number) => DateTime.utc(year, month, day).toJSDate();

      let executionTime = utcDate(2025, 11, 30);
      await ScheduledJob.scheduleReportReminder(executionTime, TERRAFUND);
      await ScheduledJob.scheduleSiteAndNurseryReminder(executionTime, TERRAFUND);

      executionTime = utcDate(2026, 5, 30);
      await ScheduledJob.scheduleReportReminder(executionTime, TERRAFUND);
      await ScheduledJob.scheduleSiteAndNurseryReminder(executionTime, TERRAFUND);

      // One off to immediately create the July EPA reports.
      await ScheduledJob.scheduleTaskDue(utcDate(2025, 6, 30), EPA, utcDate(2025, 7, 30));

      // All four TF frameworks get the same scheduling
      executionTime = utcDate(2026, 1, 1);
      let dueAt = utcDate(2026, 1, 30);
      for (const framework of FRAMEWORK_KEYS_TF) {
        await ScheduledJob.scheduleTaskDue(executionTime, framework, dueAt);
      }

      executionTime = utcDate(2026, 7, 1);
      dueAt = utcDate(2026, 7, 30);
      for (const framework of FRAMEWORK_KEYS_TF) {
        await ScheduledJob.scheduleTaskDue(executionTime, framework, dueAt);
      }

      // PPC
      await ScheduledJob.scheduleTaskDue(utcDate(2025, 9, 12), PPC, utcDate(2025, 10, 3));
      await ScheduledJob.scheduleTaskDue(utcDate(2025, 12, 1), PPC, utcDate(2026, 1, 7));
      await ScheduledJob.scheduleTaskDue(utcDate(2026, 3, 13), PPC, utcDate(2026, 4, 3));
      await ScheduledJob.scheduleTaskDue(utcDate(2026, 6, 12), PPC, utcDate(2026, 7, 3));

      // HBF
      await ScheduledJob.scheduleTaskDue(utcDate(2025, 11, 1), HBF, utcDate(2025, 12, 1));
      await ScheduledJob.scheduleTaskDue(utcDate(2026, 5, 1), HBF, utcDate(2026, 6, 1));
    },
    seedReportingCalendarScheduledJobs: async () => {
      const utcDate = (year: number, month: number, day: number) => DateTime.utc(year, month, day).toJSDate();

      // TerraFund family: terrafund, terrafund-landscapes, terrafund-3, enterprises, epa-ghana-pilot
      for (const framework of FRAMEWORK_KEYS_TF) {
        await ScheduledJob.scheduleTaskDue(utcDate(2026, 7, 1), framework, utcDate(2026, 7, 31));
        await ScheduledJob.scheduleTaskDue(utcDate(2027, 1, 1), framework, utcDate(2027, 1, 31));
      }

      // HBF: May–Oct → gen Nov 1 / due Dec 1 | Nov–Apr → gen May 1 / due Jun 1
      await ScheduledJob.scheduleTaskDue(utcDate(2026, 11, 1), HBF, utcDate(2026, 12, 1));
      await ScheduledJob.scheduleTaskDue(utcDate(2027, 5, 1), HBF, utcDate(2027, 6, 1));

      // TerraFund family: terrafund, terrafund-landscapes, terrafund-3, enterprises, epa-ghana-pilot
      // PPC: quarterly cycles
      await ScheduledJob.scheduleTaskDue(utcDate(2026, 9, 1), PPC, utcDate(2026, 10, 7));
      await ScheduledJob.scheduleTaskDue(utcDate(2026, 12, 1), PPC, utcDate(2027, 1, 7));
      await ScheduledJob.scheduleTaskDue(utcDate(2027, 3, 1), PPC, utcDate(2027, 4, 7));
      await ScheduledJob.scheduleTaskDue(utcDate(2027, 6, 1), PPC, utcDate(2027, 7, 7));

      // Fundo Flora 1: Mar–Aug → gen Sep 1 / due Sep 30 | Sep–Feb → gen Mar 1 / due Mar 31
      await ScheduledJob.scheduleTaskDue(utcDate(2026, 9, 1), FUNDO_FLORA_1, utcDate(2026, 9, 30));
      await ScheduledJob.scheduleTaskDue(utcDate(2027, 3, 1), FUNDO_FLORA_1, utcDate(2027, 3, 31));
    }
  }
});

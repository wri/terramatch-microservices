import { DateTime } from "luxon";
import { AppModule } from "./app.module";
import { bootstrapRepl } from "@terramatch-microservices/common/util/bootstrap-repl";
import { ScheduledJob } from "@terramatch-microservices/database/entities";
import { FRAMEWORK_KEYS_TF, FUNDO_FLORA, HBF, PPC } from "@terramatch-microservices/database/constants";

bootstrapRepl("Job Service", AppModule, {
  // One off scripts for running in the REPL. Should be cleared out occasionally once they've been
  // run in all relevant environments.
  oneOff: {
    seedReportingCalendarScheduledJobs: async () => {
      const utcDate = (year: number, month: number, day: number) => DateTime.utc(year, month, day).toJSDate();

      // TerraFund family: terrafund-non-profits, terrafund-enterprises, epa-ghana-pilot
      for (const framework of FRAMEWORK_KEYS_TF) {
        await ScheduledJob.scheduleTaskDue(utcDate(2026, 7, 1), framework, utcDate(2026, 7, 31));
        await ScheduledJob.scheduleTaskDue(utcDate(2027, 1, 1), framework, utcDate(2027, 1, 31));
        await ScheduledJob.scheduleTaskDue(utcDate(2027, 7, 1), framework, utcDate(2027, 7, 31));
      }

      // HBF: May–Oct → gen Nov 1 / due Dec 1 | Nov–Apr → gen May 1 / due Jun 1
      await ScheduledJob.scheduleTaskDue(utcDate(2026, 11, 1), HBF, utcDate(2026, 12, 1));
      await ScheduledJob.scheduleTaskDue(utcDate(2027, 5, 1), HBF, utcDate(2027, 6, 1));

      // PPC: quarterly cycles
      await ScheduledJob.scheduleTaskDue(utcDate(2026, 9, 1), PPC, utcDate(2026, 10, 7));
      await ScheduledJob.scheduleTaskDue(utcDate(2026, 12, 1), PPC, utcDate(2027, 1, 7));
      await ScheduledJob.scheduleTaskDue(utcDate(2027, 3, 1), PPC, utcDate(2027, 4, 7));
      await ScheduledJob.scheduleTaskDue(utcDate(2027, 6, 1), PPC, utcDate(2027, 7, 7));

      // Fundo Flora: Mar–Aug → gen Sep 1 / due Sep 30 | Sep–Feb → gen Mar 1 / due Mar 31
      await ScheduledJob.scheduleTaskDue(utcDate(2026, 9, 1), FUNDO_FLORA, utcDate(2026, 9, 30));
      await ScheduledJob.scheduleTaskDue(utcDate(2027, 3, 1), FUNDO_FLORA, utcDate(2027, 3, 31));
    }
  }
});

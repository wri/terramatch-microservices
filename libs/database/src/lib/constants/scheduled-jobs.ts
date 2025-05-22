export const TASK_DUE = "App\\Models\\V2\\ScheduledJobs\\TaskDueJob" as const;
export const REPORT_REMINDER = "App\\Models\\V2\\ScheduledJobs\\ReportReminderJOb" as const;
export const SITE_AND_NURSERY_REMINDER = "App\\Models\\V2\\ScheduledJobs\\SiteAndNurseryReminderJob" as const;
export const SCHEDULED_JOBS = [TASK_DUE, REPORT_REMINDER, SITE_AND_NURSERY_REMINDER] as const;
export type ScheduledJobType = (typeof SCHEDULED_JOBS)[number];

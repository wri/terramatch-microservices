export const TASK_DUE = "App\\Models\\V2\\ScheduledJobs\\TaskDueJob" as const;
export const SITE_AND_NURSERY_REMINDER = "App\\Models\\V2\\ScheduledJobs\\SiteAndNurseryReminderJob" as const;
export const SCHEDULED_JOBS = [TASK_DUE, SITE_AND_NURSERY_REMINDER] as const;
export type ScheduledJobType = (typeof SCHEDULED_JOBS)[number];

export type TaskDue = {
  frameworkKey: string;
  dueAt: string;
};

export type SiteAndNurseryReminder = {
  frameworkKey: string;
};

export type ScheduledJobDefinition = TaskDue | SiteAndNurseryReminder;

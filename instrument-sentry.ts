import * as Sentry from "@sentry/nestjs";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

if (process.env.SENTRY_DSN != null) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.DEPLOY_ENV,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0
  });
}

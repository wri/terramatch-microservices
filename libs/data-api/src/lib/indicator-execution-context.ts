export type ExternalRequestLog = {
  url: string;
  method: string;
  statusCode: number;
  statusText: string | null;
  durationMs: number;
  requestSummary: { dataset: string; sql: string };
  responseBody: unknown;
};

export type IndicatorTriggerSource = "user-api" | "manual-edit" | "automated-job" | "system";

const MAX_RESPONSE_BODY_LENGTH = 10_000;

export const truncateForLog = (value: unknown): unknown => {
  if (value == null) return value;
  const serialized = JSON.stringify(value);
  if (serialized.length <= MAX_RESPONSE_BODY_LENGTH) return value;
  return { truncated: true, preview: serialized.slice(0, MAX_RESPONSE_BODY_LENGTH) };
};

export class IndicatorExecutionContext {
  private readonly startedAt = Date.now();
  readonly externalRequests: ExternalRequestLog[] = [];

  constructor(
    readonly triggerSource: IndicatorTriggerSource,
    readonly triggeredBy: number | null,
    readonly delayedJobId?: number | null
  ) {}

  recordRequest(request: ExternalRequestLog) {
    this.externalRequests.push(request);
  }

  elapsedMs() {
    return Date.now() - this.startedAt;
  }
}

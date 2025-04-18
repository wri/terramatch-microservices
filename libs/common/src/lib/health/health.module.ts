import { DynamicModule, Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { HealthController } from "./health.controller";
import { QueueHealthIndicator } from "./queue-health.indicator";
import { QUEUES } from "../common.module";

export const QUEUE_LIST = Symbol("QUEUE_LIST");

type HealthModuleOptions = {
  // Queues to add to what is defined in the common module.
  additionalQueues?: string[];
};

@Module({
  imports: [TerminusModule],
  providers: [QueueHealthIndicator, { provide: QUEUE_LIST, useValue: QUEUES }],
  controllers: [HealthController]
})
export class HealthModule {
  static configure(options: HealthModuleOptions): DynamicModule {
    const queueList = [...QUEUES, ...(options.additionalQueues ?? [])];
    return {
      module: HealthModule,
      imports: [TerminusModule],
      providers: [QueueHealthIndicator, { provide: QUEUE_LIST, useValue: queueList }],
      controllers: [HealthController]
    };
  }
}

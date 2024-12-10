import { FactoryGirl } from 'factory-girl-ts';
import { DelayedJob } from '../entities';

export const DelayedJobFactory = FactoryGirl.define(DelayedJob, async () => ({
  uuid: crypto.randomUUID(),
  status: 'succeeded',
  statusCode: 200,
  payload: { "data": "test" },
  totalContent: 0,
  processedContent: 0,
  progressMessage: "test",
  isAcknowledged: false,
  createdBy: 1290
}));

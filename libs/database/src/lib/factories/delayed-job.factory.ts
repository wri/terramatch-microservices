import { FactoryGirl } from 'factory-girl-ts';
import { DelayedJob } from '../entities';

export const DelayedJobFactory = FactoryGirl.define(DelayedJob, async () => ({
  uuid: crypto.randomUUID(),
  status: 'succeeded',
  statusCode: 200,
  payload: { "data": "test" }
}));

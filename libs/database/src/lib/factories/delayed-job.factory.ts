import { FactoryGirl } from 'factory-girl-ts';
import { DelayedJob } from '../entities';

export const DelayedJobFactory = FactoryGirl.define(DelayedJob, async () => ({
  uuid: crypto.randomUUID(),
  status: 'succeeded',
  statusCode: 200,
  // TODO: this will need an update when `payload` has been converted to a jsonb field
  payload: '{ "data": "test" }'
}));

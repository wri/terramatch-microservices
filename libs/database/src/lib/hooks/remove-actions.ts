import { Action } from "../entities";
import { LaravelModel } from "../types/util";

export const removeActions = async (instance: LaravelModel) => {
  await Action.for(instance).destroy();
};

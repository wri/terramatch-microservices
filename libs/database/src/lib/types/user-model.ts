export const USER_DATA_MODELS = ["tasks"] as const;
export type UserDataModel = (typeof USER_DATA_MODELS)[number];

export type UserDataModelUpdateEvent = {
  model: UserDataModel;
  modelId: number;
  userIds: number[];
};

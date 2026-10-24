export const USER_DATA_MODELS = ["notifications", "tasks"] as const;
export type UserDataModel = (typeof USER_DATA_MODELS)[number];

export type UserDataModelUpdateEvent = {
  model: UserDataModel;
  modelId: number;
  userIds: number[];
};

// Deletions carry the resource UUID so that consumers don't need to load a model that may no longer exist.
export type UserDataModelDeleteEvent = {
  model: UserDataModel;
  uuid: string;
  userIds: number[];
};

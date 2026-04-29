import { RequestContext } from "nestjs-request-context";

export const getRequestCached = async <T>(name: string, generator: () => Promise<T>): Promise<T> => {
  if (RequestContext.currentContext?.req == null) return await generator();

  const value = RequestContext.currentContext.req[name] as T | undefined;
  if (value != null) return value;

  return (RequestContext.currentContext.req[name] = await generator());
};

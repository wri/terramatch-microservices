import Debug from "debug";
import { CLUSTER, Environment, Service } from "./consts";
import { ECSClient, ListTasksCommand } from "@aws-sdk/client-ecs";

export const rootDebug = Debug("tm-v3-cli");

export const printVerboseHook = thisCommand => {
  const options = thisCommand.opts();

  if (options.verbose as boolean) {
    Debug.enable("tm-v3-cli*");
    rootDebug(`TerraMatch v3 CLI arguments`);
    rootDebug(options);
  }
};

export const getTaskId = async (
  service: Service,
  env: Environment,
  debug: Debug.Debugger,
  debugError: Debug.Debugger
) => {
  debug("Getting tasks");

  const client = new ECSClient();
  const command = new ListTasksCommand({ cluster: CLUSTER, family: `terramatch-${service}-${env}` });
  try {
    const { taskArns } = await client.send(command);
    return taskArns?.[0]?.split("/").pop();
  } catch (e) {
    debugError(`Failed to get task id ${e}`);
  }
  return undefined;
};

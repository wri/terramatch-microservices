import { Argument, Command } from "commander";
import { rootDebug } from "../utils";
import { ECSClient, ExecuteCommandCommand, ListTasksCommand } from "@aws-sdk/client-ecs";
import { ENVIRONMENTS, SERVICES } from "../consts";

const debug = rootDebug.extend("test");
const debugError = rootDebug.extend("test:error");

const CLUSTER = "terramatch-microservices";

const getTaskId = async (service: string, env: string) => {
  const client = new ECSClient();
  const command = new ListTasksCommand({ cluster: CLUSTER, family: `terramatch-${service}-${env}` });
  try {
    const { taskArns } = await client.send(command);
    return taskArns[0]?.split("/").pop();
  } catch (e) {
    debugError(`Failed to get task id ${e}`);
  }
  return undefined;
};

// const startRepl = async (taskId: string) => {
//   const client = new ECSClient();
//   const command = new ExecuteCommandCommand({ cluster: CLUSTER, task: taskId, interactive: true, command: "/bin/sh" });
//   console.log("repl output", await client.send(command));
// };

export const remoteReplCommand = () =>
  new Command("remote-repl")
    .addArgument(new Argument("service", "The remote v3 service to connect to").choices(SERVICES))
    .addArgument(new Argument("environment", "The environment to connect to").choices(ENVIRONMENTS))
    .action(async (service: string, environment: string) => {
      debug("Getting tasks");

      const taskId = await getTaskId(service, environment);
      debug(`Found task id: ${taskId}`);

      // await startRepl(taskId);
    });

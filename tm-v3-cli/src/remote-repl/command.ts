import { Argument, Command } from "commander";
import { rootDebug } from "../utils";
import { ECSClient, ExecuteCommandCommand, ListTasksCommand } from "@aws-sdk/client-ecs";
import { CLUSTER, Environment, ENVIRONMENTS, Service, SERVICES } from "../consts";

import { WebSocket } from "ws";
import { ssm } from "ssm-session";
import { TextDecoder, TextEncoder } from "util";

const debug = rootDebug.extend("remote-repl");
const debugError = rootDebug.extend("remote-repl:error");

const TERM_OPTIONS = { rows: 34, cols: 197 };

const getTaskId = async (service: Service, env: Environment) => {
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

const startRepl = async (taskId: string, service: Service) => {
  const client = new ECSClient();
  const command = new ExecuteCommandCommand({
    cluster: CLUSTER,
    task: taskId,
    interactive: true,
    command: `node dist/apps/${service}-repl`
  });
  const {
    session: { streamUrl, tokenValue }
  } = await client.send(command);

  const textDecoder = new TextDecoder();
  const textEncoder = new TextEncoder();

  debug("Starting ECS Exec stream connection");
  const connection = new WebSocket(streamUrl);

  process.stdin.setRawMode(true);
  // This will prevent the process for exiting until we explicitly call process.exit()
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (key: string) => {
    if (key === "\u0003") {
      debug("Killing process with ctrl-c");
      process.exit();
    } else if (connection.readyState === connection.OPEN) {
      ssm.sendText(connection, textEncoder.encode(key));
    }
  });

  connection.onopen = () => {
    ssm.init(connection, { token: tokenValue, termOptions: TERM_OPTIONS });
  };

  connection.onmessage = event => {
    const agentMessage = ssm.decode(event.data);
    ssm.sendACK(connection, agentMessage);
    if (agentMessage.payloadType === 1) {
      process.stdout.write(textDecoder.decode(agentMessage.payload));
    } else if (agentMessage.payloadType === 17) {
      ssm.sendInitMessage(connection, TERM_OPTIONS);
    }
  };

  connection.onerror = error => {
    debugError(`ECS Exec stream error: ${error}`);
    process.exit(1);
  };

  connection.onclose = () => {
    debug("ECS Exec stream closed");
    process.exit(0);
  };
};

export const remoteReplCommand = () =>
  new Command("remote-repl")
    .addArgument(new Argument("service", "The remote v3 service to connect to").choices(SERVICES))
    .addArgument(new Argument("environment", "The environment to connect to").choices(ENVIRONMENTS))
    .action(async (service: Service, environment: Environment) => {
      debug("Getting tasks");

      const taskId = await getTaskId(service, environment);
      if (taskId == null) return;
      debug(`Found task id: ${taskId}`);

      await startRepl(taskId, service);
    });

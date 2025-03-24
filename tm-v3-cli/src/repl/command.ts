import { Argument, Command } from "commander";
import { rootDebug } from "../utils";
import { ECSClient, ExecuteCommandCommand, ListTasksCommand } from "@aws-sdk/client-ecs";
import { CLUSTER, Environment, ENVIRONMENTS, Service, SERVICES } from "../consts";

import { WebSocket } from "ws";
import { ssm } from "ssm-session";
import { TextDecoder, TextEncoder } from "util";
import { spawn } from "child_process";

const debug = rootDebug.extend("remote-repl");
const debugError = rootDebug.extend("remote-repl:error");

const TERM_OPTIONS = { rows: 34, cols: 197 };

const startLocalRepl = async (service: Service) => {
  debug(`Building REPL for ${service}`);
  await new Promise<void>(resolve => {
    const build = spawn("nx", ["build-repl", service, "--no-cloud"], { stdio: "inherit" });
    build.on("close", code => {
      if (code === 0) {
        debug(`REPL build complete for ${service}`);
        resolve();
      } else {
        debugError(`REPL build for ${service} failed with code: ${code}`);
        process.exit(code);
      }
    });
  });

  debug(`Launching REPL process for ${service}`);
  spawn("node", [`dist/apps/${service}-repl`], { stdio: "inherit" });
};

const getTaskId = async (service: Service, env: Environment) => {
  debug("Getting tasks");

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

const startRemoteRepl = async (taskId: string, service: Service) => {
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

export const replCommand = () =>
  new Command("repl")
    .description("Starts a remote or local REPL for the given service.")
    .addArgument(new Argument("service", "The v3 service to connect to").choices(SERVICES))
    .addArgument(
      new Argument("environment", "The environment to connect to").choices(ENVIRONMENTS).default("local").argOptional()
    )
    .action(async (service: Service, environment: Environment) => {
      if (environment === "local") {
        await startLocalRepl(service);
      } else {
        const taskId = await getTaskId(service, environment);
        if (taskId == null) return;
        debug(`Found task id: ${taskId}`);

        await startRemoteRepl(taskId, service);
      }
    });

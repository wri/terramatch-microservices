import { Argument, Command, Option } from "commander";
import { getTaskId, rootDebug } from "../utils";
import { ECSClient, ExecuteCommandCommand } from "@aws-sdk/client-ecs";
import { CLUSTER, Environment, ENVIRONMENTS, Service, SERVICES } from "../consts";

import { WebSocket } from "ws";
import { ssm } from "ssm-session";
import { TextDecoder, TextEncoder } from "util";
import { spawn } from "child_process";

const debug = rootDebug.extend("remote-repl");
const debugError = rootDebug.extend("remote-repl:error");

const TERM_OPTIONS = { rows: 34, cols: 197 };

const ECS_COMMANDS = ["repl", "sh"] as const;
type EcsCommand = (typeof ECS_COMMANDS)[number];

const startLocalRepl = async (service: Service, script?: string) => {
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
  if (script == null) {
    spawn("node", [`dist/apps/${service}-repl`], {
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "development", REPL: "true" }
    });
  } else {
    const repl = spawn("node", [`dist/apps/${service}-repl`], {
      env: { ...process.env, NODE_ENV: "development", REPL: "true" }
    });

    const exitCode = await new Promise((resolve, reject) => {
      repl.on("close", resolve);
      repl.on("error", reject);

      repl.stdout.on("data", data => {
        const line: string = data.toString();
        console.log(line.trim());

        if (line.includes("REPL initialized")) {
          repl.stdin.write(`${script}\n`);
          repl.stdin.end();
        }
      });
    });

    debug(`Process completed with exit code: ${exitCode}`);
  }
};

const getRemoteCommandString = (service: Service, remoteCommand: EcsCommand, script?: string) => {
  switch (remoteCommand) {
    case "repl": {
      const prefix = script == null ? "" : `echo -e "${script}\nprocess.exit()" | `;
      return `sh -c '${prefix}REPL=true node dist/apps/${service}-repl'`;
    }
    case "sh":
      return "sh";

    default:
      debugError(`Unrecognized command: ${remoteCommand}`);
      process.exit(-1);
  }
};

const startRemoteRepl = async (taskId: string, service: Service, remoteCommand: EcsCommand, script?: string) => {
  const client = new ECSClient();
  const command = getRemoteCommandString(service, remoteCommand, script);
  debug(`Setting command to run after connection: ${command}`);
  const executionCommand = new ExecuteCommandCommand({
    cluster: CLUSTER,
    task: taskId,
    interactive: true,
    command
  });
  const sessionResponse = await client.send(executionCommand);
  if (sessionResponse?.session?.streamUrl == null) {
    debugError("Failed to start remote session");
    process.exit(1);
  }
  const {
    session: { streamUrl, tokenValue }
  } = sessionResponse;

  debug("Starting ECS Exec stream connection");
  const connection = new WebSocket(streamUrl);

  if (script == null) {
    const textEncoder = new TextEncoder();
    process.stdin.setRawMode(true);
    // This will prevent the process from exiting until we explicitly call process.exit()
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
  }

  connection.onopen = () => {
    ssm.init(connection, { token: tokenValue, termOptions: TERM_OPTIONS });
  };

  const textDecoder = new TextDecoder();
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
    .addOption(
      new Option("-c, --command <command>", "Ignored in local environment. Command to run after connecting.")
        .default("repl")
        .choices(ECS_COMMANDS)
    )
    .addOption(
      new Option(
        "-s, --script <script>",
        "Script to execute after connecting to the REPL. If provided, the script will be executed and then the REPL will be closed. Only valid if the command is 'repl'."
      )
    )
    .action(
      async (
        service: Service,
        environment: Environment,
        { command, script }: { command: EcsCommand; script?: string }
      ) => {
        if (environment === "local") {
          await startLocalRepl(service, script);
        } else {
          const taskId = await getTaskId(service, environment, debug, debugError);
          if (taskId == null) return;
          debug(`Found task id: ${taskId}`);

          await startRemoteRepl(taskId, service, command as EcsCommand, script);
        }
      }
    );

import { Command } from "commander";
import { StartupError } from "../errors.js";
import { runStart } from "../bootstrap/state-machine.js";
import type { StartArgs } from "../types.js";

export function registerStartCommand(program: Command): void {
  program
    .command("start")
    .description("Start rx-workflow API with lite or standard runtime profile")
    .option("--lite", "Use SQLite (default)")
    .option("--standard", "Use PostgreSQL + Redis")
    .option("--redis-url <url>", "External Redis URL (with password)")
    .option("--postgres-url <url>", "External PostgreSQL URL (with password)")
    .option("--no-docker-auto", "Do not auto-start Docker dependencies")
    .option("--auto-port", "Use free host ports when starting Docker deps")
    .option(
      "--deps-lifecycle <mode>",
      "keep or down after API exits",
      "keep",
    )
    .option("--startup-timeout <sec>", "Dependency health timeout", "60")
    .option("--docker-compose-file <path>", "Compose file for dependencies")
    .option(
      "--with-web",
      "Run predev and start Vite dev server on :5173",
    )
    .option(
      "--with-crewai",
      "Ensure crewai-runner is healthy and inject CREWAI_RUNNER_URL",
    )
    .option(
      "--crewai-url <url>",
      "External CrewAI sidecar URL (skips Docker auto-deploy)",
    )
    .action(async (opts) => {
      const args: StartArgs = {};

      if (opts.lite && opts.standard) {
        console.error("Cannot use --lite and --standard together.");
        process.exit(1);
      }
      if (opts.standard) args.mode = "standard";
      else if (opts.lite) args.mode = "lite";

      if (opts.redisUrl) args.redisUrl = opts.redisUrl;
      if (opts.postgresUrl) args.postgresUrl = opts.postgresUrl;
      if (opts.noDockerAuto) args.noDockerAuto = true;
      if (opts.autoPort) args.autoPort = true;
      if (opts.withWeb) args.withWeb = true;
      if (opts.withCrewai) args.withCrewai = true;
      if (opts.crewaiUrl) args.crewaiUrl = opts.crewaiUrl;

      const lifecycle = opts.depsLifecycle as string;
      if (lifecycle === "keep" || lifecycle === "down") {
        args.depsLifecycle = lifecycle;
      } else if (lifecycle) {
        console.error("--deps-lifecycle must be keep or down");
        process.exit(1);
      }

      args.startupTimeoutSec = Number(opts.startupTimeout);
      if (opts.dockerComposeFile) {
        args.dockerComposeFile = opts.dockerComposeFile;
      }

      try {
        const result = await runStart(args);
        process.exit(result.exitCode);
      } catch (err) {
        if (err instanceof StartupError) {
          console.error(`[${err.code}] ${err.message}`);
        } else if (err instanceof Error) {
          console.error(err.message);
        } else {
          console.error(String(err));
        }
        process.exit(1);
      }
    });
}

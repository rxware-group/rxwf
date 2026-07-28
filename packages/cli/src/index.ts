#!/usr/bin/env node
import { Command } from "commander";
import { registerDepsCommand } from "./commands/deps.js";
import { registerStartCommand } from "./commands/start.js";

const program = new Command();
program.name("rxwf").description("rx-workflow CLI").version("0.0.0");

registerStartCommand(program);
registerDepsCommand(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

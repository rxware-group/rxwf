#!/usr/bin/env node

import { getFlag, requireFlag } from './parse-args.js';
import { runInfo } from './commands/info.js';
import { runRegister } from './commands/register.js';
import { runStart } from './commands/start.js';
import { runValidateExtensions } from './commands/validate-extensions.js';

const argv = process.argv.slice(2);
const command = argv[0];

function printUsage(): void {
  console.error(`Usage:
  rxwf-runner register --config <path> --token <token>
  rxwf-runner start --config <path>
  rxwf-runner info --config <path>
  rxwf-runner validate-extensions --config <path>`);
}

async function main(): Promise<void> {
  if (!command || command === '--help' || command === '-h') {
    printUsage();
    process.exit(command ? 0 : 1);
  }

  try {
    switch (command) {
      case 'register': {
        const configPath = requireFlag(
          argv,
          'config',
          'rxwf-runner register --config <path> --token <token>',
        );
        const token = requireFlag(
          argv,
          'token',
          'rxwf-runner register --config <path> --token <token>',
        );
        await runRegister({ configPath, token });
        break;
      }
      case 'start': {
        const configPath = requireFlag(argv, 'config', 'rxwf-runner start --config <path>');
        await runStart(configPath);
        break;
      }
      case 'info': {
        const configPath = requireFlag(argv, 'config', 'rxwf-runner info --config <path>');
        await runInfo(configPath);
        break;
      }
      case 'validate-extensions': {
        const configPath = requireFlag(
          argv,
          'config',
          'rxwf-runner validate-extensions --config <path>',
        );
        await runValidateExtensions(configPath);
        break;
      }
      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

void main();

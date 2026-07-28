import Fastify from "fastify";
import type { LiteDatabase } from "@rxwf/providers-lite";
import { bootstrap } from "./bootstrap.js";
import type { BuildAppOptions } from "./build-options.js";

export type { BuildAppOptions } from "./build-options.js";

export async function buildApp(
  options: BuildAppOptions = {},
): Promise<{ app: ReturnType<typeof Fastify>; db: LiteDatabase }> {
  const app = Fastify({ logger: options.logger ?? false });
  const db = await bootstrap(app, options);
  return { app, db };
}

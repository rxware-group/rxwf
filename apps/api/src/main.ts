import { buildApp } from "./app.js";
import { config } from "./config.js";

console.log("Starting rx-workflow API…");
const { app } = await buildApp({ logger: true });

await app.listen({ port: config.httpPort, host: "0.0.0.0" });
console.log(`rx-workflow API http://localhost:${config.httpPort}`);
console.log(`  auth: POST /api/auth/setup | /api/auth/login | GET /api/auth/status`);

const shutdown = async (signal: string) => {
  console.log(`${signal} received, closing API…`);
  try {
    await app.close();
  } finally {
    process.exit(0);
  }
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

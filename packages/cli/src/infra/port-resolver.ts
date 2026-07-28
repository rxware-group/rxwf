import { createServer } from "node:net";

export async function findFreePort(host = "127.0.0.1"): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, host, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("Could not resolve free port"));
        return;
      }
      const port = addr.port;
      server.close(() => resolve(port));
    });
  });
}

export async function resolveAutoPorts(): Promise<{
  postgresHostPort: number;
  redisHostPort: number;
}> {
  const [postgresHostPort, redisHostPort] = await Promise.all([
    findFreePort(),
    findFreePort(),
  ]);
  return { postgresHostPort, redisHostPort };
}

export function formatPortBinding(hostPort: number, containerPort: number): string {
  return `127.0.0.1:${hostPort}:${containerPort}`;
}

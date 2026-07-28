import { execSync } from "node:child_process";

const PORTS = [8787, 5173, 5174];

function killPort(port) {
  try {
    execSync(`npx --yes kill-port ${port}`, { stdio: "ignore" });
  } catch {
    /* already free */
  }

  if (process.platform !== "win32") {
    return;
  }

  try {
    const out = execSync(`netstat -ano | findstr :${port}`, {
      encoding: "utf8",
    });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes("LISTENING")) continue;
      const parts = line.trim().split(/\s+/);
      const pid = Number(parts[parts.length - 1]);
      if (Number.isFinite(pid) && pid > 0) {
        pids.add(pid);
      }
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
      } catch {
        /* process gone */
      }
    }
  } catch {
    /* no listener */
  }
}

for (const port of PORTS) {
  killPort(port);
}

if (process.platform === "win32") {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 800);
}

import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const rootDir = process.cwd();
const isWindows = process.platform === "win32";
const nextCli = "node_modules/next/dist/bin/next";
const playwrightCli = "node_modules/@playwright/test/cli.js";
const configuredBaseUrl = process.env.E2E_BASE_URL;

const port = configuredBaseUrl
  ? Number(process.env.E2E_PORT ?? new URL(configuredBaseUrl).port)
  : await resolvePort();
const baseUrl = configuredBaseUrl ?? `http://127.0.0.1:${port}`;
const cliArgs = process.argv.slice(2);

let webServer;

try {
  if (!configuredBaseUrl) {
    webServer = startWebServer(port);
    await waitForServer(baseUrl, 120_000);
  }

  process.exitCode = await runPlaywright(baseUrl, port, cliArgs);
} finally {
  await stopWebServer(webServer);
}

function startWebServer(portNumber) {
  const child = spawn(
    process.execPath,
    [
      nextCli,
      "dev",
      "apps/web",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(portNumber),
    ],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: "http://127.0.0.1:4010",
        NEXT_PUBLIC_GA_MEASUREMENT_ID: "",
        NEXT_PUBLIC_GTM_ID: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[WebServer] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[WebServer] ${chunk}`);
  });

  return child;
}

async function runPlaywright(baseUrlValue, portNumber, extraArgs) {
  const child = spawn(
    process.execPath,
    [
      playwrightCli,
      "test",
      "--config=e2e/playwright.config.ts",
      ...extraArgs,
    ],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        E2E_BASE_URL: baseUrlValue,
        E2E_PORT: String(portNumber),
      },
      stdio: "inherit",
      windowsHide: true,
    },
  );

  const [code] = await once(child, "exit");
  return typeof code === "number" ? code : 1;
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await delay(500);
  }

  const message =
    lastError instanceof Error ? ` Last error: ${lastError.message}` : "";
  throw new Error(`E2E web server did not start at ${url}.${message}`);
}

async function resolvePort() {
  if (process.env.E2E_PORT) {
    const fixedPort = Number(process.env.E2E_PORT);
    if (!Number.isInteger(fixedPort) || fixedPort <= 0) {
      throw new Error(`Invalid E2E_PORT value: ${process.env.E2E_PORT}`);
    }
    return fixedPort;
  }

  for (let candidate = 3100; candidate < 3200; candidate += 1) {
    if (await isPortAvailable(candidate)) {
      return candidate;
    }
  }

  throw new Error("No available E2E port found between 3100 and 3199.");
}

function isPortAvailable(portNumber) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(portNumber, "127.0.0.1");
  });
}

async function stopWebServer(child) {
  if (!child || child.exitCode !== null || !child.pid) {
    return;
  }

  if (isWindows) {
    child.stdout?.destroy();
    child.stderr?.destroy();
    child.unref();

    const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    killer.unref();
    return;
  }

  child.kill("SIGTERM");

  const timeout = delay(5_000).then(() => "timeout");
  const stopped = once(child, "exit").then(() => "exit");
  const result = await Promise.race([timeout, stopped]);

  if (result === "timeout") {
    child.kill("SIGKILL");
    await once(child, "exit");
  }
}

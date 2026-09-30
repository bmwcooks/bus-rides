import { spawn } from "node:child_process";
import { rmSync } from "node:fs";

rmSync("/tmp/bus-rides-do-test", { recursive: true, force: true });

const origin = "https://bmwcooks.github.io";
const base = "http://127.0.0.1:8787";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ready() {
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(base + "/count", { headers: { Origin: origin } });
      if (res.status === 200) return;
    } catch (err) {
      /* Worker still starting. */
    }
    await sleep(250);
  }
  throw new Error("worker did not start");
}

async function api(path, method, requestOrigin = origin) {
  const res = await fetch(base + path, {
    method,
    headers: requestOrigin ? { Origin: requestOrigin, Accept: "application/json" } : { Accept: "application/json" },
  });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch (err) {
    body = text;
  }
  return { status: res.status, body, allow: res.headers.get("access-control-allow-origin") };
}

const child = spawn(
  "npx",
  ["wrangler", "dev", "--port", "8787", "--ip", "127.0.0.1", "--persist-to", "/tmp/bus-rides-do-test"],
  {
    cwd: new URL("..", import.meta.url),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "true" },
  }
);
let logs = "";
child.stdout.on("data", (chunk) => { logs += chunk; });
child.stderr.on("data", (chunk) => { logs += chunk; });

try {
  await ready();
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };

  const denied = await api("/increment", "POST", "https://evil.example");
  expect("deny other origin", denied.status === 403);

  const noOrigin = await api("/increment", "POST", null);
  expect("deny missing origin", noOrigin.status === 403);

  const start = await api("/count", "GET");
  expect("starts at 0", start.status === 200 && start.body.count === 0 && start.allow === origin);

  const one = await api("/increment", "POST");
  const two = await api("/increment", "POST");
  expect("increment", one.body.count === 1 && two.body.count === 2);

  const back = await api("/decrement", "POST");
  expect("decrement", back.body.count === 1);

  await api("/decrement", "POST");
  const floored = await api("/decrement", "POST");
  expect("floor at 0", floored.body.count === 0);

  const bursts = await Promise.all(Array.from({ length: 20 }, () => api("/increment", "POST")));
  const counts = bursts.map((res) => res.body.count).sort((a, b) => a - b);
  const end = await api("/count", "GET");
  expect("atomic burst", end.body.count === 20 && counts[0] === 1 && counts[19] === 20);

  if (failures.length) {
    console.error("FAIL", failures);
    console.error(logs.slice(-4000));
    process.exitCode = 1;
  } else {
    console.log("PASS", { end: end.body.count });
  }
} catch (err) {
  console.error(err);
  console.error(logs.slice(-4000));
  process.exitCode = 1;
} finally {
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch (err) {
    child.kill("SIGTERM");
  }
  await sleep(400);
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch (err) {
    child.kill("SIGKILL");
  }
  process.exit(process.exitCode || 0);
}

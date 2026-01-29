import fs from "node:fs";
import path from "node:path";

const dataDir = process.env.DATA_DIR || path.resolve("data");
const dbPath = process.env.DB_PATH || path.join(dataDir, "db.json");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const defaultState = { servers: [], nextId: 1 };
let writeQueue = Promise.resolve();

async function readDb() {
  try {
    const raw = await fs.promises.readFile(dbPath, "utf-8");
    const data = JSON.parse(raw);
    return {
      servers: Array.isArray(data.servers) ? data.servers : [],
      nextId: Number.isInteger(data.nextId) ? data.nextId : 1,
    };
  } catch (err) {
    if (err.code === "ENOENT") return { ...defaultState };
    throw err;
  }
}

function queueWrite(data) {
  writeQueue = writeQueue.then(async () => {
    const payload = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(dbPath, payload, "utf-8");
  });
  return writeQueue;
}

export async function listServers() {
  const data = await readDb();
  return data.servers.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getServer(id) {
  const data = await readDb();
  return data.servers.find((s) => s.id === id) || null;
}

export async function createServer(input) {
  const data = await readDb();
  const now = new Date().toISOString();
  const server = {
    id: data.nextId++,
    name: input.name,
    host: input.host,
    port: input.port ?? 161,
    community: input.community ?? "public",
    version: input.version ?? "2c",
    enabled: input.enabled ? 1 : 0,
    diskProfile: input.diskProfile ?? "auto",
    diskPath: input.diskPath ?? "",
    created_at: now,
    updated_at: now,
    last_stats_json: null,
    last_stats_at: null,
  };
  data.servers.push(server);
  await queueWrite(data);
  return server;
}

export async function updateServer(id, input) {
  const data = await readDb();
  const server = data.servers.find((s) => s.id === id);
  if (!server) return null;
  server.name = input.name;
  server.host = input.host;
  server.port = input.port ?? 161;
  server.community = input.community ?? "public";
  server.version = input.version ?? "2c";
  server.enabled = input.enabled ? 1 : 0;
  server.diskProfile = input.diskProfile ?? "auto";
  server.diskPath = input.diskPath ?? "";
  server.updated_at = new Date().toISOString();
  await queueWrite(data);
  return server;
}

export async function deleteServer(id) {
  const data = await readDb();
  data.servers = data.servers.filter((s) => s.id !== id);
  await queueWrite(data);
}

export async function saveStats(id, stats) {
  const data = await readDb();
  const server = data.servers.find((s) => s.id === id);
  if (!server) return;
  server.last_stats_json = JSON.stringify(stats);
  server.last_stats_at = new Date().toISOString();
  server.updated_at = server.last_stats_at;
  await queueWrite(data);
}

export async function getLastStats(id) {
  const data = await readDb();
  const server = data.servers.find((s) => s.id === id);
  if (!server || !server.last_stats_json) return null;
  return {
    stats: JSON.parse(server.last_stats_json),
    at: server.last_stats_at,
  };
}

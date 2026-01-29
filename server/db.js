import fs from "node:fs";
import path from "node:path";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

const dataDir = process.env.DATA_DIR || path.resolve("data");
const dbPath = process.env.DB_PATH || path.join(dataDir, "db.json");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const adapter = new JSONFile(dbPath);
const db = new Low(adapter, { servers: [], nextId: 1 });

async function load() {
  await db.read();
  db.data ||= { servers: [], nextId: 1 };
  db.data.servers ||= [];
  db.data.nextId ||= 1;
}

async function save() {
  await db.write();
}

export async function listServers() {
  await load();
  return db.data.servers.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getServer(id) {
  await load();
  return db.data.servers.find((s) => s.id === id) || null;
}

export async function createServer(data) {
  await load();
  const now = new Date().toISOString();
  const server = {
    id: db.data.nextId++,
    name: data.name,
    host: data.host,
    port: data.port ?? 161,
    community: data.community ?? "public",
    version: data.version ?? "2c",
    enabled: data.enabled ? 1 : 0,
    created_at: now,
    updated_at: now,
    last_stats_json: null,
    last_stats_at: null,
  };
  db.data.servers.push(server);
  await save();
  return server;
}

export async function updateServer(id, data) {
  await load();
  const server = db.data.servers.find((s) => s.id === id);
  if (!server) return null;
  server.name = data.name;
  server.host = data.host;
  server.port = data.port ?? 161;
  server.community = data.community ?? "public";
  server.version = data.version ?? "2c";
  server.enabled = data.enabled ? 1 : 0;
  server.updated_at = new Date().toISOString();
  await save();
  return server;
}

export async function deleteServer(id) {
  await load();
  db.data.servers = db.data.servers.filter((s) => s.id !== id);
  await save();
}

export async function saveStats(id, stats) {
  await load();
  const server = db.data.servers.find((s) => s.id === id);
  if (!server) return;
  server.last_stats_json = JSON.stringify(stats);
  server.last_stats_at = new Date().toISOString();
  server.updated_at = server.last_stats_at;
  await save();
}

export async function getLastStats(id) {
  await load();
  const server = db.data.servers.find((s) => s.id === id);
  if (!server || !server.last_stats_json) return null;
  return {
    stats: JSON.parse(server.last_stats_json),
    at: server.last_stats_at,
  };
}

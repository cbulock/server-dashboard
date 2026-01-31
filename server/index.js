import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  listServers,
  getServer,
  createServer,
  updateServer,
  deleteServer,
  saveStats,
  getLastStats,
} from "./db.js";
import { fetchSnmpStats } from "./snmp.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pollIntervalMinutes = Number(process.env.POLL_INTERVAL_MINUTES || 360);
const safeMinutes = Number.isFinite(pollIntervalMinutes)
  ? Math.max(1, pollIntervalMinutes)
  : 360;
const pollIntervalMs = safeMinutes * 60 * 1000;
let pollInFlight = false;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/servers", async (req, res) => {
  res.json(await listServers());
});

app.post("/api/servers", async (req, res) => {
  const {
    name,
    host,
    port: serverPort,
    community,
    version,
    enabled,
    serverType,
    diskProfile,
    diskPath,
  } = req.body;
  if (!name || !host) {
    return res.status(400).json({ error: "name and host are required" });
  }
  const server = await createServer({
    name,
    host,
    port: serverPort,
    community,
    version,
    enabled: enabled !== false,
    serverType,
    diskProfile,
    diskPath,
  });
  res.status(201).json(server);
});

app.get("/api/servers/:id", async (req, res) => {
  const server = await getServer(Number(req.params.id));
  if (!server) return res.status(404).json({ error: "not found" });
  res.json(server);
});

app.put("/api/servers/:id", async (req, res) => {
  const id = Number(req.params.id);
  const {
    name,
    host,
    port: serverPort,
    community,
    version,
    enabled,
    serverType,
    diskProfile,
    diskPath,
  } = req.body;
  const existing = await getServer(id);
  if (!existing) return res.status(404).json({ error: "not found" });
  if (!name || !host) {
    return res.status(400).json({ error: "name and host are required" });
  }
  const server = await updateServer(id, {
    name,
    host,
    port: serverPort,
    community,
    version,
    enabled: enabled !== false,
    serverType,
    diskProfile,
    diskPath,
  });
  res.json(server);
});

app.delete("/api/servers/:id", async (req, res) => {
  const id = Number(req.params.id);
  const existing = await getServer(id);
  if (!existing) return res.status(404).json({ error: "not found" });
  await deleteServer(id);
  res.status(204).end();
});

app.get("/api/servers/:id/stats", async (req, res) => {
  const id = Number(req.params.id);
  const server = await getServer(id);
  if (!server) return res.status(404).json({ error: "not found" });

  const useCache = req.query.cached === "true";
  if (useCache) {
    const last = await getLastStats(id);
    if (last) return res.json({ ...last.stats, cachedAt: last.at });
  }

  try {
    const includeRaw = req.query.debug === "true";
    const stats = await fetchSnmpStats(server, { includeRaw });
    if (
      stats.detectedType &&
      stats.detectedType !== server.serverType
    ) {
      const updated = {
        ...server,
        serverType: stats.detectedType,
      };
      await updateServer(id, updated);
    }
    await saveStats(id, stats);
    res.json(stats);
  } catch (err) {
    res.status(502).json({
      error: "snmp_failed",
      message: err?.message || "SNMP request failed",
    });
  }
});

const distPath = path.resolve(__dirname, "..", "web", "dist");
app.use(express.static(distPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, () => {
  console.log(`Server dashboard listening on http://localhost:${port}`);
});

async function pollAllServers() {
  if (pollInFlight) return;
  pollInFlight = true;
  try {
    const servers = await listServers();
    for (const server of servers) {
      if (!server.enabled) continue;
      try {
        const stats = await fetchSnmpStats(server);
        if (stats.detectedType && stats.detectedType !== server.serverType) {
          const updated = { ...server, serverType: stats.detectedType };
          await updateServer(server.id, updated);
        }
        await saveStats(server.id, stats);
      } catch (err) {
        // Keep polling other servers even if one fails.
        console.warn(
          `SNMP poll failed for ${server.name} (${server.host}):`,
          err?.message || err
        );
      }
    }
  } finally {
    pollInFlight = false;
  }
}

setInterval(pollAllServers, pollIntervalMs);

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

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/servers", async (req, res) => {
  res.json(await listServers());
});

app.post("/api/servers", async (req, res) => {
  const { name, host, port: serverPort, community, version, enabled } = req.body;
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
  const { name, host, port: serverPort, community, version, enabled } = req.body;
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
    const stats = await fetchSnmpStats(server);
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

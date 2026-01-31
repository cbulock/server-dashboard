<template>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <div class="logo">SD</div>
        <div>
          <div class="title">Server Dashboard</div>
          <div class="subtitle">SNMP pulse for your homelab</div>
        </div>
      </div>
      <div class="actions">
        <button class="ghost" @click="refreshAll" :disabled="busy">
          Refresh all
        </button>
        <button class="primary" @click="openNew">Add server</button>
      </div>
    </header>

    <nav class="tabs">
      <button
        class="tab"
        :class="{ active: activeTab === 'dashboard' }"
        @click="activeTab = 'dashboard'"
      >
        Dashboard
      </button>
      <button
        class="tab"
        :class="{ active: activeTab === 'servers' }"
        @click="activeTab = 'servers'"
      >
        Servers
      </button>
      <div class="spacer"></div>
      <div class="pill" v-if="servers.length">
        {{ servers.filter((s) => s.enabled).length }} active
      </div>
    </nav>

    <main>
      <section v-if="activeTab === 'dashboard'">
        <div class="grid">
          <div v-for="server in servers" :key="server.id" class="card">
            <div class="card-head">
              <div>
                <div class="card-title">{{ server.name }}</div>
                <div class="muted">
                  {{ server.host }}:{{ server.port }}
                </div>
              </div>
              <span class="status" :class="{ off: !server.enabled }">
                {{ server.enabled ? "Online" : "Paused" }}
              </span>
            </div>

            <div v-if="errors[server.id]" class="error">
              {{ errors[server.id] }}
            </div>

            <div v-if="stats[server.id]" class="stats">
              <div class="stat-row">
                <div class="label">Hostname</div>
                <div class="value">{{ stats[server.id].hostname }}</div>
              </div>
              <div class="stat-row">
                <div class="label">Uptime</div>
                <div class="value">
                  {{ formatUptime(stats[server.id].uptimeSeconds) }}
                </div>
              </div>
              <div class="stat-row">
                <div class="label">Memory</div>
                <div class="value">
                  {{ formatBytes(stats[server.id].memory.totalBytes) }}
                </div>
              </div>
              <div class="stat-row">
                <div class="label">Disk</div>
                <div class="value">
                  {{
                    formatBytes(stats[server.id].disk.usedBytes)
                  }}
                  /
                  {{
                    formatBytes(stats[server.id].disk.totalBytes)
                  }}
                </div>
              </div>
              <div class="meter">
                <div
                  class="meter-fill disk"
                  :style="{
                    width: toPercent(
                      stats[server.id].disk.usedBytes,
                      stats[server.id].disk.totalBytes
                    ),
                  }"
                ></div>
              </div>
              <div class="muted tiny">
                Collected {{ formatTime(stats[server.id].collectedAt) }}
              </div>
            </div>

            <div v-else class="empty">
              No stats yet. Click refresh to poll SNMP.
            </div>

            <div class="card-actions">
              <button class="ghost" @click="refreshOne(server)" :disabled="busy">
                Refresh
              </button>
              <button class="ghost" @click="openEdit(server)">Edit</button>
            </div>

            <div class="type-icon corner" :class="typeClass(server)">
              <span
                class="icon-mask"
                :style="iconMaskStyle(server)"
                aria-hidden="true"
              ></span>
            </div>
          </div>
        </div>
      </section>

      <section v-else class="table-wrap">
        <div class="table">
          <div class="row header">
            <div>Name</div>
            <div>Host</div>
            <div>SNMP</div>
            <div>Status</div>
            <div>Actions</div>
          </div>
          <div v-for="server in servers" :key="server.id" class="row">
            <div>
              <div class="card-title">{{ server.name }}</div>
              <div class="muted tiny">ID {{ server.id }}</div>
            </div>
            <div class="mono">{{ server.host }}:{{ server.port }}</div>
            <div class="mono">v{{ server.version }} / {{ server.community }}</div>
            <div>
              <span class="status" :class="{ off: !server.enabled }">
                {{ server.enabled ? "Enabled" : "Disabled" }}
              </span>
            </div>
            <div class="row-actions">
              <button class="ghost" @click="openEdit(server)">Edit</button>
              <button class="ghost danger" @click="removeServer(server)">
                Delete
              </button>
            </div>
            <div class="type-icon corner small" :class="typeClass(server)">
              <span
                class="icon-mask"
                :style="iconMaskStyle(server)"
                aria-hidden="true"
              ></span>
            </div>
          </div>
        </div>

        <div class="note">
          <div class="note-title">SNMP quick notes</div>
          <div class="note-body">
            Enable SNMP on QNAP, Unraid, and Ubuntu hosts. Use a shared
            community string or set per-server values here.
          </div>
        </div>
      </section>
    </main>

    <div v-if="showModal" class="modal">
      <div class="modal-card">
        <div class="modal-head">
          <div class="card-title">
            {{ editingId ? "Edit server" : "Add server" }}
          </div>
          <button class="ghost" @click="closeModal">Close</button>
        </div>
        <form class="form" @submit.prevent="saveServer">
          <label>
            Name
            <input v-model="form.name" required placeholder="Main NAS" />
          </label>
          <label>
            Host / IP
            <input v-model="form.host" required placeholder="192.168.1.10" />
          </label>
          <div class="form-row">
            <label>
              Port
              <input v-model.number="form.port" type="number" min="1" />
            </label>
            <label>
              Version
              <select v-model="form.version">
                <option value="2c">2c</option>
                <option value="1">1</option>
              </select>
            </label>
          </div>
          <label>
            Community
            <input v-model="form.community" placeholder="public" />
          </label>
          <label>
            Server type
            <select v-model="form.serverType">
              <option value="auto">Auto-detect</option>
              <option value="generic">Generic</option>
              <option value="qnap">QNAP</option>
              <option value="unraid">Unraid</option>
              <option value="ubuntu">Ubuntu</option>
            </select>
          </label>
          <label class="toggle">
            <input type="checkbox" v-model="form.enabled" />
            <span>Enabled</span>
          </label>
          <label>
            Disk profile
            <select v-model="form.diskProfile">
              <option value="auto">Auto-detect</option>
              <option value="qnap">QNAP (CACHEDEV1_DATA)</option>
              <option value="unraid">Unraid (/mnt/user)</option>
              <option value="ubuntu">Ubuntu (/)</option>
              <option value="custom">Custom path</option>
            </select>
          </label>
          <label v-if="form.diskProfile === 'custom'">
            Disk path
            <input v-model="form.diskPath" placeholder="/mnt/data" />
          </label>
          <div class="modal-actions">
            <button class="ghost" type="button" @click="closeModal">
              Cancel
            </button>
            <button class="primary" type="submit">
              {{ editingId ? "Save changes" : "Add server" }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";

const apiBase = import.meta.env.VITE_API_BASE || "";
const activeTab = ref("dashboard");
const servers = ref([]);
const stats = reactive({});
const errors = reactive({});
const showModal = ref(false);
const editingId = ref(null);
const busy = ref(false);

const emptyForm = () => ({
  name: "",
  host: "",
  port: 161,
  community: "public",
  version: "2c",
  enabled: true,
  serverType: "auto",
  diskProfile: "auto",
  diskPath: "",
});

const form = reactive(emptyForm());

function resetForm() {
  Object.assign(form, emptyForm());
}

function openNew() {
  editingId.value = null;
  resetForm();
  showModal.value = true;
}

function openEdit(server) {
  editingId.value = server.id;
  Object.assign(form, {
    name: server.name,
    host: server.host,
    port: server.port,
    community: server.community,
    version: server.version,
    enabled: !!server.enabled,
    serverType: server.serverType || "auto",
    diskProfile: server.diskProfile || "auto",
    diskPath: server.diskPath || "",
  });
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
}

async function loadServers() {
  const res = await fetch(`${apiBase}/api/servers`);
  servers.value = await res.json();
}

async function loadCachedStats() {
  for (const server of servers.value) {
    try {
      const res = await fetch(
        `${apiBase}/api/servers/${server.id}/stats?cached=true`
      );
      if (!res.ok) continue;
      stats[server.id] = await res.json();
    } catch (err) {
      // Ignore cache load errors on startup.
    }
  }
}

async function saveServer() {
  const payload = { ...form };
  if (editingId.value) {
    await fetch(`${apiBase}/api/servers/${editingId.value}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } else {
    await fetch(`${apiBase}/api/servers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }
  await loadServers();
  showModal.value = false;
}

async function removeServer(server) {
  if (!confirm(`Delete ${server.name}?`)) return;
  await fetch(`${apiBase}/api/servers/${server.id}`, { method: "DELETE" });
  delete stats[server.id];
  delete errors[server.id];
  await loadServers();
}

async function refreshOne(server) {
  if (!server.enabled) return;
  busy.value = true;
  errors[server.id] = "";
  try {
    const res = await fetch(`${apiBase}/api/servers/${server.id}/stats`);
    if (!res.ok) {
      const payload = await res.json();
      errors[server.id] = payload.message || "Failed to poll SNMP";
      return;
    }
    stats[server.id] = await res.json();
  } catch (err) {
    errors[server.id] = err?.message || "Failed to poll SNMP";
  } finally {
    busy.value = false;
  }
}

async function refreshAll() {
  busy.value = true;
  const targets = servers.value.filter((s) => s.enabled);
  for (const server of targets) {
    await refreshOne(server);
  }
  busy.value = false;
}

function formatBytes(value) {
  if (!value && value !== 0) return "—";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unit]}`;
}

function toPercent(used, total) {
  if (!used || !total) return "0%";
  const pct = Math.min(100, Math.round((used / total) * 100));
  return `${pct}%`;
}

function formatUptime(seconds) {
  if (!seconds && seconds !== 0) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${mins}m`;
}

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function resolveType(server) {
  if (server.serverType && server.serverType !== "auto") {
    return server.serverType;
  }
  if (stats[server.id]?.detectedType) {
    return stats[server.id].detectedType;
  }
  return "generic";
}

function iconUrl(server) {
  const type = resolveType(server);
  if (type === "qnap") return "/icons/qnap.svg";
  if (type === "unraid") return "/icons/unraid.svg";
  if (type === "ubuntu") return "/icons/ubuntu.svg";
  return "/icons/generic.svg";
}

function iconMaskStyle(server) {
  const url = iconUrl(server);
  return {
    WebkitMaskImage: `url(${url})`,
    maskImage: `url(${url})`,
  };
}

function typeClass(server) {
  return `type-${resolveType(server)}`;
}

onMounted(async () => {
  await loadServers();
  await loadCachedStats();
});
</script>

<style>
@import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap");

:root {
  --bg: #0c111b;
  --panel: rgba(18, 24, 38, 0.9);
  --panel-strong: rgba(28, 36, 56, 0.95);
  --text: #eef1f7;
  --muted: #9aa6c5;
  --accent: #33d1ff;
  --accent-2: #f3b63b;
  --danger: #f46f6f;
  --shadow: 0 20px 45px rgba(5, 7, 14, 0.6);
  --radius: 18px;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: "Space Grotesk", sans-serif;
  background: radial-gradient(circle at top, #172038 0%, #0b0f1a 40%, #080b12 100%);
  color: var(--text);
}

.app {
  min-height: 100vh;
  padding: 28px 32px 64px;
  background-image: linear-gradient(120deg, rgba(58, 147, 255, 0.08), transparent 40%),
    radial-gradient(circle at 80% 20%, rgba(255, 197, 89, 0.12), transparent 50%);
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.brand {
  display: flex;
  gap: 16px;
  align-items: center;
}

.logo {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  background: linear-gradient(140deg, var(--accent), #3df0d1);
  color: #08101b;
  font-weight: 700;
  letter-spacing: 1px;
}

.title {
  font-size: 24px;
  font-weight: 700;
}

.subtitle {
  color: var(--muted);
  font-size: 14px;
}

.actions {
  display: flex;
  gap: 12px;
}

button {
  font-family: inherit;
  border: none;
  border-radius: 12px;
  padding: 10px 16px;
  cursor: pointer;
}

.primary {
  background: linear-gradient(135deg, var(--accent), #4b7bff);
  color: #02060d;
  font-weight: 700;
}

.ghost {
  background: var(--panel);
  color: var(--text);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.ghost.danger {
  color: var(--danger);
  border-color: rgba(244, 111, 111, 0.4);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tabs {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.tab {
  background: transparent;
  color: var(--muted);
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid transparent;
}

.tab.active {
  color: var(--text);
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(15, 22, 40, 0.8);
}

.spacer {
  flex: 1;
}

.pill {
  background: rgba(20, 31, 52, 0.7);
  border-radius: 999px;
  padding: 6px 12px;
  color: var(--muted);
  font-size: 12px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.card {
  background: var(--panel-strong);
  border-radius: var(--radius);
  padding: 18px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 12px;
  backdrop-filter: blur(12px);
  position: relative;
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
}

.type-icon {
  height: 20px;
  display: block;
  color: #c6d2f4;
}

.icon-mask {
  height: 100%;
  width: 28px;
  display: block;
  background-color: currentColor;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: auto 100%;
  mask-size: auto 100%;
  -webkit-mask-position: center;
  mask-position: center;
}

.type-icon.small {
  height: 16px;
}

.type-icon.type-qnap {
  height: 30px;
}

.type-icon.small.type-qnap {
  height: 22px;
}

.type-icon.corner {
  position: absolute;
  right: 16px;
  bottom: 16px;
  opacity: 0.85;
}

.type-icon.corner.small {
  right: 12px;
  bottom: 10px;
}

.type-qnap {
  color: #3d6bff;
}

.type-unraid {
  color: #e22828;
}

.type-ubuntu {
  color: #e95420;
}

.type-generic {
  color: #8aa1d6;
}

.type-qnap .icon-mask {
  width: 44px;
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
}

.type-unraid .icon-mask {
  width: 24px;
}

.type-ubuntu .icon-mask {
  width: 22px;
}

.type-generic .icon-mask {
  width: 22px;
}

.muted {
  color: var(--muted);
}

.tiny {
  font-size: 12px;
}

.status {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(51, 209, 255, 0.2);
  color: var(--accent);
}

.status.off {
  background: rgba(244, 111, 111, 0.2);
  color: var(--danger);
}

.stats {
  display: grid;
  gap: 8px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 14px;
}

.label {
  color: var(--muted);
}

.value {
  font-weight: 600;
}

.meter {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  overflow: hidden;
}

.meter-fill {
  height: 100%;
  background: linear-gradient(90deg, #44f2ff, #3a8bff);
}

.meter-fill.disk {
  background: linear-gradient(90deg, #f7c766, #f28b3c);
}

.empty {
  color: var(--muted);
  font-size: 14px;
  padding: 12px 0;
}

.card-actions {
  display: flex;
  gap: 10px;
}

.error {
  background: rgba(244, 111, 111, 0.2);
  color: var(--danger);
  padding: 8px 10px;
  border-radius: 12px;
  font-size: 13px;
}

.table-wrap {
  display: grid;
  gap: 18px;
}

.table {
  background: var(--panel-strong);
  border-radius: var(--radius);
  padding: 12px;
  display: grid;
  gap: 8px;
  box-shadow: var(--shadow);
}

.row {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr 0.6fr 0.8fr;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 12px;
  position: relative;
}

.row.header {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.row:not(.header) {
  background: rgba(11, 16, 29, 0.6);
}

.row-actions {
  display: flex;
  gap: 8px;
}

.mono {
  font-family: "JetBrains Mono", monospace;
  font-size: 13px;
}

.note {
  background: linear-gradient(120deg, rgba(62, 152, 255, 0.18), rgba(243, 182, 59, 0.12));
  border-radius: var(--radius);
  padding: 18px;
}

.note-title {
  font-weight: 600;
  margin-bottom: 6px;
}

.note-body {
  color: var(--muted);
  font-size: 14px;
}

.modal {
  position: fixed;
  inset: 0;
  background: rgba(5, 8, 16, 0.7);
  display: grid;
  place-items: center;
  padding: 24px;
}

.modal-card {
  width: min(520px, 100%);
  background: var(--panel-strong);
  border-radius: var(--radius);
  padding: 20px;
  box-shadow: var(--shadow);
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.form {
  display: grid;
  gap: 14px;
  margin-top: 12px;
}

label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: var(--muted);
}

input,
select {
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(10, 14, 24, 0.9);
  color: var(--text);
  padding: 10px 12px;
  font-size: 14px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}

@media (max-width: 720px) {
  .topbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .tabs {
    flex-wrap: wrap;
  }

  .row {
    grid-template-columns: 1fr;
  }
}
</style>

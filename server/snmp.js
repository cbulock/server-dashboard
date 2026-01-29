import snmp from "net-snmp";

const OIDS = {
  sysName: "1.3.6.1.2.1.1.5.0",
  sysUpTime: "1.3.6.1.2.1.1.3.0",
  hrMemorySize: "1.3.6.1.2.1.25.2.2.0",
  hrStorageTable: "1.3.6.1.2.1.25.2.3.1",
  hrStorageTypeFixedDisk: "1.3.6.1.2.1.25.2.1.4",
  hrStorageTypeRam: "1.3.6.1.2.1.25.2.1.2",
};

function createSession(server) {
  const options = {
    port: server.port || 161,
    retries: 1,
    timeout: 1500,
    version:
      server.version === "1" ? snmp.Version1 : snmp.Version2c,
  };
  return snmp.createSession(server.host, server.community || "public", options);
}

function toNumber(value) {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

async function getBasicStats(session) {
  const oids = [OIDS.sysName, OIDS.sysUpTime, OIDS.hrMemorySize];
  return new Promise((resolve, reject) => {
    session.get(oids, (err, varbinds) => {
      if (err) return reject(err);
      const result = {};
      for (const vb of varbinds) {
        if (snmp.isVarbindError(vb)) continue;
        if (vb.oid === OIDS.sysName) result.sysName = String(vb.value);
        if (vb.oid === OIDS.sysUpTime)
          result.sysUpTimeTicks = toNumber(vb.value);
        if (vb.oid === OIDS.hrMemorySize)
          result.hrMemorySizeKb = toNumber(vb.value);
      }
      resolve(result);
    });
  });
}

async function walkStorage(session) {
  const rows = new Map();
  const base = OIDS.hrStorageTable;

  return new Promise((resolve, reject) => {
    session.subtree(
      base,
      (varbind) => {
        if (snmp.isVarbindError(varbind)) return;
        const oidParts = varbind.oid.split(".");
        const column = oidParts[base.split(".").length];
        const index = oidParts[base.split(".").length + 1];
        if (!column || !index) return;
        if (!rows.has(index)) rows.set(index, {});
        const row = rows.get(index);
        switch (column) {
          case "2":
            row.type = String(varbind.value);
            break;
          case "3":
            row.descr = String(varbind.value);
            break;
          case "4":
            row.allocUnit = toNumber(varbind.value);
            break;
          case "5":
            row.size = toNumber(varbind.value);
            break;
          case "6":
            row.used = toNumber(varbind.value);
            break;
          default:
            break;
        }
      },
      (err) => {
        if (err) return reject(err);
        resolve([...rows.values()]);
      }
    );
  });
}

function summarizeStorage(rows) {
  const totals = {
    disk: { totalBytes: 0, usedBytes: 0 },
    memory: { totalBytes: 0, usedBytes: 0 },
  };

  for (const row of rows) {
    if (!row.allocUnit || !row.size) continue;
    const totalBytes = row.allocUnit * row.size;
    const usedBytes = row.allocUnit * (row.used || 0);

    if (row.type === OIDS.hrStorageTypeFixedDisk) {
      totals.disk.totalBytes += totalBytes;
      totals.disk.usedBytes += usedBytes;
    }
    if (row.type === OIDS.hrStorageTypeRam) {
      totals.memory.totalBytes += totalBytes;
      totals.memory.usedBytes += usedBytes;
    }
  }

  return totals;
}

export async function fetchSnmpStats(server) {
  const session = createSession(server);
  try {
    const basic = await getBasicStats(session);
    const rows = await walkStorage(session);
    const storage = summarizeStorage(rows);

    const uptimeSeconds = basic.sysUpTimeTicks
      ? Math.round(basic.sysUpTimeTicks / 100)
      : null;

    return {
      hostname: basic.sysName || server.name,
      uptimeSeconds,
      memory: {
        totalBytes:
          storage.memory.totalBytes ||
          (basic.hrMemorySizeKb ? basic.hrMemorySizeKb * 1024 : null),
        usedBytes: storage.memory.usedBytes || null,
      },
      disk: {
        totalBytes: storage.disk.totalBytes || null,
        usedBytes: storage.disk.usedBytes || null,
      },
      rawStorageCount: rows.length,
      collectedAt: new Date().toISOString(),
    };
  } finally {
    session.close();
  }
}

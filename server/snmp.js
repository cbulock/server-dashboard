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
  if (typeof value === "bigint") return Number(value);
  if (Buffer.isBuffer(value)) {
    const asString = value.toString("utf-8");
    const parsed = Number(asString);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeOid(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.join(".");
  if (Buffer.isBuffer(value)) return value.toString("utf-8");
  return String(value);
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
  const baseParts = base.split(".");

  function ingestVarbind(varbind) {
    if (!varbind || !varbind.oid) return;
    if (snmp.isVarbindError(varbind)) return;
    const oid = normalizeOid(varbind.oid);
    const oidParts = oid.split(".");
    const column = oidParts[baseParts.length];
    const index = oidParts[baseParts.length + 1];
    if (!column || !index) return;
    if (!rows.has(index)) rows.set(index, {});
    const row = rows.get(index);
    switch (column) {
      case "2":
        row.type = normalizeOid(varbind.value);
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
  }

  return new Promise((resolve, reject) => {
    session.subtree(
      base,
      (varbind) => {
        if (Array.isArray(varbind)) {
          for (const vb of varbind) ingestVarbind(vb);
          return;
        }
        ingestVarbind(varbind);
      },
      (err) => {
        if (err) return reject(err);
        resolve([...rows.values()]);
      }
    );
  });
}

function summarizeStorage(rows, options = {}) {
  const totals = {
    disk: { totalBytes: 0, usedBytes: 0 },
    memory: { totalBytes: 0, usedBytes: 0 },
  };

  const diskCandidates = [];

  for (const row of rows) {
    if (!row.allocUnit || !row.size) continue;
    const totalBytes = row.allocUnit * row.size;
    const usedBytes = row.allocUnit * (row.used || 0);

    const type = row.type || "";
    const descr = (row.descr || "").toLowerCase();

    const isRam =
      type === OIDS.hrStorageTypeRam ||
      descr.includes("memory") ||
      descr.includes("ram");

    if (isRam) {
      totals.memory.totalBytes += totalBytes;
      totals.memory.usedBytes += usedBytes;
      continue;
    }

    const isSwap =
      descr.includes("swap") ||
      descr.includes("virtual memory") ||
      descr.includes("vmemory") ||
      descr.includes("pagefile");

    if (isSwap) {
      continue;
    }

    const isDiskByType = type === OIDS.hrStorageTypeFixedDisk;
    const isDiskByDescr =
      descr.includes("/") ||
      descr.includes("volume") ||
      descr.includes("disk") ||
      descr.includes("raid") ||
      descr.includes("md");

    if (isDiskByType || isDiskByDescr || !type) {
      diskCandidates.push({
        descr: row.descr || "",
        totalBytes,
        usedBytes,
      });
    }
  }

  const profile = options.diskProfile || "auto";
  const customPath = (options.diskPath || "").trim();
  const preferredPaths = {
    qnap: "/share/CACHEDEV1_DATA",
    unraid: "/mnt/user",
    ubuntu: "/",
  };

  function findByPath(targetPath) {
    if (!targetPath) return null;
    return diskCandidates.find((row) => row.descr === targetPath) || null;
  }

  function pickAuto() {
    const qnapRow = findByPath(preferredPaths.qnap);
    if (qnapRow) return qnapRow;
    const unraidRow = findByPath(preferredPaths.unraid);
    if (unraidRow) return unraidRow;
    const ubuntuRow = findByPath(preferredPaths.ubuntu);
    if (ubuntuRow) return ubuntuRow;

    const filtered = diskCandidates.filter((row) => {
      const descr = (row.descr || "").toLowerCase();
      if (!descr.startsWith("/")) return false;
      if (
        descr.startsWith("/proc") ||
        descr.startsWith("/sys") ||
        descr.startsWith("/dev") ||
        descr.startsWith("/run") ||
        descr.startsWith("/tmp")
      ) {
        return false;
      }
      return true;
    });

    if (!filtered.length) return null;
    return filtered.reduce((best, row) =>
      row.totalBytes > best.totalBytes ? row : best
    );
  }

  let picked = null;
  if (profile === "custom" && customPath) {
    picked = findByPath(customPath);
  } else if (profile === "qnap") {
    picked = findByPath(preferredPaths.qnap);
  } else if (profile === "unraid") {
    picked = findByPath(preferredPaths.unraid);
  } else if (profile === "ubuntu") {
    picked = findByPath(preferredPaths.ubuntu);
  } else {
    picked = pickAuto();
  }

  if (picked) {
    totals.disk.totalBytes = picked.totalBytes;
    totals.disk.usedBytes = picked.usedBytes;
    totals.disk.source = picked.descr;
  }

  return totals;
}

export async function fetchSnmpStats(server, options = {}) {
  const session = createSession(server);
  try {
    const basic = await getBasicStats(session);
    const rows = await walkStorage(session);
    const storage = summarizeStorage(rows, {
      diskProfile: server.diskProfile,
      diskPath: server.diskPath,
    });

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
      rawStorageRows: options.includeRaw ? rows : undefined,
      collectedAt: new Date().toISOString(),
    };
  } finally {
    session.close();
  }
}

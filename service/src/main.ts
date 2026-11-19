// Start the fitness ledger service: node src/main.ts [--data DIR] [--host HOST] [--port PORT]

import { loadConfig, parseFlags } from "./config.ts";
import { backupTo, openLedgerDb } from "./db.ts";
import { createLedgerServer } from "./http.ts";
import { Ledger } from "./ledger.ts";
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const config = loadConfig(parseFlags(process.argv.slice(2)));
const db = openLedgerDb(config.dbPath);
const ledger = new Ledger(db, { defaultTimeZone: config.timeZone });
const log = (line: string) => process.stdout.write(`${new Date().toISOString()} ${line}\n`);

// A copy at every start, so an update or a bad edit always has a recent restore point.
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
backupTo(db, join(config.backupDir, `ledger-start-${stamp}.sqlite`));
const KEEP_START_BACKUPS = 10;
const startBackups = readdirSync(config.backupDir).filter((name) => name.startsWith("ledger-start-")).sort();
for (const old of startBackups.slice(0, -KEEP_START_BACKUPS)) rmSync(join(config.backupDir, old));

const server = createLedgerServer(ledger, log);
server.listen(config.port, config.host, () => {
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : config.port;
  log(`lore fitness ledger listening on http://${config.host}:${port} (data ${config.dataDir}, zone ${config.timeZone})`);
});

function shutdown(signal: string): void {
  log(`${signal}: shutting down`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

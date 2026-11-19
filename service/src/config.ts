// Runtime configuration from command-line flags and environment variables.
//   --data DIR / LFR_DATA_DIR        ledger directory (ledger.sqlite, backups/)
//   --host HOST / LFR_HOST           default 127.0.0.1; den-lore uses 0.0.0.0
//   --port PORT / LFR_PORT           default 7900
//   --time-zone TZ / LFR_TIME_ZONE   default zone for records without one; default host zone

import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { hostTimeZone, isValidTimeZone } from "./dates.ts";

export interface Config {
  dataDir: string;
  dbPath: string;
  backupDir: string;
  host: string;
  port: number;
  timeZone: string;
}

export function parseFlags(argv: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const [name, inline] = arg.slice(2).split("=", 2);
    if (inline !== undefined) flags[name] = inline;
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) flags[name] = argv[++i];
    else flags[name] = "true";
  }
  return flags;
}

export function loadConfig(flags: Record<string, string>, env: NodeJS.ProcessEnv = process.env): Config {
  const dataDir = resolve(flags.data ?? env.LFR_DATA_DIR ?? ".data");
  const port = Number(flags.port ?? env.LFR_PORT ?? 7900);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`invalid port ${port}`);
  const timeZone = flags["time-zone"] ?? env.LFR_TIME_ZONE ?? hostTimeZone();
  if (!isValidTimeZone(timeZone)) throw new Error(`invalid time zone ${timeZone}`);
  mkdirSync(dataDir, { recursive: true });
  const backupDir = join(dataDir, "backups");
  mkdirSync(backupDir, { recursive: true });
  return {
    dataDir,
    dbPath: join(dataDir, "ledger.sqlite"),
    backupDir,
    host: flags.host ?? env.LFR_HOST ?? "127.0.0.1",
    port,
    timeZone,
  };
}

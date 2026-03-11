// server/db.js  — pure-JS JSON file database using lowdb
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });

const dbFile = join(dataDir, 'offers.json');
const adapter = new JSONFile(dbFile);

// Default shape of the database
const defaultData = {
  tokens: [],   // { id, token, createdAt, maxUses, useCount }
  claims: []    // { id, token, name, mobile, fingerprint, ip, claimedAt }
};

const db = new Low(adapter, defaultData);

// Load from disk (or write defaults if new)
await db.read();
db.data ||= defaultData;
await db.write();

export default db;

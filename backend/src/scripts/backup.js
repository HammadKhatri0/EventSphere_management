/**
 * Logical database backup: exports every collection to one JSON (EJSON) file per collection.
 *   npm run backup                 -> backups/<timestamp>/
 *   npm run backup -- --keep=14    -> also prunes backups older than the 14 newest
 * Schedule it (cron / Windows Task Scheduler / a managed Atlas backup) for automated daily backups.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { EJSON } from 'bson';
import { connectDB, disconnectDB } from '../config/db.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backups');
// Live login sessions are never written to backups (they hold hashed session tokens)
const SKIP = new Set(['refreshtokens']);
const keepArg = process.argv.find((a) => a.startsWith('--keep='));
const keep = keepArg ? Number(keepArg.split('=')[1]) : 0;

await connectDB();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dir = path.join(root, stamp);
fs.mkdirSync(dir, { recursive: true });

const collections = await mongoose.connection.db.listCollections().toArray();
let total = 0;
for (const { name } of collections) {
  if (name.startsWith('system.') || SKIP.has(name)) continue;
  const docs = await mongoose.connection.db.collection(name).find({}).toArray();
  fs.writeFileSync(path.join(dir, `${name}.json`), EJSON.stringify(docs, null, 2, { relaxed: false }));
  total += docs.length;
  console.log(`  ${name.padEnd(24)} ${docs.length} documents`);
}
console.log(`Backup written to ${dir} (${total} documents)`);

if (keep > 0) {
  const old = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort().reverse().slice(keep);
  old.forEach((d) => fs.rmSync(path.join(root, d), { recursive: true, force: true }));
  if (old.length) console.log(`Pruned ${old.length} old backup(s)`);
}
await disconnectDB();

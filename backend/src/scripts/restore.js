/**
 * Restores a backup created by `npm run backup`.
 *   npm run restore -- <folder-name-or-path> [--drop]
 * Without --drop, existing documents with the same _id are replaced and others left untouched.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { EJSON } from 'bson';
import { connectDB, disconnectDB } from '../config/db.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backups');
const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const drop = process.argv.includes('--drop');

if (!arg) {
  const list = fs.existsSync(root) ? fs.readdirSync(root).sort().reverse() : [];
  console.error(`Usage: npm run restore -- <backup-folder> [--drop]\nAvailable backups:\n${list.map((d) => `  ${d}`).join('\n') || '  (none)'}`);
  process.exit(1);
}
const dir = fs.existsSync(arg) ? arg : path.join(root, arg);
if (!fs.existsSync(dir)) { console.error(`Backup not found: ${dir}`); process.exit(1); }

await connectDB();
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const name = file.replace(/\.json$/, '');
  const docs = EJSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const col = mongoose.connection.db.collection(name);
  if (drop) await col.deleteMany({});
  if (docs.length) await col.bulkWrite(docs.map((d) => ({ replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true } })));
  console.log(`  ${name.padEnd(24)} ${docs.length} documents restored`);
}
console.log('Restore complete');
await disconnectDB();

/**
 * vPay Migration Runner
 * Applies SQL migrations to the Supabase cloud project via the Management API.
 * Tracks applied migrations in a _migrations table so only new files are run.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=<pat> node supabase/seed/migrate.js
 *
 * Get your access token at: https://supabase.com/dashboard/account/tokens
 * Requires SUPABASE_URL and SUPABASE_ACCESS_TOKEN (in .env or env).
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_URL) {
  console.error('✗ Missing SUPABASE_URL in .env');
  process.exit(1);
}
if (!ACCESS_TOKEN) {
  console.error('✗ Missing SUPABASE_ACCESS_TOKEN in .env');
  console.error('  Get yours at: https://supabase.com/dashboard/account/tokens');
  process.exit(1);
}

const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];
const MANAGEMENT_API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

async function runQuery(sql, label) {
  const res = await fetch(MANAGEMENT_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = body?.message || body?.error || JSON.stringify(body);
    throw new Error(`${label}: HTTP ${res.status} — ${msg}`);
  }
  return body;
}

// Base migrations that make up the initial schema deployment.
// If the _migrations table is empty but the schema already exists,
// we assume these were applied outside the tracker and mark them as applied
// so only newer migration files are actually executed.
const BASE_MIGRATIONS = [
  '001_initial_schema.sql',
  '002_rls_policies.sql',
  '003_triggers_functions.sql',
];

async function tableExists(name) {
  try {
    const r = await runQuery(
      `SELECT to_regclass('public.${name}') IS NOT NULL AS exists`,
      `check ${name}`
    );
    return r?.[0]?.exists === true;
  } catch { return false; }
}

async function ensureMigrationsTable() {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS public._migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT now() NOT NULL
    )
  `, 'create _migrations table');
}

async function getAppliedMigrations() {
  let rows;
  try {
    rows = await runQuery(
      `SELECT filename FROM public._migrations ORDER BY filename`,
      'fetch applied migrations'
    );
  } catch { rows = []; }

  const tracked = new Set((rows || []).map(r => r.filename));

  // Bootstrap: if no migrations are tracked but the schema clearly exists,
  // mark the base migrations as applied without re-running them.
  if (tracked.size === 0 && await tableExists('profiles')) {
    console.log('  ↳ Schema exists but tracking is uninitialized — bootstrapping base migrations.\n');
    const vals = BASE_MIGRATIONS.map(f => `('${f}')`).join(',');
    await runQuery(
      `INSERT INTO public._migrations (filename) VALUES ${vals} ON CONFLICT DO NOTHING`,
      'bootstrap base migrations'
    );
    BASE_MIGRATIONS.forEach(f => tracked.add(f));
  }

  return tracked;
}

async function markApplied(filename) {
  await runQuery(
    `INSERT INTO public._migrations (filename) VALUES ('${filename}') ON CONFLICT DO NOTHING`,
    `mark ${filename}`
  );
}

async function main() {
  console.log('vPay Migration Runner');
  console.log('=====================');
  console.log(`Project: ${PROJECT_REF}`);

  // Test connection
  try {
    await runQuery('SELECT 1 AS ok', 'ping');
    console.log('✓ Connected to Supabase Management API\n');
  } catch (err) {
    console.error(`✗ Connection failed: ${err.message}`);
    console.error('  Verify SUPABASE_ACCESS_TOKEN is a valid personal access token.');
    process.exit(1);
  }

  // Ensure migration tracking table exists
  await ensureMigrationsTable();

  const applied = await getAppliedMigrations();

  // Load and apply migrations in order
  const migrationsDir = resolve(__dirname, '../migrations');
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const pending = files.filter(f => !applied.has(f));

  if (pending.length === 0) {
    console.log('✓ All migrations already applied. Nothing to do.\n');
    return;
  }

  console.log(`Applied : ${applied.size} migration(s)`);
  console.log(`Pending : ${pending.length} migration(s)\n`);

  for (const file of pending) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    process.stdout.write(`  Applying ${file}… `);
    try {
      await runQuery(sql, file);
      await markApplied(file);
      console.log('✓');
    } catch (err) {
      console.log('✗');
      console.error(`\n  Error in ${file}:\n  ${err.message}\n`);
      process.exit(1);
    }
  }

  console.log('\n✓ All migrations applied.\n');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

/**
 * vPay Migration Runner
 * Applies SQL migrations to the Supabase cloud project via the Management API.
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

// Extract project ref from URL: https://<ref>.supabase.co
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

async function tableExists(tableName) {
  try {
    const result = await runQuery(
      `SELECT to_regclass('public.${tableName}') IS NOT NULL AS exists`,
      `check ${tableName}`
    );
    return result?.[0]?.exists === true;
  } catch {
    return false;
  }
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

  // Check if already migrated
  const alreadyMigrated = await tableExists('profiles');
  if (alreadyMigrated) {
    console.log('✓ Schema already applied — profiles table exists.\n');
    console.log('  Run the seed script to (re)create demo accounts:');
    console.log('  node supabase/seed/demo-accounts.js\n');
    return;
  }

  // Load and apply migrations in order
  const migrationsDir = resolve(__dirname, '../migrations');
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration(s):\n`);

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    process.stdout.write(`  Applying ${file}… `);
    try {
      await runQuery(sql, file);
      console.log('✓');
    } catch (err) {
      console.log('✗');
      console.error(`\n  Error in ${file}:\n  ${err.message}\n`);
      process.exit(1);
    }
  }

  console.log('\n✓ All migrations applied.\n');
  console.log('  Next: node supabase/seed/demo-accounts.js\n');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

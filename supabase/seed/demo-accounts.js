/**
 * vPay Demo Account Seeder
 * Creates demo consumer, agent, and admin accounts with pre-confirmed email.
 *
 * Usage:
 *   node supabase/seed/demo-accounts.js
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env
 * Run migrations first: node supabase/seed/migrate.js
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const DEMO_ACCOUNTS = [
  {
    email: 'demo@vpay.app',
    password: 'DemoUser@123',
    full_name: 'Demo User',
    role: 'consumer',
    phone: '+1 555 000 0001',
    wallets: [{ type: 'consumer', balance: 250.00 }],
    label: 'Demo Consumer',
  },
  {
    email: 'agent@vpay.app',
    password: 'AgentVPay@123',
    full_name: 'Demo Agent',
    role: 'agent',
    phone: '+1 555 000 0003',
    wallets: [{ type: 'agent_float', balance: 5000.00 }],
    isAgent: true,
    label: 'Demo Agent',
  },
  {
    email: 'admin@vpay.app',
    password: 'AdminVPay@123',
    full_name: 'vPay Admin',
    role: 'super_admin',
    phone: '+1 555 000 0002',
    // Super admin gets both a consumer wallet AND a large agent float
    wallets: [
      { type: 'consumer',    balance: 10000.00 },
      { type: 'agent_float', balance: 50000.00 },
    ],
    isAgent: true,          // gives an agent_profile row (tier 5)
    label: 'Super Admin',
  },
];

async function resolveOrCreateAuthUser(account) {
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw new Error(`listUsers: ${listError.message}`);

  const existing = listData.users.find(u => u.email === account.email);
  if (existing) {
    console.log(`  ✓ Auth user already exists: ${existing.id}`);
    return existing.id;
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: {
      full_name: account.full_name,
      phone: account.phone,
      role: account.role,
    },
  });

  if (authError) throw new Error(`createUser: ${authError.message}`);
  console.log(`  ✓ Auth user created: ${authData.user.id}`);
  await new Promise(r => setTimeout(r, 1500));
  return authData.user.id;
}

async function upsertProfile(userId, account) {
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      email: account.email,
      full_name: account.full_name,
      phone: account.phone,
      role: account.role,
      status: 'active',
      kyc_status: 'approved',
    }, { onConflict: 'id' });

  if (error) throw new Error(`upsertProfile: ${error.message}`);
  console.log(`  ✓ Profile: role=${account.role}, status=active, kyc=approved`);
}

async function upsertWallet(userId, type, balance) {
  const { data: existing } = await supabase
    .from('wallets')
    .select('id')
    .eq('user_id', userId)
    .eq('wallet_type', type)
    .eq('currency', 'USD')
    .maybeSingle();

  if (existing) {
    await supabase.from('wallets').update({ balance, status: 'active' }).eq('id', existing.id);
    console.log(`  ✓ Wallet updated: $${balance.toFixed(2)} USD (${type})`);
  } else {
    const { error } = await supabase.from('wallets').insert({
      user_id: userId, wallet_type: type, currency: 'USD', balance,
    });
    if (error) throw new Error(`insertWallet (${type}): ${error.message}`);
    console.log(`  ✓ Wallet created: $${balance.toFixed(2)} USD (${type})`);
  }
}

async function upsertAgentProfile(userId, isSuperAdmin) {
  const { error } = await supabase
    .from('agent_profiles')
    .upsert({
      user_id: userId,
      is_verified: true,
      agent_tier: isSuperAdmin ? 5 : 1,
      commission_rate: isSuperAdmin ? 0.05 : 0.02,   // 5% for super admin
      float_limit: isSuperAdmin ? 1000000.00 : 10000.00,
      daily_issuance_limit: isSuperAdmin ? 10000 : 100,
      monthly_issuance_limit: isSuperAdmin ? 100000 : 2000,
    }, { onConflict: 'user_id' });

  if (error) throw new Error(`upsertAgentProfile: ${error.message}`);
  const tier = isSuperAdmin ? 'Tier 5 (Master)' : 'Tier 1';
  console.log(`  ✓ Agent profile: ${tier}, verified=true`);
}

async function seedDemoAccount(account) {
  console.log(`\n→ ${account.label} (${account.email})`);
  try {
    const userId = await resolveOrCreateAuthUser(account);
    await upsertProfile(userId, account);

    for (const wallet of account.wallets) {
      await upsertWallet(userId, wallet.type, wallet.balance);
    }

    if (account.isAgent) {
      await upsertAgentProfile(userId, account.role === 'super_admin');
    }

    console.log(`  ✓ Done — ${account.email} / ${account.password}`);
  } catch (err) {
    console.error(`  ✗ ${err.message}`);
  }
}

async function main() {
  console.log('vPay Demo Account Seeder');
  console.log('========================');

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('✗ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  const { error: schemaCheck } = await supabase.from('profiles').select('id').limit(1);
  if (schemaCheck) {
    console.error(`✗ Profiles table not accessible: ${schemaCheck.message}`);
    console.error('  Run migrations first: node supabase/seed/migrate.js');
    process.exit(1);
  }

  console.log(`Target: ${process.env.SUPABASE_URL}\n`);

  for (const account of DEMO_ACCOUNTS) {
    await seedDemoAccount(account);
  }

  console.log('\n✓ All demo accounts ready.\n');
  console.log('  Consumer    demo@vpay.app    / DemoUser@123    — $250 wallet');
  console.log('  Agent       agent@vpay.app   / AgentVPay@123   — $5,000 float');
  console.log('  Super Admin admin@vpay.app   / AdminVPay@123   — $10k wallet + $50k float');
  console.log('\n  Web app:    http://localhost:5173');
  console.log('  Admin app:  http://localhost:5174\n');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

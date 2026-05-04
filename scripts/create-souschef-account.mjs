#!/usr/bin/env node
/**
 * Create @souschef library account
 *
 * Creates the official ChefsBook Library account with:
 * - Email: library@chefsbk.app
 * - Username: souschef
 * - account_type: library
 * - is_verified: true
 * - plan_tier: pro
 *
 * Generates a random password and outputs it once to stdout.
 * Store the password in .env.local as SOUSCHEF_ACCOUNT_PASSWORD
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Generate a strong random password
function generatePassword() {
  return crypto.randomBytes(32).toString('base64').slice(0, 32);
}

async function main() {
  console.log('Creating @souschef library account...\n');

  const email = 'library@chefsbk.app';
  const password = generatePassword();
  const username = 'souschef';
  const displayName = 'ChefsBook Library';
  const bio = 'The official ChefsBook recipe library. Curated collections from the world\'s best cookbooks.';

  // Step 1: Check if user already exists
  const { data: existingProfile } = await supabase
    .from('user_profiles')
    .select('id, username')
    .eq('username', username)
    .single();

  if (existingProfile) {
    console.error(`❌ User with username "${username}" already exists (id: ${existingProfile.id})`);
    process.exit(1);
  }

  // Step 2: Create auth user via Admin API
  console.log('Creating auth user...');
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username,
      display_name: displayName,
    },
  });

  if (authError) {
    console.error('❌ Failed to create auth user:', authError.message);
    process.exit(1);
  }

  console.log(`✓ Auth user created (id: ${authUser.user.id})`);

  // Step 3: Update user_profiles with library account fields
  console.log('Setting up library account profile...');
  const { error: profileError } = await supabase
    .from('user_profiles')
    .update({
      username,
      display_name: displayName,
      bio,
      account_type: 'library',
      is_verified: true,
      plan_tier: 'pro',
    })
    .eq('id', authUser.user.id);

  if (profileError) {
    console.error('❌ Failed to update profile:', profileError.message);
    // Rollback: delete the auth user
    await supabase.auth.admin.deleteUser(authUser.user.id);
    console.error('   (Auth user rolled back)');
    process.exit(1);
  }

  console.log('✓ Profile updated with library account settings');

  // Step 4: Update reserved_usernames to lock this username to the account
  console.log('Locking username reservation...');
  const { error: reserveError } = await supabase
    .from('reserved_usernames')
    .update({ approved_for_user_id: authUser.user.id })
    .eq('username', username);

  if (reserveError) {
    console.error('⚠️  Warning: Failed to update reserved_usernames:', reserveError.message);
    console.error('   (Username may not be properly locked)');
  } else {
    console.log('✓ Username locked to account');
  }

  // Step 5: Output results
  console.log('\n✅ @souschef library account created successfully!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Account Details:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Email:        ${email}`);
  console.log(`  Username:     @${username}`);
  console.log(`  Display Name: ${displayName}`);
  console.log(`  Account Type: library`);
  console.log(`  Verified:     true`);
  console.log(`  Plan:         pro`);
  console.log(`  User ID:      ${authUser.user.id}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n🔐 GENERATED PASSWORD (save this now):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  ${password}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n⚠️  Add this to .env.local on slux:');
  console.log(`  SOUSCHEF_ACCOUNT_PASSWORD="${password}"`);
  console.log('\nThis password will NOT be shown again.\n');
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Fix Supabase storage extended attributes
 * Run inside supabase-storage container to sync metadata from DB to filesystem xattr
 *
 * Supabase storage layout: object name "bucket/path/file.jpg" is stored as:
 * /var/lib/storage/stub/stub/bucket/path/file.jpg/{UUID}
 * The actual file is the UUID inside the directory named after the object.
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');
const execAsync = promisify(exec);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

const STORAGE_ROOT = '/var/lib/storage/stub/stub';
const DB_URL = process.env.DATABASE_URL || 'postgres://supabase_storage_admin:apfnVNFXGCyg7ZSIaM9ugTPuLdIGQkM@db:5432/postgres';

async function main() {
  console.log('=== Supabase Storage xattr Fix (v2 - UUID aware) ===\n');
  console.log('This script sets filesystem extended attributes from database metadata\n');

  // Install pg library if not available
  try {
    require('pg');
  } catch {
    console.log('Installing pg library...');
    await execAsync('npm install pg');
  }

  const { Client } = require('pg');
  const client = new Client({ connectionString: DB_URL });

  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    // Fetch all objects with metadata
    const result = await client.query(`
      SELECT
        bucket_id,
        name,
        metadata->>'mimetype' as content_type,
        metadata->>'cacheControl' as cache_control,
        metadata->>'size' as size,
        metadata->>'eTag' as etag
      FROM storage.objects
      WHERE bucket_id IN ('recipe-user-photos', 'avatars')
      ORDER BY bucket_id, name
    `);

    console.log(`Found ${result.rows.length} objects to process\n`);

    let fixed = 0;
    let errors = 0;

    for (const row of result.rows) {
      const dirpath = path.join(STORAGE_ROOT, row.bucket_id, row.name);

      // Check if directory exists (Supabase stores object as directory)
      if (!fs.existsSync(dirpath)) {
        console.log(`  [SKIP] Directory not found: ${row.name}`);
        errors++;
        continue;
      }

      try {
        const stats = await stat(dirpath);

        if (!stats.isDirectory()) {
          // Old flat storage layout - set xattr directly on file
          if (row.content_type) {
            await execAsync(`setfattr -n user.content-type -v "${row.content_type}" "${dirpath}"`);
          }
          if (row.cache_control) {
            await execAsync(`setfattr -n user.cache-control -v "${row.cache_control}" "${dirpath}"`);
          }
          if (row.etag) {
            await execAsync(`setfattr -n user.etag -v '${row.etag}' "${dirpath}"`);
          }
          fixed++;
        } else {
          // New UUID storage layout - find actual file inside directory
          const files = await readdir(dirpath);

          if (files.length === 0) {
            console.log(`  [SKIP] Empty directory: ${row.name}`);
            errors++;
            continue;
          }

          // Set xattr on each file in the directory (usually just one UUID file)
          for (const file of files) {
            const filepath = path.join(dirpath, file);

            if (row.content_type) {
              await execAsync(`setfattr -n user.content-type -v "${row.content_type}" "${filepath}"`);
            }
            if (row.cache_control) {
              await execAsync(`setfattr -n user.cache-control -v "${row.cache_control}" "${filepath}"`);
            }
            if (row.etag) {
              await execAsync(`setfattr -n user.etag -v '${row.etag}' "${filepath}"`);
            }
          }

          fixed++;
        }

        if (fixed % 50 === 0) {
          console.log(`  Processed ${fixed}/${result.rows.length} objects...`);
        }
      } catch (error) {
        console.error(`  [ERROR] Failed to set xattr on ${row.name}:`, error.message);
        errors++;
      }
    }

    console.log(`\n✓ Complete: Fixed ${fixed} objects, ${errors} errors, ${result.rows.length} total\n`);
    console.log('Note: Restart the storage container for changes to take effect');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

#!/usr/bin/env node
// Database initialization script for AI Model Evaluation Framework

import Database from 'better-sqlite3';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, 'evaluation.db');
const SCHEMA_PATH = join(__dirname, 'schema.sql');
const MIGRATIONS_DIR = join(__dirname, 'migrations');

function initDatabase() {
  console.log('Initializing database...');
  console.log(`Database path: ${DB_PATH}`);

  try {
    // Create or open database
    const db = new Database(DB_PATH);

    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Read and execute schema
    console.log('Applying base schema...');
    const schema = readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schema);

    console.log('Base schema created successfully.');

    // Apply migrations
    if (existsSync(MIGRATIONS_DIR)) {
      console.log('Applying migrations...');
      const migrationFiles = readdirSync(MIGRATIONS_DIR)
        .filter((file) => file.endsWith('.sql'))
        .sort(); // Ensures migrations run in order (001, 002, etc.)

      for (const file of migrationFiles) {
        console.log(`  - Applying migration: ${file}`);
        const migrationPath = join(MIGRATIONS_DIR, file);
        const migration = readFileSync(migrationPath, 'utf-8');
        db.exec(migration);
      }

      console.log(`Applied ${migrationFiles.length} migration(s) successfully.`);
    } else {
      console.log('No migrations directory found, skipping migrations.');
    }

    // Verify tables exist
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all();

    console.log('Tables created:', tables.map((t) => t.name).join(', '));

    // Close connection
    db.close();

    console.log('Database initialization complete.');
  } catch (error) {
    console.error('Failed to initialize database:', error.message);
    process.exit(1);
  }
}

initDatabase();

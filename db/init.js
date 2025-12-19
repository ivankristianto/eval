#!/usr/bin/env node
// Database initialization script for AI Model Evaluation Framework

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, 'evaluation.db');
const SCHEMA_PATH = join(__dirname, 'schema.sql');

function initDatabase() {
  console.log('Initializing database...');
  console.log(`Database path: ${DB_PATH}`);

  try {
    // Create or open database
    const db = new Database(DB_PATH);

    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');

    // Read and execute schema
    const schema = readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schema);

    console.log('Database schema created successfully.');

    // Verify tables exist
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all();

    console.log('Tables created:', tables.map(t => t.name).join(', '));

    // Close connection
    db.close();

    console.log('Database initialization complete.');
  } catch (error) {
    console.error('Failed to initialize database:', error.message);
    process.exit(1);
  }
}

initDatabase();

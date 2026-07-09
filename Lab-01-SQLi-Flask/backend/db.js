/**
 * db.js
 * -----
 * Initializes an in-memory-backed SQLite database file for the
 * "ByteMart" fake e-commerce login/search demo used in Lab 01.
 *
 * This file is intentionally NOT part of the vulnerability itself.
 * The vulnerability lives in server.js (string-concatenated queries).
 * This module just sets up realistic seed data so the injection has
 * something meaningful to extract.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'bytemart.db');
const db = new sqlite3.Database(DB_PATH);

function init() {
  db.serialize(() => {
    db.run(`DROP TABLE IF EXISTS users`);
    db.run(`DROP TABLE IF EXISTS products`);
    db.run(`DROP TABLE IF EXISTS flags`);

    db.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'customer',
        email TEXT
      )
    `);

    db.run(`
      CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        category TEXT
      )
    `);

    // Flag table is deliberately a separate, differently-named table
    // to teach players that SQLi enumeration isn't just "dump users".
    db.run(`
      CREATE TABLE flags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        flag_name TEXT,
        flag_value TEXT
      )
    `);

    const users = [
      ['admin', 'S3cr3tAdm1nP@ss!2024', 'admin', 'admin@bytemart.local'],
      ['sophia_j', 'summer2023', 'customer', 'sophia.j@example.com'],
      ['mike_dev', 'passw0rd123', 'customer', 'mike.dev@example.com'],
      ['guest', 'guestpass', 'customer', 'guest@bytemart.local'],
      ['support_bot', 'Bot!Support99', 'support', 'support@bytemart.local']
    ];
    const userStmt = db.prepare(
      `INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)`
    );
    users.forEach(u => userStmt.run(u));
    userStmt.finalize();

    const products = [
      ['Mechanical Keyboard', 'RGB hot-swappable mechanical keyboard', 79.99, 'Electronics'],
      ['Wireless Mouse', 'Ergonomic wireless mouse with USB-C', 29.99, 'Electronics'],
      ['Standing Desk', 'Electric height-adjustable desk', 349.99, 'Furniture'],
      ['Noise Cancelling Headphones', 'Over-ear ANC headphones', 149.99, 'Electronics'],
      ['Coffee Mug', 'Ceramic 350ml mug with ByteMart logo', 9.99, 'Kitchen'],
      ['USB-C Hub', '7-in-1 USB-C hub with HDMI and SD card slots', 39.99, 'Electronics'],
      ['Desk Lamp', 'LED desk lamp with adjustable brightness', 24.99, 'Furniture'],
      ['Laptop Stand', 'Aluminum foldable laptop stand', 34.99, 'Accessories']
    ];
    const prodStmt = db.prepare(
      `INSERT INTO products (name, description, price, category) VALUES (?, ?, ?, ?)`
    );
    products.forEach(p => prodStmt.run(p));
    prodStmt.finalize();

    db.run(
      `INSERT INTO flags (flag_name, flag_value) VALUES (?, ?)`,
      ['sqli_master_flag', 'CTF{sql1_1nj3ct10n_uni0n_s3l3ct_maSt3r}']
    );

    console.log('[db] ByteMart database initialized with seed data.');
  });
}

module.exports = { db, init, DB_PATH };

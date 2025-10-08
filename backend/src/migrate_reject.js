const db = require('./db');

try {
  db.prepare(`ALTER TABLE users ADD COLUMN reject_reason TEXT`).run();
  console.log('Added column reject_reason');
} catch (e) {
  console.log('Column reject_reason already exists');
}

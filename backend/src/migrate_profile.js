const db = require('./db');

function addColumnIfMissing(table, column, def) {
  try {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`).run();
    console.log(`Added column: ${table}.${column}`);
  } catch (e) {
    // если колонка уже есть — SQLite бросит ошибку, молча игнорируем
  }
}

addColumnIfMissing('users', 'about', 'TEXT');
addColumnIfMissing('users', 'looking_for', 'TEXT');   // CSV, например: "woman,man"
addColumnIfMissing('users', 'interests', 'TEXT');     // CSV, например: "Музыка,Кино"
addColumnIfMissing('users', 'avatar_path', 'TEXT');   // путь к файлу
addColumnIfMissing('users', 'verify_path', 'TEXT');   // путь к файлу верификации

console.log('Migration done.');

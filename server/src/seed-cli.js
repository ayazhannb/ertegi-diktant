// Seed CLI: node server/src/seed-cli.js [--force]
// --force drops the database file contents and re-seeds (dev only).
import db from './db.js';
import { seedIfEmpty } from './seed.js';

const force = process.argv.includes('--force');
if (force) {
  db.exec(`
    DELETE FROM homework_done; DELETE FROM homework; DELETE FROM class_members; DELETE FROM classes;
    DELETE FROM user_badges; DELETE FROM dictionary_words; DELETE FROM attempt_answers; DELETE FROM attempts;
    DELETE FROM segments; DELETE FROM tales; DELETE FROM users;`);
  console.log('Database cleared, re-seeding…');
}
const seeded = seedIfEmpty();
console.log(seeded ? 'Seed complete: users, tales, class, demo progress created.' : 'Database already has data — nothing to seed (use --force to reseed).');

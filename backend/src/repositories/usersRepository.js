import db from "../db.js";

const insertUserStmt = db.prepare(`
  INSERT INTO users (
    email, password_hash, nick, gender, dob, male_dob, female_dob, city, status, created_at, updated_at
  )
  VALUES (
    @email, @password_hash, @nick, @gender, @dob, @male_dob, @female_dob, @city, @status, @created_at, @updated_at
  )
`);

const updateProfileStmt = db.prepare(`
  UPDATE users
  SET about = @about,
      looking_for = @looking_for,
      interests = @interests,
      avatar_path = @avatar_path,
      verify_path = @verify_path,
      status = @status,
      updated_at = @updated_at
  WHERE id = @id
`);

const findByEmailStmt = db.prepare(`SELECT * FROM users WHERE email = ?`);
const findByIdStmt = db.prepare(`SELECT * FROM users WHERE id = ?`);
const findByNickStmt = db.prepare(`SELECT * FROM users WHERE nick = ?`);

const updateStatusStmt = db.prepare(`
  UPDATE users
  SET status = @status, updated_at = @updated_at
  WHERE id = @id
`);

const updatePasswordStmt = db.prepare(`
  UPDATE users
  SET password_hash = @password_hash, updated_at = @updated_at
  WHERE id = @id
`);

export function createUser(user) {
  return insertUserStmt.run(user);
}

export function updateProfile(data) {
  return updateProfileStmt.run(data);
}

export function getUserByEmail(email) {
  return findByEmailStmt.get(email);
}

export function getUserById(id) {
  return findByIdStmt.get(id);
}

export function getUserByNick(nick) {
  return findByNickStmt.get(nick);
}

export function setUserStatus(payload) {
  return updateStatusStmt.run(payload);
}

export function setUserPassword(payload) {
  return updatePasswordStmt.run(payload);
}

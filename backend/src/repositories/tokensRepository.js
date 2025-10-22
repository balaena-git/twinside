import db from "../db.js";

const insertTokenStmt = db.prepare(`
  INSERT INTO email_tokens (user_id, token, purpose, expires_at, used_at, created_at)
  VALUES (@user_id, @token, @purpose, @expires_at, NULL, @created_at)
`);

const findTokenStmt = db.prepare(
  `SELECT * FROM email_tokens WHERE token = ? AND purpose = ?`
);

const setTokenUsedStmt = db.prepare(
  `UPDATE email_tokens SET used_at = @used_at WHERE id = @id`
);

export function createToken(payload) {
  return insertTokenStmt.run(payload);
}

export function getToken(token, purpose) {
  return findTokenStmt.get(token, purpose);
}

export function markTokenUsed(payload) {
  return setTokenUsedStmt.run(payload);
}

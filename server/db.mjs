import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { seedTopics, seedSets, seedWords } from "./seed.mjs";
import { localDay } from "./domain.mjs";

const path = resolve(process.env.DB_PATH || "data/techcamp.sqlite");
mkdirSync(dirname(path), { recursive: true });
export const db = new DatabaseSync(path);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL, profile TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS auth_sessions (token TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tokens (hash TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), type TEXT NOT NULL, expires_at TEXT NOT NULL, used INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS mail (id TEXT PRIMARY KEY, recipient TEXT NOT NULL, subject TEXT NOT NULL, link TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS mail_jobs (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), type TEXT NOT NULL, recipient TEXT NOT NULL, subject TEXT NOT NULL, link TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL, next_attempt_at TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS topics (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sets (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS words (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS word_versions (word_id TEXT NOT NULL, version INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(word_id,version));
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), mode TEXT NOT NULL, set_id TEXT, title TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, completed_at TEXT, config TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_session ON sessions(user_id) WHERE status='active';
CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, session_id TEXT REFERENCES sessions(id), position INTEGER NOT NULL, data TEXT NOT NULL, UNIQUE(session_id,position));
CREATE TABLE IF NOT EXISTS answers (item_id TEXT PRIMARY KEY REFERENCES items(id), user_id TEXT REFERENCES users(id), word_id TEXT NOT NULL, response TEXT NOT NULL, correct INTEGER NOT NULL, accepted_at TEXT NOT NULL, day TEXT NOT NULL, timezone TEXT NOT NULL, feedback TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS progress (user_id TEXT REFERENCES users(id), word_id TEXT NOT NULL, stage INTEGER NOT NULL, due_at TEXT NOT NULL, correct INTEGER NOT NULL, total INTEGER NOT NULL, last_at TEXT NOT NULL, PRIMARY KEY(user_id,word_id));
CREATE TABLE IF NOT EXISTS saved (user_id TEXT REFERENCES users(id), word_id TEXT REFERENCES words(id), difficult INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(user_id,word_id));
CREATE TABLE IF NOT EXISTS daily_settings (user_id TEXT REFERENCES users(id), day TEXT NOT NULL, goal INTEGER NOT NULL, timezone TEXT NOT NULL, PRIMARY KEY(user_id,day));
CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), day TEXT NOT NULL, message TEXT NOT NULL, read INTEGER DEFAULT 0, UNIQUE(user_id,day));
CREATE TABLE IF NOT EXISTS config_versions (id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, actor_id TEXT, action TEXT NOT NULL, object_id TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS import_batches (id TEXT PRIMARY KEY, actor_id TEXT REFERENCES users(id), data TEXT NOT NULL, committed INTEGER DEFAULT 0, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS progress_due ON progress(user_id,due_at);
CREATE INDEX IF NOT EXISTS answers_user_date ON answers(user_id,accepted_at);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id,created_at);`);

export const uid = () => randomUUID();
export const hash = (text) => createHash("sha256").update(text).digest("hex");
export const all = (sql, ...params) => db.prepare(sql).all(...params);
export const one = (sql, ...params) => db.prepare(sql).get(...params);
export const run = (sql, ...params) => db.prepare(sql).run(...params);
export const decode = (row) => (row ? JSON.parse(row.data) : null);
export const records = (table) => all(`SELECT data FROM ${table}`).map(decode);
export function transaction(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function passwordMatches(password, value) {
  try {
    const [salt, digest] = value.split(":");
    return timingSafeEqual(
      scryptSync(password, salt, 64),
      Buffer.from(digest, "hex"),
    );
  } catch {
    return false;
  }
}
export function audit(actor, action, object, detail = {}) {
  run(
    "INSERT INTO audit VALUES(?,?,?,?,?,?)",
    uid(),
    actor,
    action,
    object,
    JSON.stringify(detail),
    new Date().toISOString(),
  );
}
export function addUser({
  email,
  password,
  name,
  role = "learner",
  status = "pending",
}) {
  const id = uid();
  run(
    "INSERT INTO users VALUES(?,?,?,?,?,?,?,?)",
    id,
    email,
    passwordHash(password),
    name,
    role,
    status,
    JSON.stringify({
      goal: 10,
      timezone: "Asia/Ho_Chi_Minh",
      reminder: false,
      reminderTime: "20:00",
    }),
    new Date().toISOString(),
  );
  return one("SELECT * FROM users WHERE id=?", id);
}
export function profileFor(user) {
  let profile = JSON.parse(user.profile);
  if (
    profile.pending &&
    localDay(Date.now(), profile.timezone) >= profile.pending.effectiveOn
  ) {
    profile = { ...profile, ...profile.pending, pending: undefined };
    run(
      "UPDATE users SET profile=? WHERE id=?",
      JSON.stringify(profile),
      user.id,
    );
  }
  const day = localDay(Date.now(), profile.timezone);
  run(
    "INSERT OR IGNORE INTO daily_settings VALUES(?,?,?,?)",
    user.id,
    day,
    profile.goal,
    profile.timezone,
  );
  const today = one(
    "SELECT * FROM daily_settings WHERE user_id=? AND day=?",
    user.id,
    day,
  );
  return { ...profile, goal: today.goal, timezone: today.timezone, day };
}
export function userView(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    profile: profileFor(user),
    createdAt: user.created_at,
  };
}
export function config() {
  const row = one("SELECT * FROM config_versions ORDER BY rowid DESC LIMIT 1");
  return { id: row.id, ...JSON.parse(row.data) };
}

transaction(() => {
  if (!one("SELECT id FROM config_versions LIMIT 1"))
    run(
      "INSERT INTO config_versions VALUES(?,?,?)",
      uid(),
      JSON.stringify({
        intervals: [1, 3, 7, 14, 30],
        retryMinutes: 10,
        sessionSize: 10,
      }),
      new Date().toISOString(),
    );
  if (!one("SELECT id FROM topics LIMIT 1")) {
    for (const topic of seedTopics)
      run(
        "INSERT INTO topics VALUES(?,?)",
        topic.id,
        JSON.stringify({
          ...topic,
          code: topic.id.toUpperCase(),
          status: "published",
        }),
      );
    for (const set of seedSets)
      run("INSERT INTO sets VALUES(?,?)", set.id, JSON.stringify(set));
    for (const word of seedWords) {
      run(
        "INSERT INTO words VALUES(?,?,?)",
        word.id,
        word.code,
        JSON.stringify(word),
      );
      run(
        "INSERT INTO word_versions VALUES(?,?,?)",
        word.id,
        1,
        JSON.stringify(word),
      );
    }
  }
  if (!one("SELECT id FROM users LIMIT 1")) {
    if (process.env.NODE_ENV === "production") {
      if (
        !process.env.ADMIN_EMAIL ||
        !process.env.ADMIN_PASSWORD ||
        process.env.ADMIN_PASSWORD.length < 12
      )
        throw new Error(
          "Cần ADMIN_EMAIL và ADMIN_PASSWORD ít nhất 12 ký tự khi khởi tạo production.",
        );
      addUser({
        email: process.env.ADMIN_EMAIL.trim().toLowerCase(),
        password: process.env.ADMIN_PASSWORD,
        name: "Quản trị viên",
        role: "admin",
        status: "active",
      });
    } else {
      addUser({
        email: "learner@techcamp.local",
        password: "Techcamp@2026",
        name: "Minh Anh",
        status: "active",
      });
      addUser({
        email: "admin@techcamp.local",
        password: "Techcamp@2026",
        name: "Quản trị viên",
        role: "admin",
        status: "active",
      });
    }
  }
});

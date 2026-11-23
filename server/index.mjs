import http from "node:http";
import { randomBytes } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  db,
  all,
  one,
  run,
  records,
  decode,
  uid,
  hash,
  transaction,
  audit,
  addUser,
  passwordHash,
  passwordMatches,
  userView,
  profileFor,
  config,
} from "./db.mjs";
import {
  normalize,
  validateXlsxArchive,
  schedule,
  percent,
  publicWord,
  publicItem,
  localDay,
} from "./domain.mjs";

const PORT = Number(process.env.API_PORT || 3001);
const production = process.env.NODE_ENV === "production";
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const required = (value, name, max = 1000) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    fail(`${name} là bắt buộc và tối đa ${max} ký tự.`);
  return value.trim();
};
const checkPassword = (value) => {
  if (typeof value !== "string" || value.length < 12 || value.length > 128)
    fail("Mật khẩu cần từ 12 đến 128 ký tự.");
  return value;
};
const checkEmail = (value) => {
  const email = required(value, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fail("Email không đúng định dạng.");
  return email;
};
const json = (res, value, status = 200, headers = {}) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(JSON.stringify(value));
};
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 7.5 * 1024 * 1024) fail("Tệp hoặc yêu cầu quá lớn.", 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    fail("Dữ liệu gửi lên không hợp lệ.");
  }
}
const authCookie = (token, expired = false) =>
  `tc_session=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${expired ? 0 : 604800}${production ? "; Secure" : ""}`;
function authenticate(req) {
  const token = /(?:^|;\s*)tc_session=([^;]+)/.exec(
    req.headers.cookie || "",
  )?.[1];
  if (!token) return null;
  return one(
    "SELECT u.* FROM users u JOIN auth_sessions s ON u.id=s.user_id WHERE s.token=? AND s.expires_at>? AND u.status='active'",
    hash(token),
    new Date().toISOString(),
  );
}
function publishedWords() {
  const topics = new Set(
    records("topics")
      .filter((x) => x.status === "published")
      .map((x) => x.id),
  );
  const sets = new Set(
    records("sets")
      .filter((x) => x.status === "published" && topics.has(x.topicId))
      .map((x) => x.id),
  );
  return records("words").filter(
    (x) => x.status === "published" && x.setIds.some((id) => sets.has(id)),
  );
}
function sessionView(id, userId) {
  const session = one(
    "SELECT * FROM sessions WHERE id=? AND user_id=?",
    id,
    userId,
  );
  if (!session) fail("Không tìm thấy phiên học.", 404);
  const items = all(
    "SELECT * FROM items WHERE session_id=? ORDER BY position",
    id,
  ).map((row) => {
    const item = JSON.parse(row.data);
    const answer = one("SELECT * FROM answers WHERE item_id=?", row.id);
    return {
      id: row.id,
      ...publicItem(item),
      ...(answer
        ? {
            answer: {
              response: answer.response,
              correct: Boolean(answer.correct),
              acceptedAt: answer.accepted_at,
              ...JSON.parse(answer.feedback),
            },
          }
        : {}),
    };
  });
  const answered = items.filter((x) => x.answer);
  const correct = answered.filter((x) => x.answer.correct).length;
  return {
    id,
    mode: session.mode,
    setId: session.set_id,
    title: session.title,
    status: session.status,
    createdAt: session.created_at,
    completedAt: session.completed_at,
    items,
    correct,
    answered: answered.length,
    accuracy: percent(correct, answered.length),
  };
}
function getStats(user, profile) {
  const now = new Date().toISOString();
  const answers = all(
    "SELECT a.*, s.mode FROM answers a JOIN items i ON i.id=a.item_id JOIN sessions s ON s.id=i.session_id WHERE a.user_id=? ORDER BY a.accepted_at",
    user.id,
  );
  const today = answers.filter((a) => a.day === profile.day);
  const available = new Set(publishedWords().map((x) => x.id));
  const progress = all("SELECT * FROM progress WHERE user_id=?", user.id);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${profile.day}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 6 + i);
    const day = d.toISOString().slice(0, 10);
    const rows = answers.filter((a) => a.day === day);
    return {
      day,
      count: new Set(rows.map((a) => a.word_id)).size,
      answers: rows.length,
      correct: rows.filter((a) => a.correct).length,
    };
  });
  const activeDays = new Set(answers.map((a) => a.day));
  let streak = 0;
  const cursor = new Date(`${profile.day}T12:00:00Z`);
  if (!activeDays.has(profile.day)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (activeDays.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return {
    learned: new Set(answers.map((a) => a.word_id)).size,
    today: new Set(today.map((a) => a.word_id)).size,
    due: progress.filter((p) => p.due_at <= now && available.has(p.word_id))
      .length,
    correct: answers.filter((a) => a.correct).length,
    answers: answers.length,
    accuracy: percent(answers.filter((a) => a.correct).length, answers.length),
    streak,
    days,
    goal: profile.goal,
  };
}
function createReminder(user, profile, stats) {
  if (!profile.reminder || (stats.today >= stats.goal && !stats.due)) return;
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: profile.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  if (time >= profile.reminderTime)
    run(
      "INSERT OR IGNORE INTO notifications VALUES(?,?,?,?,0)",
      uid(),
      user.id,
      profile.day,
      stats.due
        ? `Bạn có ${stats.due} từ đến lịch ôn. Dành vài phút để luyện tập nhé!`
        : `Hôm nay bạn đã luyện ${stats.today}/${stats.goal} từ. Tiếp tục một chút nhé!`,
    );
}
function validateWord(input, existingId) {
  if (existingId && !one("SELECT id FROM words WHERE id=?", existingId))
    fail("Không tìm thấy từ.", 404);
  if (input.audio && !/^https:\/\//.test(input.audio))
    fail("URL phát âm cần sử dụng HTTPS.");
  const code = required(input.code, "Mã từ", 40).toUpperCase();
  const word = required(input.word, "Từ tiếng Anh", 100);
  const pos = required(input.pos, "Loại từ", 50);
  const meaning = required(input.meaning, "Nghĩa tiếng Việt");
  const sense = required(input.sense || "01", "Mã nghĩa", 40);
  const accepted = Array.isArray(input.accepted)
    ? input.accepted.map((x) => required(x, "Đáp án", 128))
    : [word];
  if (!accepted.length) fail("Cần ít nhất một đáp án chấp nhận.");
  const setIds = [...new Set(input.setIds || [])];
  if (
    !setIds.length ||
    setIds.some((id) => !one("SELECT id FROM sets WHERE id=?", id))
  )
    fail("Chọn ít nhất một bộ từ hợp lệ.");
  for (const item of records("words"))
    if (
      item.id !== existingId &&
      (item.code === code ||
        (normalize(item.word) === normalize(word) &&
          normalize(item.pos) === normalize(pos) &&
          item.sense === sense))
    )
      fail("Mã từ hoặc bộ từ, loại từ và mã nghĩa đã tồn tại.");
  if (!["draft", "published", "archived"].includes(input.status))
    fail("Trạng thái nội dung không hợp lệ.");
  const ipa = required(input.ipa, "Phiên âm", 100);
  const example = required(input.example, "Ví dụ");
  const source = required(input.source, "Nguồn nội dung", 500);
  return {
    id: existingId || uid(),
    code,
    word,
    pos,
    meaning,
    sense,
    accepted,
    setIds,
    status: input.status,
    ipa,
    example,
    source,
    translation: String(input.translation || "").slice(0, 1000),
    question: String(input.question || "").slice(0, 1000),
    explanation: String(
      input.explanation || `“${word}” có nghĩa là “${meaning}”.`,
    ).slice(0, 1000),
    audio: input.audio && /^https:\/\//.test(input.audio) ? input.audio : "",
    version: existingId
      ? decode(one("SELECT data FROM words WHERE id=?", existingId)).version + 1
      : 1,
  };
}
function saveWord(word) {
  run(
    "INSERT INTO words VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET code=excluded.code,data=excluded.data",
    word.id,
    word.code,
    JSON.stringify(word),
  );
  run(
    "INSERT INTO word_versions VALUES(?,?,?)",
    word.id,
    word.version,
    JSON.stringify(word),
  );
}
const limits = new Map();
function rateLimit(key, max = 5) {
  const now = Date.now();
  const attempts = (limits.get(key) || []).filter((x) => now - x < 900000);
  if (attempts.length >= max)
    fail("Bạn đã thử nhiều lần. Vui lòng thử lại sau 15 phút.", 429);
  limits.set(key, [...attempts, now]);
  if (limits.size > 10000)
    for (const [k, values] of limits)
      if (now - values.at(-1) > 900000) limits.delete(k);
}
async function queueMail(user, type) {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  const link = `${process.env.APP_URL || "http://localhost:5173"}/#${type === "activate" ? "activate" : "reset"}?token=${token}`;
  transaction(() => {
    run("UPDATE tokens SET used=1 WHERE user_id=? AND type=?", user.id, type);
    run(
      "INSERT INTO tokens VALUES(?,?,?,?,0)",
      hash(token),
      user.id,
      type,
      new Date(now + (type === "activate" ? 86400000 : 900000)).toISOString(),
    );
    if (!production)
      run(
        "INSERT INTO mail VALUES(?,?,?,?,?)",
        uid(),
        user.email,
        type === "activate"
          ? "Kích hoạt tài khoản Techcamp"
          : "Đặt lại mật khẩu Techcamp",
        link,
        new Date(now).toISOString(),
      );
    else {
      run(
        "UPDATE mail_jobs SET status='cancelled',link='' WHERE user_id=? AND type=? AND status='pending'",
        user.id,
        type,
      );
      run(
        "INSERT INTO mail_jobs VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        uid(),
        user.id,
        type,
        user.email,
        type === "activate"
          ? "Kích hoạt tài khoản Techcamp"
          : "Đặt lại mật khẩu Techcamp",
        link,
        "pending",
        0,
        new Date(now).toISOString(),
        new Date(now + (type === "activate" ? 86400000 : 900000)).toISOString(),
        new Date(now).toISOString(),
      );
    }
  });
  if (production) void flushMailQueue();
}
let sendingMail = false;
async function flushMailQueue() {
  if (
    !production ||
    sendingMail ||
    !process.env.SMTP_URL ||
    !process.env.MAIL_FROM
  )
    return;
  sendingMail = true;
  try {
    const { default: nodemailer } = await import("nodemailer");
    const transport = nodemailer.createTransport(process.env.SMTP_URL, {
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    for (const job of all(
      "SELECT * FROM mail_jobs WHERE status='pending' AND next_attempt_at<=? ORDER BY created_at LIMIT 10",
      new Date().toISOString(),
    )) {
      if (job.expires_at <= new Date().toISOString()) {
        run("UPDATE mail_jobs SET status='expired',link='' WHERE id=?", job.id);
        continue;
      }
      try {
        await transport.sendMail({
          from: process.env.MAIL_FROM,
          to: job.recipient,
          subject: job.subject,
          messageId: `<${job.id}@techcamp.local>`,
          text: `Mở liên kết để tiếp tục: ${job.link}\nLiên kết chỉ sử dụng một lần.`,
        });
        run(
          "UPDATE mail_jobs SET status='sent',link='',attempts=attempts+1 WHERE id=?",
          job.id,
        );
      } catch {
        const attempts = job.attempts + 1;
        run(
          "UPDATE mail_jobs SET status=?,attempts=?,next_attempt_at=?,link=? WHERE id=?",
          attempts >= 3 ? "failed" : "pending",
          attempts,
          new Date(Date.now() + attempts * attempts * 60000).toISOString(),
          attempts >= 3 ? "" : job.link,
          job.id,
        );
        audit(null, "mail.delivery_failed", job.id, { attempt: attempts });
      }
    }
  } catch {
    console.error(
      "Techcamp: không khởi tạo được dịch vụ email. Kiểm tra cấu hình SMTP.",
    );
  } finally {
    sendingMail = false;
  }
}
async function workbookResponse(res, rows, name, meta = []) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Techcamp";
  const sheet = workbook.addWorksheet("Techcamp");
  if (rows.length) {
    const headers = Object.keys(rows[0]);
    sheet.addRow(headers);
    rows.forEach((row) => sheet.addRow(headers.map((key) => row[key] ?? "")));
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF167D59" },
    };
    sheet.columns.forEach((c) => {
      c.width = 26;
    });
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  } else sheet.addRow(["Chưa có dữ liệu phù hợp với bộ lọc."]);
  const info = workbook.addWorksheet("Thông tin");
  [...meta, ["Thời điểm xuất UTC", new Date().toISOString()]].forEach((row) =>
    info.addRow(row),
  );
  info.getColumn(1).width = 30;
  info.getColumn(2).width = 70;
  const buffer = await workbook.xlsx.writeBuffer();
  res.writeHead(200, {
    "Content-Type":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${name}.xlsx"`,
    "Cache-Control": "no-store",
  });
  res.end(Buffer.from(buffer));
}
function report(from = "", to = "9999", topic = "") {
  const rows = all(
    "SELECT a.*,i.data,s.set_id FROM answers a JOIN items i ON i.id=a.item_id JOIN sessions s ON s.id=i.session_id WHERE a.day>=? AND a.day<=?",
    from,
    to,
  ).filter(
    (a) =>
      !topic ||
      JSON.parse(a.data).word.setIds.some(
        (id) =>
          decode(one("SELECT data FROM sets WHERE id=?", id))?.topicId ===
          topic,
      ),
  );
  const wordMap = new Map();
  for (const row of rows) {
    const word = JSON.parse(row.data).word;
    const key = `${word.id}:${word.version}`;
    const value = wordMap.get(key) || {
      word: word.word,
      meaning: word.meaning,
      version: word.version,
      total: 0,
      wrong: 0,
    };
    value.total++;
    value.wrong += row.correct ? 0 : 1;
    wordMap.set(key, value);
  }
  const words = [...wordMap.values()]
    .map((w) => ({ ...w, errorRate: percent(w.wrong, w.total) }))
    .sort(
      (a, b) => (b.total >= 10) - (a.total >= 10) || b.errorRate - a.errorRate,
    );
  return {
    learners: one("SELECT COUNT(*) n FROM users WHERE role='learner'").n,
    activeLearners: new Set(rows.map((x) => x.user_id)).size,
    answers: rows.length,
    accuracy: percent(rows.filter((x) => x.correct).length, rows.length),
    practiced: new Set(rows.map((x) => `${x.user_id}:${x.word_id}`)).size,
    completed: one(
      "SELECT COUNT(*) n FROM sessions WHERE status='completed' AND substr(completed_at,1,10)>=? AND substr(completed_at,1,10)<=? AND (?='' OR set_id IN (SELECT id FROM sets WHERE json_extract(data,'$.topicId')=?))",
      from,
      to,
      topic,
      topic,
    ).n,
    words,
    byTopic: records("topics").map((t) => {
      const entries = rows.filter((a) =>
        JSON.parse(a.data).word.setIds.some(
          (id) =>
            decode(one("SELECT data FROM sets WHERE id=?", id))?.topicId ===
            t.id,
        ),
      );
      return {
        name: t.name,
        count: entries.length,
        correct: entries.filter((x) => x.correct).length,
      };
    }),
    from,
    to,
    topic,
  };
}

async function api(req, res, url) {
  const path = url.pathname;
  const method = req.method;
  const body = ["POST", "PATCH", "PUT"].includes(method)
    ? await readBody(req)
    : {};
  if (path === "/api/health")
    return json(res, { status: "ok", time: new Date().toISOString() });
  if (path === "/api/auth/me") {
    const user = authenticate(req);
    return json(res, {
      user: user ? userView(user) : null,
      localMode: !production,
    });
  }
  if (path === "/api/auth/login" && method === "POST") {
    const email = checkEmail(body.email);
    rateLimit(`email:${email}`);
    rateLimit(`ip:${req.socket.remoteAddress}`, 40);
    const user = one("SELECT * FROM users WHERE email=?", email);
    if (
      !user ||
      !passwordMatches(String(body.password || ""), user.password) ||
      user.status !== "active"
    )
      fail(
        "Thông tin đăng nhập không hợp lệ hoặc tài khoản chưa thể truy cập.",
        401,
      );
    limits.delete(`email:${email}`);
    const token = randomBytes(32).toString("hex");
    run(
      "INSERT INTO auth_sessions VALUES(?,?,?)",
      hash(token),
      user.id,
      new Date(Date.now() + 604800000).toISOString(),
    );
    audit(user.id, "auth.login", user.id);
    return json(res, { user: userView(user) }, 200, {
      "Set-Cookie": authCookie(token),
    });
  }
  if (
    ["/api/auth/register", "/api/auth/forgot", "/api/auth/resend"].includes(
      path,
    ) &&
    method === "POST"
  ) {
    rateLimit(`mail:${req.socket.remoteAddress}`, 20);
    const email = checkEmail(body.email);
    let user = one("SELECT * FROM users WHERE email=?", email);
    if (path.endsWith("register")) {
      const password = checkPassword(body.password);
      const name = required(body.name, "Tên hiển thị", 80);
      if (!user) user = addUser({ email, password, name });
      if (user.status === "pending") await queueMail(user, "activate");
    } else if (path.endsWith("resend") && user?.status === "pending")
      await queueMail(user, "activate");
    else if (path.endsWith("forgot") && user?.status === "active")
      await queueMail(user, "reset");
    return json(res, {
      message:
        "Nếu thông tin đủ điều kiện, hướng dẫn sẽ được gửi tới email của bạn.",
    });
  }
  if (
    ["/api/auth/activate", "/api/auth/reset"].includes(path) &&
    method === "POST"
  ) {
    const type = path.endsWith("activate") ? "activate" : "reset";
    if (type === "reset") checkPassword(body.password);
    transaction(() => {
      const token = one(
        "SELECT * FROM tokens WHERE hash=? AND type=? AND used=0 AND expires_at>?",
        hash(String(body.token || "")),
        type,
        new Date().toISOString(),
      );
      if (!token)
        fail("Liên kết không còn hiệu lực. Vui lòng yêu cầu liên kết mới.");
      const user = one("SELECT status FROM users WHERE id=?", token.user_id);
      if (
        (type === "activate" && user.status !== "pending") ||
        (type === "reset" && user.status !== "active")
      )
        fail("Liên kết không còn hiệu lực.");
      run("UPDATE tokens SET used=1 WHERE user_id=?", token.user_id);
      if (type === "activate")
        run("UPDATE users SET status='active' WHERE id=?", token.user_id);
      else {
        run(
          "UPDATE users SET password=? WHERE id=?",
          passwordHash(body.password),
          token.user_id,
        );
        run("DELETE FROM auth_sessions WHERE user_id=?", token.user_id);
      }
      audit(token.user_id, `auth.${type}`, token.user_id);
    });
    return json(res, {
      message:
        type === "activate"
          ? "Kích hoạt thành công. Bạn có thể đăng nhập."
          : "Đã đổi mật khẩu. Vui lòng đăng nhập lại.",
    });
  }
  if (path === "/api/dev/mail" && !production && method === "GET")
    return json(res, {
      messages: all("SELECT * FROM mail ORDER BY created_at DESC LIMIT 30"),
    });
  const user = authenticate(req);
  if (!user) fail("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
  if (path === "/api/auth/logout" && method === "POST") {
    const token = /tc_session=([^;]+)/.exec(req.headers.cookie || "")?.[1];
    run("DELETE FROM auth_sessions WHERE token=?", hash(token || ""));
    return json(res, { ok: true }, 200, { "Set-Cookie": authCookie("", true) });
  }
  const profile = profileFor(user);
  if (path === "/api/app" && method === "GET") {
    const stats = getStats(user, profile);
    createReminder(user, profile, stats);
    const words = publishedWords().map(publicWord);
    const topics = records("topics").filter((t) => t.status === "published");
    const sets = records("sets")
      .filter(
        (s) =>
          s.status === "published" && topics.some((t) => t.id === s.topicId),
      )
      .map((s) => ({
        ...s,
        count: words.filter((w) => w.setIds.includes(s.id)).length,
      }));
    const saved = all("SELECT * FROM saved WHERE user_id=?", user.id);
    const savedWords = saved.map((s) => ({
      ...publicWord(
        decode(one("SELECT data FROM words WHERE id=?", s.word_id)),
      ),
      difficult: Boolean(s.difficult),
    }));
    const history = all(
      "SELECT id FROM sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 250",
      user.id,
    ).map((s) => {
      const view = sessionView(s.id, user.id);
      const { items, ...summary } = view;
      return { ...summary, total: items.length };
    });
    return json(res, {
      user: userView(user),
      topics,
      sets,
      words,
      saved: saved.map((s) => s.word_id),
      savedWords,
      stats,
      practicedWordIds: all(
        "SELECT DISTINCT word_id FROM answers WHERE user_id=?",
        user.id,
      ).map((a) => a.word_id),
      progress: all("SELECT * FROM progress WHERE user_id=?", user.id),
      history,
      active: history.find((s) => s.status === "active") || null,
      notifications: all(
        "SELECT * FROM notifications WHERE user_id=? ORDER BY day DESC LIMIT 30",
        user.id,
      ),
      serverTime: new Date().toISOString(),
      config: { sessionSize: config().sessionSize },
    });
  }
  if (path === "/api/profile" && method === "PATCH") {
    const name = required(body.name, "Tên hiển thị", 80);
    const goal = Number(body.goal);
    if (!Number.isInteger(goal) || goal < 1 || goal > 100)
      fail("Mục tiêu cần là số nguyên từ 1 đến 100.");
    try {
      new Intl.DateTimeFormat("vi", { timeZone: body.timezone }).format();
    } catch {
      fail("Múi giờ không hợp lệ.");
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.reminderTime))
      fail("Giờ nhắc học không hợp lệ.");
    const next = new Date(`${profile.day}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const updated = {
      ...JSON.parse(user.profile),
      reminder: Boolean(body.reminder),
      reminderTime: body.reminderTime,
    };
    if (goal !== profile.goal || body.timezone !== profile.timezone)
      updated.pending = {
        goal,
        timezone: body.timezone,
        effectiveOn: next.toISOString().slice(0, 10),
      };
    else delete updated.pending;
    run(
      "UPDATE users SET name=?,profile=? WHERE id=?",
      name,
      JSON.stringify(updated),
      user.id,
    );
    return json(res, {
      message:
        "Đã lưu hồ sơ. Mục tiêu và múi giờ thay đổi có hiệu lực từ ngày kế tiếp.",
    });
  }
  if (path === "/api/profile/password" && method === "POST") {
    if (!passwordMatches(String(body.current || ""), user.password))
      fail("Mật khẩu hiện tại không đúng.");
    checkPassword(body.password);
    transaction(() => {
      run(
        "UPDATE users SET password=? WHERE id=?",
        passwordHash(body.password),
        user.id,
      );
      run("DELETE FROM auth_sessions WHERE user_id=?", user.id);
    });
    return json(
      res,
      { message: "Đã đổi mật khẩu. Vui lòng đăng nhập lại." },
      200,
      { "Set-Cookie": authCookie("", true) },
    );
  }
  if (path === "/api/saved" && method === "POST") {
    if (!one("SELECT id FROM words WHERE id=?", body.wordId))
      fail("Không tìm thấy từ.", 404);
    if (body.saved === false)
      run(
        "DELETE FROM saved WHERE user_id=? AND word_id=?",
        user.id,
        body.wordId,
      );
    else
      run(
        "INSERT INTO saved VALUES(?,?,?) ON CONFLICT(user_id,word_id) DO UPDATE SET difficult=excluded.difficult",
        user.id,
        body.wordId,
        body.difficult ? 1 : 0,
      );
    return json(res, { ok: true });
  }
  if (path === "/api/notifications/read" && method === "POST") {
    run("UPDATE notifications SET read=1 WHERE user_id=?", user.id);
    return json(res, { ok: true });
  }
  if (path === "/api/sessions" && method === "POST") {
    const result = transaction(() => {
      const active = one(
        "SELECT id FROM sessions WHERE user_id=? AND status='active'",
        user.id,
      );
      if (active && !body.replace) return sessionView(active.id, user.id);
      if (!["new", "review", "practice"].includes(body.mode))
        fail("Chế độ học không hợp lệ.");
      const size = Number(body.size || config().sessionSize);
      if (!Number.isInteger(size) || size < 1 || size > 20)
        fail("Chọn từ 1 đến 20 từ mỗi phiên.");
      if (!["choice", "typing", "mixed"].includes(body.type || "mixed"))
        fail("Dạng bài không hợp lệ.");
      let words = publishedWords();
      const now = new Date().toISOString();
      if (body.setId)
        words = words.filter((w) => w.setIds.includes(body.setId));
      const progress = new Map(
        all("SELECT * FROM progress WHERE user_id=?", user.id).map((p) => [
          p.word_id,
          p,
        ]),
      );
      if (body.mode === "new") {
        const answered = new Set(
          all(
            "SELECT DISTINCT word_id FROM answers WHERE user_id=?",
            user.id,
          ).map((a) => a.word_id),
        );
        words = words.filter((w) => !answered.has(w.id));
      }
      if (body.mode === "review")
        words = words
          .filter((w) => progress.get(w.id)?.due_at <= now)
          .sort(
            (a, b) =>
              progress
                .get(a.id)
                .due_at.localeCompare(progress.get(b.id).due_at) ||
              a.id.localeCompare(b.id),
          );
      else words = words.sort(() => Math.random() - 0.5);
      words = words.slice(0, size);
      if (!words.length)
        fail(
          body.mode === "review"
            ? "Bạn chưa có từ đến lịch ôn. Hãy học từ mới hoặc luyện thêm."
            : body.mode === "new"
              ? "Bạn đã luyện hết từ mới trong bộ này. Hãy chọn luyện thêm hoặc một bộ khác."
              : "Chưa có nội dung khả dụng để học.",
        );
      if (active)
        run(
          "UPDATE sessions SET status='abandoned',completed_at=? WHERE id=?",
          now,
          active.id,
        );
      const id = uid();
      const set = decode(
        one("SELECT data FROM sets WHERE id=?", body.setId || ""),
      );
      run(
        "INSERT INTO sessions VALUES(?,?,?,?,?,?,?,?,?)",
        id,
        user.id,
        body.mode,
        body.setId || null,
        set?.name ||
          (body.mode === "review" ? "Ôn tập đến hạn" : "Luyện tập tổng hợp"),
        "active",
        now,
        null,
        JSON.stringify(config()),
      );
      words.forEach((word, index) => {
        const type =
          body.type === "mixed" || !body.type
            ? index % 2
              ? "typing"
              : "choice"
            : body.type;
        const options =
          type === "choice"
            ? [
                ...new Set([
                  word.meaning,
                  ...publishedWords()
                    .filter((w) => w.id !== word.id)
                    .sort(() => Math.random() - 0.5)
                    .map((w) => w.meaning),
                ]),
              ]
                .slice(0, 4)
                .sort(() => Math.random() - 0.5)
                .map((text) => ({ id: uid(), text }))
            : [];
        if (type === "choice" && options.length < 2)
          fail("Chưa đủ lựa chọn hợp lệ cho câu trắc nghiệm.");
        const item = {
          word,
          type,
          options,
          correctOption: options.find((x) => x.text === word.meaning)?.id,
        };
        run(
          "INSERT INTO items VALUES(?,?,?,?)",
          uid(),
          id,
          index,
          JSON.stringify(item),
        );
      });
      return { ...sessionView(id, user.id), requestedSize: size };
    });
    return json(res, result);
  }
  const sessionMatch = /^\/api\/sessions\/([^/]+)$/.exec(path);
  if (sessionMatch && method === "GET")
    return json(res, sessionView(sessionMatch[1], user.id));
  const answerMatch = /^\/api\/sessions\/([^/]+)\/items\/([^/]+)\/answer$/.exec(
    path,
  );
  if (answerMatch && method === "POST") {
    const result = transaction(() => {
      const [, sessionId, itemId] = answerMatch;
      const session = one(
        "SELECT * FROM sessions WHERE id=? AND user_id=?",
        sessionId,
        user.id,
      );
      const row = one(
        "SELECT * FROM items WHERE id=? AND session_id=?",
        itemId,
        sessionId,
      );
      if (!session || !row) fail("Không tìm thấy câu hỏi.", 404);
      const item = JSON.parse(row.data);
      const response = required(body.response, "Câu trả lời", 128);
      const previousAnswer = one(
        "SELECT * FROM answers WHERE item_id=?",
        itemId,
      );
      if (previousAnswer) {
        if (previousAnswer.response !== response)
          fail("Câu này đã có kết quả. Vui lòng tải lại phiên học.", 409);
        return sessionView(sessionId, user.id);
      }
      if (session.status !== "active") fail("Phiên học đã kết thúc.", 409);
      if (
        item.type === "choice" &&
        !item.options.some((o) => o.id === response)
      )
        fail("Lựa chọn không thuộc câu hỏi này.");
      const correct =
        item.type === "choice"
          ? item.correctOption === response
          : item.word.accepted.some(
              (a) => normalize(a) === normalize(response),
            );
      const now = new Date().toISOString();
      const progress = one(
        "SELECT * FROM progress WHERE user_id=? AND word_id=?",
        user.id,
        item.word.id,
      );
      const updatesSchedule =
        (session.mode === "new" && !progress) ||
        (session.mode === "review" && progress && progress.due_at <= now);
      let nextDue = progress?.due_at;
      if (updatesSchedule) {
        const next = schedule(
          progress,
          correct,
          Date.now(),
          JSON.parse(session.config),
        );
        nextDue = next.dueAt;
        run(
          "INSERT INTO progress VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,word_id) DO UPDATE SET stage=excluded.stage,due_at=excluded.due_at,correct=progress.correct+excluded.correct,total=progress.total+1,last_at=excluded.last_at",
          user.id,
          item.word.id,
          next.stage,
          next.dueAt,
          correct ? 1 : 0,
          1,
          now,
        );
      } else if (progress)
        run(
          "UPDATE progress SET correct=correct+?,total=total+1,last_at=? WHERE user_id=? AND word_id=?",
          correct ? 1 : 0,
          now,
          user.id,
          item.word.id,
        );
      else if (session.mode === "practice") {
        /* Luyện thêm không tạo hoặc thay lịch ôn. */
      }
      const feedback = {
        word: publicWord(item.word),
        correctAnswer:
          item.type === "choice" ? item.word.meaning : item.word.accepted[0],
        explanation: item.word.explanation,
        nextDueAt: nextDue || null,
        updatesSchedule,
      };
      run(
        "INSERT INTO answers VALUES(?,?,?,?,?,?,?,?,?)",
        itemId,
        user.id,
        item.word.id,
        response,
        correct ? 1 : 0,
        now,
        profile.day,
        profile.timezone,
        JSON.stringify(feedback),
      );
      const remaining = one(
        "SELECT COUNT(*) n FROM items i LEFT JOIN answers a ON i.id=a.item_id WHERE i.session_id=? AND a.item_id IS NULL",
        sessionId,
      ).n;
      if (!remaining)
        run(
          "UPDATE sessions SET status='completed',completed_at=? WHERE id=?",
          now,
          sessionId,
        );
      return sessionView(sessionId, user.id);
    });
    return json(res, result);
  }
  if (path === "/api/history/export" && method === "GET") {
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "9999";
    if (from > to) fail("Ngày bắt đầu phải trước ngày kết thúc.");
    const rows = all(
      "SELECT a.*,s.mode,s.status,s.created_at session_created_at,i.data FROM answers a JOIN items i ON i.id=a.item_id JOIN sessions s ON s.id=i.session_id WHERE a.user_id=? ORDER BY a.accepted_at DESC LIMIT 10000",
      user.id,
    )
      .filter((a) => {
        const day = localDay(a.session_created_at, profile.timezone);
        return (
          day >= from &&
          day <= to &&
          (!url.searchParams.get("mode") ||
            a.mode === url.searchParams.get("mode")) &&
          (!url.searchParams.get("status") ||
            a.status === url.searchParams.get("status"))
        );
      })
      .map((a) => ({
        "Thời gian UTC": a.accepted_at,
        "Ngày học": a.day,
        "Múi giờ": a.timezone,
        "Chế độ": a.mode,
        "Trạng thái phiên": a.status,
        Từ: JSON.parse(a.data).word.word,
        "Phiên bản": JSON.parse(a.data).word.version,
        "Kết quả": a.correct ? "Đúng" : "Sai",
      }));
    return workbookResponse(res, rows, "techcamp-lich-su", [
      ["Từ ngày", from],
      ["Đến ngày", to],
      ["Công thức", "Tỷ lệ đúng = số đúng / số đã trả lời × 100%"],
    ]);
  }
  if (!path.startsWith("/api/admin/")) fail("Không tìm thấy chức năng.", 404);
  if (user.role !== "admin")
    fail("Bạn chưa có quyền thực hiện thao tác này.", 403);
  if (path === "/api/admin/data" && method === "GET")
    return json(res, {
      users: all(
        "SELECT id,email,name,role,status,created_at FROM users ORDER BY created_at DESC",
      ),
      topics: records("topics"),
      sets: records("sets"),
      words: records("words"),
      audit: all(
        "SELECT a.*,u.name actor FROM audit a LEFT JOIN users u ON a.actor_id=u.id ORDER BY a.created_at DESC LIMIT 200",
      ),
      config: config(),
      report: report(),
    });
  if (path === "/api/admin/users" && method === "PATCH") {
    if (
      !["admin", "learner"].includes(body.role) ||
      !["active", "locked", "pending"].includes(body.status)
    )
      fail("Vai trò hoặc trạng thái không hợp lệ.");
    transaction(() => {
      const target = one("SELECT * FROM users WHERE id=?", body.id);
      if (!target) fail("Không tìm thấy tài khoản.", 404);
      if (
        target.role === "admin" &&
        target.status === "active" &&
        (body.role !== "admin" || body.status !== "active") &&
        one(
          "SELECT COUNT(*) n FROM users WHERE role='admin' AND status='active'",
        ).n <= 1
      )
        fail("Cần có ít nhất một tài khoản quản trị đang hoạt động.");
      if (target.status === "pending" && body.status === "active")
        fail("Tài khoản cần xác minh email trước khi kích hoạt.");
      run(
        "UPDATE users SET role=?,status=? WHERE id=?",
        body.role,
        body.status,
        body.id,
      );
      run("DELETE FROM auth_sessions WHERE user_id=?", body.id);
      audit(user.id, "user.update", body.id, {
        before: { role: target.role, status: target.status },
        after: { role: body.role, status: body.status },
      });
    });
    return json(res, { ok: true });
  }
  if (
    ["/api/admin/topics", "/api/admin/sets"].includes(path) &&
    method === "POST"
  ) {
    const table = path.endsWith("topics") ? "topics" : "sets";
    const existing = body.id
      ? decode(one(`SELECT data FROM ${table} WHERE id=?`, body.id))
      : null;
    if (body.id && !existing) fail("Không tìm thấy nội dung.", 404);
    const data = {
      ...existing,
      id: body.id || uid(),
      code: required(body.code, "Mã", 40).toUpperCase(),
      name: required(body.name, "Tên", 100),
      description: required(body.description, "Mô tả"),
      status: body.status,
      icon: body.icon || existing?.icon || "book",
      color: body.color || existing?.color || "green",
    };
    if (!["draft", "published", "archived"].includes(data.status))
      fail("Trạng thái không hợp lệ.");
    if (records(table).some((x) => x.id !== data.id && x.code === data.code))
      fail("Mã nội dung đã tồn tại.");
    if (table === "sets") {
      if (!one("SELECT id FROM topics WHERE id=?", body.topicId))
        fail("Chủ đề không hợp lệ.");
      data.topicId = body.topicId;
      if (!["A1", "A2", "B1", "B2", "C1", "C2"].includes(body.level))
        fail("Trình độ không hợp lệ.");
      data.level = body.level;
      data.duration = body.duration || "10 phút";
      if (
        data.status === "published" &&
        !records("words").some(
          (w) => w.setIds.includes(data.id) && w.status === "published",
        )
      )
        fail("Bộ từ cần ít nhất một từ xuất bản trước khi xuất bản bộ.");
    }
    transaction(() => {
      run(
        `INSERT INTO ${table} VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`,
        data.id,
        JSON.stringify(data),
      );
      audit(user.id, `${table}.save`, data.id, {
        before: existing,
        after: data,
      });
    });
    return json(res, { ok: true, data });
  }
  if (path === "/api/admin/words" && method === "POST") {
    const word = validateWord(body, body.id);
    transaction(() => {
      saveWord(word);
      audit(user.id, "word.save", word.id, {
        version: word.version,
        status: word.status,
      });
    });
    return json(res, { ok: true, word });
  }
  if (path === "/api/admin/config" && method === "POST") {
    if (
      !Array.isArray(body.intervals) ||
      body.intervals.length !== 5 ||
      body.intervals.some(
        (v, i) =>
          !Number.isInteger(v) ||
          v < 1 ||
          v > 365 ||
          (i && v <= body.intervals[i - 1]),
      ) ||
      !Number.isInteger(body.retryMinutes) ||
      body.retryMinutes < 1 ||
      body.retryMinutes > 1440 ||
      !Number.isInteger(body.sessionSize) ||
      body.sessionSize < 1 ||
      body.sessionSize > 20
    )
      fail(
        "Cấu hình không hợp lệ: 5 khoảng ôn tăng dần từ 1–365 ngày, ôn sai 1–1440 phút, phiên 1–20 từ.",
      );
    transaction(() => {
      const id = uid();
      const data = {
        intervals: body.intervals,
        retryMinutes: body.retryMinutes,
        sessionSize: body.sessionSize,
      };
      run(
        "INSERT INTO config_versions VALUES(?,?,?)",
        id,
        JSON.stringify(data),
        new Date().toISOString(),
      );
      audit(user.id, "config.save", id, data);
    });
    return json(res, { ok: true });
  }
  if (path === "/api/admin/report" && method === "GET") {
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "9999";
    if (from > to) fail("Ngày bắt đầu phải trước ngày kết thúc.");
    return json(res, report(from, to, url.searchParams.get("topic") || ""));
  }
  if (path === "/api/admin/report/export" && method === "GET") {
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "9999";
    if (from > to) fail("Ngày bắt đầu phải trước ngày kết thúc.");
    const result = report(from, to, url.searchParams.get("topic") || "");
    return workbookResponse(
      res,
      result.words.map((w) => ({
        Từ: w.word,
        Nghĩa: w.meaning,
        "Phiên bản": w.version,
        "Số câu": w.total,
        "Số sai": w.wrong,
        "Tỷ lệ sai (%)": w.errorRate,
        "Đủ mẫu xếp hạng": w.total >= 10 ? "Có" : "Chưa đủ 10 câu",
      })),
      "techcamp-bao-cao",
      [
        ["Từ ngày", from],
        ["Đến ngày", to],
        ["Chủ đề", result.topic || "Tất cả"],
        ["Cỡ mẫu", result.answers],
        [
          "Múi giờ",
          "Ngày học được chụp theo múi giờ từng người; phiên hoàn thành lọc UTC",
        ],
        ["Công thức", "Tỷ lệ sai = số sai / số câu đã chấm × 100%"],
      ],
    );
  }
  if (path === "/api/admin/import/template" && method === "GET")
    return workbookResponse(
      res,
      [
        {
          code: "NEW-WORD-01",
          word: "example",
          pos: "danh từ",
          sense: "01",
          ipa: "/ɪɡˈzɑːmpl/",
          meaning: "ví dụ",
          example: "This is an example.",
          translation: "Đây là một ví dụ.",
          setCode: records("sets")[0].code,
          source: "Nội dung do tôi biên soạn",
          accepted: "example",
        },
      ],
      "techcamp-mau-nhap",
    );
  if (path === "/api/admin/import/preview" && method === "POST") {
    if (!["create", "update"].includes(body.mode))
      fail("Chọn chế độ tạo mới hoặc cập nhật.");
    if (
      !String(body.filename || "")
        .toLowerCase()
        .endsWith(".xlsx") ||
      typeof body.file !== "string"
    )
      fail("Vui lòng chọn tệp .xlsx.");
    const bytes = Buffer.from(body.file, "base64");
    if (
      bytes.length > 5 * 1024 * 1024 ||
      bytes.length < 4 ||
      bytes[0] !== 0x50 ||
      bytes[1] !== 0x4b
    )
      fail("Tệp phải là .xlsx hợp lệ và không quá 5 MB.");
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    try {
      validateXlsxArchive(bytes);
      await workbook.xlsx.load(bytes);
    } catch {
      fail("Không đọc được tệp Excel. Hãy dùng mẫu được cung cấp.");
    }
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount > 2001)
      fail("Tệp chỉ được chứa tối đa 2.000 dòng dữ liệu.");
    const headers = sheet
      .getRow(1)
      .values.slice(1)
      .map((v) => String(v || "").trim());
    const mandatory = [
      "code",
      "word",
      "pos",
      "ipa",
      "meaning",
      "example",
      "setCode",
      "source",
    ];
    if (mandatory.some((key) => !headers.includes(key)))
      fail(`Thiếu cột bắt buộc. Cần: ${mandatory.join(", ")}.`);
    const errors = [];
    const preview = [];
    const codes = new Set();
    const senses = new Set();
    for (let index = 2; index <= sheet.rowCount; index++) {
      const values = sheet.getRow(index).values.slice(1);
      if (!values.some((v) => v != null && v !== "")) continue;
      try {
        if (values.some((v) => v && typeof v === "object"))
          fail(
            "Ô dữ liệu phải là văn bản, không chứa công thức hoặc đối tượng.",
          );
        const row = Object.fromEntries(
          headers.map((h, i) => [h, String(values[i] ?? "").trim()]),
        );
        const set = records("sets").find(
          (s) => s.code === row.setCode.toUpperCase(),
        );
        if (!set) fail("Mã bộ từ không tồn tại.");
        const code = row.code.toUpperCase();
        if (codes.has(code)) fail("Mã từ trùng trong tệp.");
        codes.add(code);
        const existing = records("words").find((w) => w.code === code);
        if (
          (body.mode === "create" && existing) ||
          (body.mode === "update" && !existing)
        )
          fail(
            body.mode === "create"
              ? "Mã từ đã tồn tại."
              : "Không tìm thấy mã từ để cập nhật.",
          );
        const word = validateWord(
          {
            ...row,
            setIds: [set.id],
            accepted: row.accepted ? row.accepted.split("|") : [row.word],
            status: "draft",
          },
          existing?.id,
        );
        const key = `${normalize(word.word)}:${normalize(word.pos)}:${word.sense}`;
        if (senses.has(key)) fail("Từ, loại từ và mã nghĩa trùng trong tệp.");
        senses.add(key);
        preview.push({
          ...word,
          row: index,
          previousVersion: existing?.version || 0,
        });
      } catch (error) {
        errors.push({ row: index, message: error.message });
      }
    }
    if (!preview.length && !errors.length) fail("Tệp không có dòng dữ liệu.");
    const id = uid();
    if (!errors.length)
      run(
        "INSERT INTO import_batches VALUES(?,?,?,0,?)",
        id,
        user.id,
        JSON.stringify(preview),
        new Date().toISOString(),
      );
    return json(res, {
      id: errors.length ? null : id,
      rows: preview,
      errors,
      total: preview.length + errors.length,
    });
  }
  if (path === "/api/admin/import/commit" && method === "POST") {
    transaction(() => {
      const batch = one(
        "SELECT * FROM import_batches WHERE id=? AND actor_id=?",
        body.id,
        user.id,
      );
      if (!batch) fail("Không tìm thấy lô nhập.", 404);
      if (batch.committed) return;
      const rows = JSON.parse(batch.data);
      for (const word of rows) {
        const existing = decode(
          one("SELECT data FROM words WHERE id=?", word.id),
        );
        if ((existing?.version || 0) !== word.previousVersion)
          fail(
            "Nội dung đã thay đổi sau kiểm tra. Vui lòng kiểm tra tệp lại.",
            409,
          );
        const verified = validateWord(word, existing?.id);
        saveWord({ ...verified, id: word.id });
      }
      run("UPDATE import_batches SET committed=1 WHERE id=?", batch.id);
      audit(user.id, "import.commit", batch.id, { count: rows.length });
    });
    return json(res, { message: "Đã nhập toàn bộ dữ liệu ở trạng thái nháp." });
  }
  fail("Không tìm thấy chức năng.", 404);
}

export const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "DENY");
  try {
    if (req.headers.origin && !["GET", "HEAD"].includes(req.method)) {
      const allowed = new Set([
        `http://${req.headers.host}`,
        `https://${req.headers.host}`,
        process.env.APP_URL || "http://localhost:5173",
      ]);
      if (!allowed.has(req.headers.origin))
        fail("Nguồn yêu cầu không được cho phép.", 403);
    }
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD")
      fail("Không tìm thấy.", 404);
    const root = resolve("dist");
    let path = resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (path !== root && !path.startsWith(root + sep))
      fail("Đường dẫn không hợp lệ.", 403);
    try {
      if (!(await stat(path)).isFile()) path = resolve(root, "index.html");
    } catch {
      path = resolve(root, "index.html");
    }
    const bytes = await readFile(path);
    const mime = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".woff2": "font/woff2",
    };
    res.writeHead(200, {
      "Content-Type": mime[extname(path)] || "application/octet-stream",
      "Cache-Control":
        extname(path) === ".html" ? "no-cache" : "public, max-age=3600",
    });
    res.end(bytes);
  } catch (error) {
    const reference = uid();
    if (!error.status) console.error(`[${reference}]`, error.message);
    if (!res.headersSent)
      json(
        res,
        {
          message: error.status
            ? error.message
            : "Hệ thống chưa xử lý được yêu cầu. Vui lòng thử lại.",
          reference,
        },
        error.status || 500,
      );
    else res.end();
  }
});
let backgroundTimer;
server.on("listening", () => {
  backgroundTimer = setInterval(() => {
    void flushMailQueue();
    try {
      for (const account of all(
        "SELECT * FROM users WHERE status='active' AND json_extract(profile,'$.reminder')=1",
      )) {
        const profile = profileFor(account);
        createReminder(account, profile, getStats(account, profile));
      }
    } catch {
      console.error(
        "Techcamp: chưa tạo được thông báo nhắc học. Tác vụ sẽ thử lại ở lần kế tiếp.",
      );
    }
  }, 60000);
  backgroundTimer.unref();
  void flushMailQueue();
});
server.on("close", () => clearInterval(backgroundTimer));
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
)
  server.listen(PORT, process.env.API_HOST || "127.0.0.1", () =>
    console.log(
      `Techcamp API: http://localhost:${PORT} (${production ? "production" : "local development"})`,
    ),
  );
process.on("SIGTERM", () =>
  server.close(() => {
    db.close();
    process.exit(0);
  }),
);

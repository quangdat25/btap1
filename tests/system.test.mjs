import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  schedule,
  normalize,
  percent,
  localDay,
  validateXlsxArchive,
} from "../server/domain.mjs";

const directory = await mkdtemp(join(tmpdir(), "techcamp-test-"));
process.env.DB_PATH = join(directory, "test.sqlite");
const { server } = await import("../server/index.mjs");
const { db, one, run } = await import("../server/db.mjs");
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/api`;
async function request(
  path,
  body,
  cookie = "",
  method = body === undefined ? "GET" : "POST",
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Cookie: cookie,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = response.headers
    .get("content-type")
    ?.includes("application/json")
    ? await response.json()
    : await response.arrayBuffer();
  return {
    status: response.status,
    data: json,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}
const learner = (
  await request("/auth/login", {
    email: "learner@techcamp.local",
    password: "Techcamp@2026",
  })
).cookie;
const admin = (
  await request("/auth/login", {
    email: "admin@techcamp.local",
    password: "Techcamp@2026",
  })
).cookie;
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  await rm(directory, { recursive: true, force: true });
});

test("Ôn cách quãng: đúng, sai, trần bậc và chuẩn hóa Unicode", () => {
  const now = Date.parse("2026-11-24T10:00:00Z");
  assert.deepEqual(schedule({ stage: 2 }, true, now), {
    stage: 3,
    dueAt: "2026-12-01T10:00:00.000Z",
  });
  assert.deepEqual(schedule({ stage: 5 }, false, now), {
    stage: 0,
    dueAt: "2026-11-24T10:10:00.000Z",
  });
  assert.equal(schedule({ stage: 5 }, true, now).stage, 5);
  assert.equal(normalize("  HeLLo  WORLD "), "hello world");
  assert.notEqual(normalize("it's"), normalize("its"));
  assert.equal(normalize("e\u0301"), "é");
  assert.equal(percent(1, 3), 33.3);
  assert.equal(percent(0, 0), null);
  assert.equal(
    localDay("2026-11-23T18:00:00Z", "Asia/Ho_Chi_Minh"),
    "2026-11-24",
  );
});
test("Tệp giả mạo và tệp giải nén quá giới hạn bị từ chối trước khi xử lý Excel", () => {
  assert.throws(() => validateXlsxArchive(Buffer.from("not-an-xlsx")));
  const archive = Buffer.alloc(68);
  archive.writeUInt32LE(0x02014b50, 0);
  archive.writeUInt32LE(128 * 1024 * 1024, 24);
  archive.writeUInt32LE(0x06054b50, 46);
  archive.writeUInt16LE(1, 56);
  archive.writeUInt32LE(46, 58);
  archive.writeUInt32LE(0, 62);
  assert.throws(() => validateXlsxArchive(archive), /limit/);
});
test("Xác thực cookie, phân quyền và bảo vệ quản trị viên cuối", async () => {
  assert.ok(learner);
  assert.ok(admin);
  assert.equal((await request("/app")).status, 401);
  assert.equal((await request("/admin/data", undefined, learner)).status, 403);
  const users = (await request("/admin/data", undefined, admin)).data.users;
  const target = users.find((u) => u.role === "admin");
  assert.equal(
    (
      await request(
        "/admin/users",
        { id: target.id, role: "learner", status: "locked" },
        admin,
        "PATCH",
      )
    ).status,
    400,
  );
  const csrf = await fetch(base + "/saved", {
    method: "POST",
    headers: {
      Cookie: learner,
      Origin: "https://evil.example",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(csrf.status, 403);
  const user = one("SELECT * FROM users WHERE email='learner@techcamp.local'");
  assert.notEqual(user.password, "Techcamp@2026");
  assert.match(user.password, /^[0-9a-f]+:[0-9a-f]+$/);
});
test("Flashcard không ghi tiến độ; lưu từ chống trùng, bỏ lưu không đổi kết quả", async () => {
  const before = (await request("/app", undefined, learner)).data;
  assert.equal(before.stats.learned, 0);
  assert.equal(before.words.length, 56);
  assert.ok(!("accepted" in before.words[0]));
  const wordId = before.words[0].id;
  await request("/saved", { wordId, saved: true }, learner);
  await request("/saved", { wordId, saved: true }, learner);
  const saved = (await request("/app", undefined, learner)).data;
  assert.equal(saved.saved.length, 1);
  assert.equal(saved.stats.answers, 0);
  await request("/saved", { wordId, saved: false }, learner);
});
test("Chấm ở máy chủ; gửi lặp không cộng điểm; xung đột bị từ chối; tải lại giữ phiên", async () => {
  const created = await request(
    "/sessions",
    { mode: "new", setId: "everyday", size: 2, type: "choice" },
    learner,
  );
  assert.equal(created.status, 200);
  const s = created.data;
  const item = s.items[0];
  assert.equal("correctOption" in item, false);
  assert.equal("accepted" in item.word, false);
  const raw = JSON.parse(
    one("SELECT data FROM items WHERE id=?", item.id).data,
  );
  const answer = await request(
    `/sessions/${s.id}/items/${item.id}/answer`,
    { response: raw.correctOption },
    learner,
  );
  assert.equal(answer.status, 200);
  assert.equal(answer.data.correct, 1);
  assert.equal(answer.data.answered, 1);
  const progress = one("SELECT * FROM progress WHERE word_id=?", raw.word.id);
  assert.equal(progress.stage, 1);
  const repeat = await request(
    `/sessions/${s.id}/items/${item.id}/answer`,
    { response: raw.correctOption },
    learner,
  );
  assert.equal(repeat.data.correct, 1);
  assert.equal(
    one("SELECT * FROM progress WHERE word_id=?", raw.word.id).total,
    1,
  );
  const conflict = await request(
    `/sessions/${s.id}/items/${item.id}/answer`,
    { response: raw.options.find((o) => o.id !== raw.correctOption).id },
    learner,
  );
  assert.equal(conflict.status, 409);
  const resumed = await request(
    "/sessions",
    { mode: "practice", size: 10 },
    learner,
  );
  assert.equal(resumed.data.id, s.id);
  assert.equal(
    (await request(`/sessions/${s.id}`, undefined, admin)).status,
    404,
  );
  assert.equal(
    (await request(`/sessions/${s.id}`, undefined, learner)).data.answered,
    1,
  );
});
test("Phiên bản câu đã chốt không đổi khi quản trị sửa từ", async () => {
  const state = (await request("/app", undefined, learner)).data;
  const s = (await request(`/sessions/${state.active.id}`, undefined, learner))
    .data;
  const item = s.items[1];
  const raw = JSON.parse(
    one("SELECT data FROM items WHERE id=?", item.id).data,
  );
  const saved = await request(
    "/admin/words",
    { ...raw.word, meaning: "nghĩa mới để kiểm thử", accepted: ["newanswer"] },
    admin,
  );
  assert.equal(saved.status, 200);
  assert.equal(saved.data.word.version, 2);
  const answer = await request(
    `/sessions/${s.id}/items/${item.id}/answer`,
    { response: raw.correctOption },
    learner,
  );
  assert.equal(answer.data.status, "completed");
  assert.equal(answer.data.correct, 2);
  assert.equal(answer.data.items[1].answer.word.meaning, raw.word.meaning);
  assert.equal(answer.data.items[1].answer.word.version, 1);
  await request("/admin/words", raw.word, admin);
});
test("Nhập từ chuẩn hóa, luyện thêm giữ lịch; chỉ ôn từ đến hạn", async () => {
  const created = await request(
    "/sessions",
    { mode: "practice", setId: "everyday", size: 1, type: "typing" },
    learner,
  );
  const s = created.data;
  const item = s.items[0];
  const raw = JSON.parse(
    one("SELECT data FROM items WHERE id=?", item.id).data,
  );
  const previous = one("SELECT * FROM progress WHERE word_id=?", raw.word.id);
  const answer = await request(
    `/sessions/${s.id}/items/${item.id}/answer`,
    { response: `  ${raw.word.accepted[0].toUpperCase()}  ` },
    learner,
  );
  assert.equal(answer.status, 200);
  assert.equal(answer.data.correct, 1);
  assert.equal(
    one("SELECT * FROM progress WHERE word_id=?", raw.word.id)?.due_at,
    previous?.due_at,
  );
  const first = one("SELECT * FROM progress LIMIT 1");
  const oldDue = first.due_at;
  assert.equal(
    (
      await request(
        "/sessions",
        { mode: "review", size: 10, type: "choice" },
        learner,
      )
    ).status,
    400,
  );
  run(
    "UPDATE progress SET due_at=? WHERE user_id=? AND word_id=?",
    new Date(Date.now() - 1000).toISOString(),
    first.user_id,
    first.word_id,
  );
  const review = (
    await request(
      "/sessions",
      { mode: "review", size: 10, type: "choice" },
      learner,
    )
  ).data;
  assert.equal(review.items.length, 1);
  const rawReview = JSON.parse(
    one("SELECT data FROM items WHERE id=?", review.items[0].id).data,
  );
  const wrong = rawReview.options.find(
    (o) => o.id !== rawReview.correctOption,
  ).id;
  await request(
    `/sessions/${review.id}/items/${review.items[0].id}/answer`,
    { response: wrong },
    learner,
  );
  const updated = one(
    "SELECT * FROM progress WHERE user_id=? AND word_id=?",
    first.user_id,
    first.word_id,
  );
  assert.equal(updated.stage, 0);
  assert.notEqual(updated.due_at, oldDue);
  assert.ok(Math.abs(Date.parse(updated.due_at) - Date.now() - 600000) < 5000);
});
test("Mục tiêu có hiệu lực ngày sau; dữ liệu tài khoản được tách biệt", async () => {
  const app = (await request("/app", undefined, learner)).data;
  assert.equal(
    (
      await request(
        "/profile",
        {
          name: "Người thử",
          goal: 25,
          timezone: "Asia/Tokyo",
          reminder: true,
          reminderTime: "20:00",
        },
        learner,
        "PATCH",
      )
    ).status,
    200,
  );
  const next = (await request("/app", undefined, learner)).data;
  assert.equal(next.user.profile.goal, app.user.profile.goal);
  assert.equal(next.user.profile.pending.goal, 25);
  assert.equal(next.user.profile.timezone, "Asia/Ho_Chi_Minh");
  assert.equal((await request("/app", undefined, admin)).data.stats.answers, 0);
});
test("Excel có kiểm tra theo dòng, nhập nguyên lô, chống nhập lặp và xuất hợp lệ", async () => {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Words");
  sheet.addRow([
    "code",
    "word",
    "pos",
    "ipa",
    "meaning",
    "example",
    "setCode",
    "source",
  ]);
  sheet.addRow([
    "TEST-IMPORT",
    "sunshine",
    "danh từ",
    "/ˈsʌnʃaɪn/",
    "ánh nắng",
    "I love sunshine.",
    "EVERYDAY",
    "Tự biên soạn",
  ]);
  sheet.addRow([
    "TEST-BAD",
    "",
    "danh từ",
    "/x/",
    "lỗi",
    "Example.",
    "EVERYDAY",
    "Tự biên soạn",
  ]);
  const upload = async () =>
    request(
      "/admin/import/preview",
      {
        mode: "create",
        filename: "test.xlsx",
        file: Buffer.from(await workbook.xlsx.writeBuffer()).toString("base64"),
      },
      admin,
    );
  const invalid = await upload();
  assert.equal(invalid.status, 200);
  assert.equal(invalid.data.errors.length, 1);
  assert.equal(invalid.data.errors[0].row, 3);
  assert.equal(invalid.data.id, null);
  assert.equal(
    one("SELECT id FROM words WHERE code=?", "TEST-IMPORT"),
    undefined,
  );
  sheet.spliceRows(3, 1);
  const valid = await upload();
  assert.equal(valid.data.errors.length, 0);
  assert.equal(
    (await request("/admin/import/commit", { id: valid.data.id }, admin))
      .status,
    200,
  );
  assert.equal(
    (await request("/admin/import/commit", { id: valid.data.id }, admin))
      .status,
    200,
  );
  const word = JSON.parse(
    one("SELECT data FROM words WHERE code=?", "TEST-IMPORT").data,
  );
  assert.equal(word.status, "draft");
  const exported = await request("/history/export", undefined, learner);
  assert.equal(exported.status, 200);
  const parsed = new ExcelJS.Workbook();
  await parsed.xlsx.load(Buffer.from(exported.data));
  assert.equal(parsed.worksheets.length, 2);
  assert.ok(parsed.worksheets[0].rowCount > 1);
  const report = (await request("/admin/report", undefined, admin)).data;
  assert.ok(report.answers >= 4);
  assert.equal(report.activeLearners, 1);
});
test("Đăng ký, kích hoạt, token một lần, đặt lại mật khẩu và thu hồi phiên", async () => {
  const email = "new@example.com";
  const signup = await request("/auth/register", {
    email: `  ${email.toUpperCase()}  `,
    password: "Newpassword@2026",
    name: "Người mới",
  });
  assert.equal(signup.status, 200);
  assert.equal(
    (await request("/auth/login", { email, password: "Newpassword@2026" }))
      .status,
    401,
  );
  const activateMail = one(
    "SELECT * FROM mail WHERE recipient=? ORDER BY created_at DESC",
    email,
  );
  const token = new URLSearchParams(activateMail.link.split("?")[1]).get(
    "token",
  );
  assert.equal((await request("/auth/activate", { token })).status, 200);
  assert.equal((await request("/auth/activate", { token })).status, 400);
  const logged = await request("/auth/login", {
    email,
    password: "Newpassword@2026",
  });
  assert.equal(logged.status, 200);
  await request("/auth/forgot", { email });
  const resetMail = one(
    "SELECT * FROM mail WHERE recipient=? AND subject LIKE ? ORDER BY created_at DESC",
    email,
    "%mật khẩu%",
  );
  const resetToken = new URLSearchParams(resetMail.link.split("?")[1]).get(
    "token",
  );
  assert.equal(
    (
      await request("/auth/reset", {
        token: resetToken,
        password: "Changedpassword@2026",
      })
    ).status,
    200,
  );
  assert.equal((await request("/app", undefined, logged.cookie)).status, 401);
  assert.equal(
    (
      await request("/auth/reset", {
        token: resetToken,
        password: "Changedpassword@2026",
      })
    ).status,
    400,
  );
  const newLogin = await request("/auth/login", {
    email,
    password: "Changedpassword@2026",
  });
  assert.equal(newLogin.status, 200);
  await request("/auth/logout", {}, newLogin.cookie);
  assert.equal((await request("/app", undefined, newLogin.cookie)).status, 401);
});

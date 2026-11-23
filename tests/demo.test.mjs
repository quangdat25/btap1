import test from "node:test";
import assert from "node:assert/strict";
import { createDemoRuntime, DEMO_STORAGE_KEY } from "../src/demo/api.js";

function setup() {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  const time = { value: Date.parse("2026-11-24T10:00:00Z") };
  const runtime = createDemoRuntime(storage, { now: () => time.value });
  return {
    ...runtime,
    storage,
    time,
    state: () => JSON.parse(values.get(DEMO_STORAGE_KEY)),
    login: (email) =>
      runtime.request("/auth/login", { email, password: "Techcamp@2026" }),
  };
}
test("Demo: dữ liệu JSON giữ qua tải lại, tách riêng từng phiên trình duyệt", async () => {
  const demo = setup();
  assert.equal((await demo.request("/auth/me")).user, null);
  await demo.login("learner@techcamp.local");
  const app = await demo.request("/app");
  assert.equal(app.words.length, 56);
  assert.equal(app.stats.answers, 0);
  await demo.request("/saved", { wordId: app.words[0].id, saved: true });
  const reloaded = createDemoRuntime(demo.storage, {
    now: () => demo.time.value,
  });
  assert.equal((await reloaded.request("/app")).saved.length, 1);
  assert.equal((await setup().request("/auth/me")).user, null);
  await demo.request("/auth/logout", {});
  await assert.rejects(
    () => demo.request("/app"),
    (e) => e.status === 401,
  );
});
test("Demo: tiếp tục phiên, chấm, chống trùng, ôn cách quãng và xem lịch sử", async () => {
  const demo = setup();
  await demo.login("learner@techcamp.local");
  const session = await demo.request("/sessions", {
    mode: "new",
    setId: "everyday",
    size: 1,
    type: "typing",
  });
  assert.equal("correctOption" in session.items[0], false);
  const raw = demo.state().sessions[0].items[0];
  const path = `/sessions/${session.id}/items/${raw.id}/answer`;
  const answer = await demo.request(path, {
    response: `  ${raw.word.word.toUpperCase()}  `,
  });
  assert.equal(answer.correct, 1);
  assert.equal(answer.status, "completed");
  assert.equal(
    (await demo.request(path, { response: raw.word.word.toUpperCase() }))
      .correct,
    1,
  );
  await assert.rejects(
    () => demo.request(path, { response: "another-answer" }),
    (e) => e.status === 409,
  );
  const app = await demo.request("/app");
  assert.equal(app.stats.answers, 1);
  assert.equal(app.progress[0].stage, 1);
  assert.equal(app.history.length, 1);
  await assert.rejects(() =>
    demo.request("/sessions", { mode: "review", size: 2, type: "choice" }),
  );
  demo.time.value += 86400000;
  const review = await demo.request("/sessions", {
    mode: "review",
    size: 2,
    type: "typing",
  });
  assert.equal(review.items.length, 1);
  const wrong = await demo.request(
    `/sessions/${review.id}/items/${review.items[0].id}/answer`,
    { response: "wrong-answer" },
  );
  assert.equal(wrong.correct, 0);
  const progress = (await demo.request("/app")).progress[0];
  assert.equal(progress.stage, 0);
  assert.equal(Date.parse(progress.due_at), demo.time.value + 600000);
});
test("Demo: phân quyền, giữ snapshot từ vựng và bảo vệ quản trị viên cuối", async () => {
  const demo = setup();
  await demo.login("learner@techcamp.local");
  await assert.rejects(
    () => demo.request("/admin/data"),
    (e) => e.status === 403,
  );
  const s = await demo.request("/sessions", {
    mode: "new",
    setId: "everyday",
    size: 1,
    type: "typing",
  });
  const original = demo.state().sessions[0].items[0].word;
  await demo.request("/auth/logout", {});
  await demo.login("admin@techcamp.local");
  const admin = await demo.request("/admin/data");
  await assert.rejects(() =>
    demo.request(
      "/admin/users",
      { id: "demo-admin", role: "learner", status: "locked" },
      "PATCH",
    ),
  );
  await demo.request("/admin/words", {
    ...admin.words.find((w) => w.id === original.id),
    meaning: "nghĩa mới",
    accepted: ["new-answer"],
  });
  await demo.request("/auth/logout", {});
  await demo.login("learner@techcamp.local");
  const resumed = await demo.request(`/sessions/${s.id}`);
  assert.equal(resumed.status, "active");
  const result = await demo.request(
    `/sessions/${s.id}/items/${s.items[0].id}/answer`,
    { response: original.word },
  );
  assert.equal(result.correct, 1);
  assert.equal(result.items[0].answer.word.meaning, original.meaning);
});
test("Demo: đăng ký, hộp thư nội bộ, kích hoạt và reset dùng một lần", async () => {
  const demo = setup();
  const email = "demo@example.com";
  await demo.request("/auth/register", {
    email,
    name: "Bạn Demo",
    password: "Demo-password-2026",
  });
  await assert.rejects(() =>
    demo.request("/auth/login", { email, password: "Demo-password-2026" }),
  );
  const mail = (await demo.request("/dev/mail")).messages[0];
  const token = new URLSearchParams(mail.link.split("?")[1]).get("token");
  await demo.request("/auth/activate", { token });
  await assert.rejects(() => demo.request("/auth/activate", { token }));
  await demo.request("/auth/login", { email, password: "Demo-password-2026" });
  await demo.request("/auth/forgot", { email });
  const reset = (await demo.request("/dev/mail")).messages[0];
  const resetToken = new URLSearchParams(reset.link.split("?")[1]).get("token");
  await demo.request("/auth/reset", {
    token: resetToken,
    password: "New-demo-password-2026",
  });
  await assert.rejects(
    () => demo.request("/app"),
    (e) => e.status === 401,
  );
  assert.equal(
    (
      await demo.request("/auth/login", {
        email,
        password: "New-demo-password-2026",
      })
    ).user.name,
    "Bạn Demo",
  );
});
test("Demo: nhập Excel nguyên lô, chống nhập lặp và xuất tệp ngay trong trình duyệt", async () => {
  const { default: ExcelJS } = await import("exceljs");
  const demo = setup();
  await demo.login("admin@techcamp.local");
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
    "DEMO-IMPORT",
    "sunshine",
    "danh từ",
    "/ˈsʌnʃaɪn/",
    "ánh nắng",
    "I love sunshine.",
    "EVERYDAY",
    "Tự biên soạn",
  ]);
  sheet.addRow([
    "DEMO-BAD",
    "",
    "danh từ",
    "/x/",
    "lỗi",
    "Example.",
    "EVERYDAY",
    "Tự biên soạn",
  ]);
  const upload = async () =>
    demo.request("/admin/import/preview", {
      mode: "create",
      filename: "test.xlsx",
      file: Buffer.from(await workbook.xlsx.writeBuffer()).toString("base64"),
    });
  const bad = await upload();
  assert.equal(bad.errors.length, 1);
  assert.equal(bad.id, null);
  sheet.spliceRows(3, 1);
  const valid = await upload();
  assert.equal(valid.errors.length, 0);
  await demo.request("/admin/import/commit", { id: valid.id });
  await demo.request("/admin/import/commit", { id: valid.id });
  const words = (await demo.request("/admin/data")).words.filter(
    (w) => w.code === "DEMO-IMPORT",
  );
  assert.equal(words.length, 1);
  assert.equal(words[0].status, "draft");
  const exported = await demo.exportFile("/admin/import/template");
  assert.match(exported.filename, /\.xlsx$/);
  const parsed = new ExcelJS.Workbook();
  await parsed.xlsx.load(exported.buffer);
  assert.equal(parsed.worksheets.length, 2);
});

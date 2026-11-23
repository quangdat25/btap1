import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp } from "node:fs/promises";
import { resolve, join } from "node:path";

const artifacts = resolve("test-artifacts");
await mkdir(artifacts, { recursive: true });
const temp = await mkdtemp(join(artifacts, "browser-"));
process.env.DB_PATH = join(temp, "test.sqlite");
const { server } = await import("../server/index.mjs");
const { db, one } = await import("../server/db.mjs");
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const checkOverflow = async (label) => {
  const dimensions = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: innerWidth,
  }));
  assert.ok(
    dimensions.scroll <= dimensions.width,
    `${label}: overflow ${JSON.stringify(dimensions)}`,
  );
};
const screenshot = async (name) => {
  const toast = page.getByRole("button", {
    name: "Đóng thông báo",
    exact: true,
  });
  if (await toast.isVisible()) await toast.click();
  return page.screenshot({
    path: join(artifacts, `${name}.png`),
    fullPage: true,
  });
};
try {
  await page.goto(origin);
  await page.getByRole("heading", { name: "Chào mừng bạn trở lại." }).waitFor();
  await screenshot("login-desktop");
  await page.getByRole("button", { name: "Người học", exact: true }).click();
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.getByRole("heading", { name: /Chào Anh, cùng học nhé/ }).waitFor();
  await checkOverflow("dashboard desktop");
  await screenshot("dashboard-desktop");
  await page.goto(`${origin}/#library`);
  await page.getByLabel("Tìm bộ từ").fill("Hello");
  await page.getByRole("link", { name: "Hello, everyday!" }).click();
  await page.getByRole("button", { name: "Học bằng flashcard" }).click();
  await page.getByRole("button", { name: "Lật thẻ để xem nghĩa" }).click();
  await page.getByRole("heading", { name: "xin chào", exact: true }).waitFor();
  await page.getByRole("button", { name: "Lưu từ", exact: true }).click();
  await page
    .getByRole("button", { name: "Đánh dấu từ khó", exact: true })
    .click();
  await screenshot("flashcard-desktop");
  assert.equal(one("SELECT COUNT(*) n FROM answers").n, 0);
  await page.goto(`${origin}/#set/everyday`);
  await page.getByRole("button", { name: "Bắt đầu luyện tập" }).click();
  await page.getByLabel("Số từ trong phiên").fill("2");
  await page.getByLabel("Dạng bài").selectOption("typing");
  await page
    .getByRole("button", { name: "Bắt đầu phiên học", exact: true })
    .click();
  await page.getByLabel("Câu trả lời của bạn").waitFor();
  const s = one("SELECT id FROM sessions WHERE status='active'");
  const raw = JSON.parse(
    one("SELECT data FROM items WHERE session_id=? ORDER BY position", s.id)
      .data,
  );
  await page.getByLabel("Câu trả lời của bạn").fill(raw.word.accepted[0]);
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await page.getByText("Chính xác! Thêm một bước tiến.").waitFor();
  await screenshot("answer-desktop");
  await page.reload();
  await page.getByLabel("Câu trả lời của bạn").fill("wrong-answer");
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await page.getByText("Chưa đúng, cùng ghi nhớ lại nhé.").waitFor();
  await page.getByRole("button", { name: "Xem kết quả", exact: true }).click();
  await page.getByRole("heading", { name: "Bạn đã làm được rồi!" }).waitFor();
  assert.equal(one("SELECT COUNT(*) n FROM answers").n, 2);
  await screenshot("result-desktop");
  await page.goto(`${origin}/#history`);
  await page.getByRole("heading", { name: "Từng bước tiến của bạn" }).waitFor();
  const downloadWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất lịch sử Excel" }).click();
  const downloaded = await downloadWait;
  assert.match(downloaded.suggestedFilename(), /\.xlsx$/);
  await page.goto(`${origin}/#profile`);
  await page.getByLabel("Mục tiêu mỗi ngày").fill("15");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await page.getByText(/Đã lưu hồ sơ/).waitFor();
  for (const route of [
    "dashboard",
    "library",
    "set/everyday",
    "flashcards/everyday",
    "saved",
    "review",
    "history",
    "profile",
  ]) {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${origin}/#${route}`);
    await page.waitForTimeout(150);
    await checkOverflow(`mobile ${route}`);
    if (
      ["dashboard", "library", "flashcards/everyday", "profile"].includes(route)
    )
      await screenshot(`mobile-${route.replace("/", "-")}`);
  }
  await page.getByRole("button", { name: "Mở menu", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Khám phá bộ từ" })
    .click();
  await page
    .getByRole("heading", { name: "Một thế giới từ vựng đang chờ bạn" })
    .waitFor();
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await page
    .getByRole("button", { name: "Quản trị viên", exact: true })
    .click();
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page
    .getByRole("heading", { name: "Cùng xây dựng một nơi học tốt hơn" })
    .waitFor();
  await screenshot("admin-desktop");
  await page.getByRole("tab", { name: "Từ & câu hỏi" }).click();
  await page.getByRole("button", { name: "Thêm từ mới" }).click();
  await page.getByLabel("Mã định danh", { exact: true }).fill("BROWSER-TEST");
  await page.getByLabel("Từ tiếng Anh", { exact: true }).fill("sunlight");
  await page.getByLabel("Phiên âm IPA").fill("/ˈsʌnlaɪt/");
  await page
    .getByLabel("Nghĩa tiếng Việt", { exact: true })
    .fill("ánh sáng mặt trời");
  await page
    .getByLabel("Ví dụ tiếng Anh", { exact: true })
    .fill("The room is full of sunlight.");
  await page
    .getByLabel("Nguồn nội dung / quyền sử dụng", { exact: true })
    .fill("Tự biên soạn");
  await page.getByRole("button", { name: "Lưu nội dung", exact: true }).click();
  await page.getByText("Đã lưu nội dung và ghi nhận nhật ký.").waitFor();
  assert.ok(one("SELECT id FROM words WHERE code='BROWSER-TEST'"));
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
    "BROWSER-IMPORT",
    "moonlight",
    "danh từ",
    "/ˈmuːnlaɪt/",
    "ánh trăng",
    "The moonlight is beautiful.",
    "EVERYDAY",
    "Tự biên soạn",
  ]);
  await page.getByRole("tab", { name: "Nhập Excel" }).click();
  await page.getByLabel("Chọn tệp Excel", { exact: true }).setInputFiles({
    name: "words.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
  });
  await page.getByRole("button", { name: "Kiểm tra tệp", exact: true }).click();
  await page
    .getByRole("button", { name: "Xác nhận nhập 1 từ", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Đã nhập dữ liệu thành công" })
    .waitFor();
  await screenshot("import-desktop");
  for (const tab of [
    "Tổng quan",
    "Từ & câu hỏi",
    "Bộ từ",
    "Chủ đề",
    "Tài khoản",
    "Báo cáo",
    "Cấu hình",
    "Nhật ký",
  ]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await page.setViewportSize({ width: 360, height: 800 });
    await checkOverflow(`mobile admin ${tab}`);
    await page.setViewportSize({ width: 1440, height: 1080 });
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: đăng nhập, tìm bộ từ, flashcard/lưu từ, luyện tập, phản hồi, tiếp tục sau tải lại, kết quả, xuất Excel, hồ sơ, menu điện thoại, CRUD quản trị, nhập Excel; không tràn ngang ở 360px; không lỗi JavaScript.",
  );
  console.log(`Screenshots: ${artifacts}`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  db.close();
}

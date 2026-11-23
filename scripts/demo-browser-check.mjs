import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

const apiRequests = [];
const root = resolve("dist");
const server = http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/")) {
    apiRequests.push(req.url);
    res.writeHead(404);
    return res.end("Demo must not call a backend");
  }
  try {
    let path = resolve(
      root,
      `.${new URL(req.url, "http://localhost").pathname}`,
    );
    if (!path.startsWith(root + sep)) path = resolve(root, "index.html");
    let bytes;
    try {
      bytes = await readFile(path);
    } catch {
      path = resolve(root, "index.html");
      bytes = await readFile(path);
    }
    res.writeHead(200, {
      "Content-Type":
        {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
        }[extname(path)] || "application/octet-stream",
    });
    res.end(bytes);
  } catch {
    res.writeHead(500);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin =
  process.env.DEMO_TEST_URL || `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const errors = [];
  const outgoingApi = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      outgoingApi.push(request.url());
  });
  const screenshotRoot = resolve("test-artifacts");
  await mkdir(screenshotRoot, { recursive: true });
  await page.goto(origin);
  await page.getByRole("heading", { name: "Chào mừng bạn trở lại." }).waitFor();
  await page
    .getByText("Bản demo · JSON trong phiên trình duyệt", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Người học", exact: true }).click();
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page
    .getByRole("heading", { name: "Chào Anh, cùng học nhé!" })
    .waitFor();
  await page.goto(`${origin}/#set/everyday`);
  await page
    .getByRole("button", { name: "Học bằng flashcard", exact: true })
    .click();
  await page.getByRole("button", { name: "Lật thẻ để xem nghĩa" }).click();
  await page.getByRole("heading", { name: "xin chào", exact: true }).waitFor();
  await page.getByRole("button", { name: "Lưu từ", exact: true }).click();
  await page.goto(`${origin}/#set/everyday`);
  await page
    .getByRole("button", { name: "Bắt đầu luyện tập", exact: true })
    .click();
  await page.getByLabel("Số từ trong phiên").fill("2");
  await page.getByLabel("Dạng bài").selectOption("typing");
  await page
    .getByRole("button", { name: "Bắt đầu phiên học", exact: true })
    .click();
  await page.getByLabel("Câu trả lời của bạn").waitFor();
  const answer = await page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("techcamp.demo.v1")).sessions[0]
        .items[0].word.word,
  );
  await page.getByLabel("Câu trả lời của bạn").fill(answer);
  await page
    .getByRole("button", { name: "Kiểm tra đáp án", exact: true })
    .click();
  await page.getByText("Chính xác! Thêm một bước tiến.").waitFor();
  await page.reload();
  await page.getByLabel("Câu trả lời của bạn").fill("wrong-answer");
  await page
    .getByRole("button", { name: "Kiểm tra đáp án", exact: true })
    .click();
  await page.getByText("Chưa đúng, cùng ghi nhớ lại nhé.").waitFor();
  await page.getByRole("button", { name: "Xem kết quả", exact: true }).click();
  await page.getByRole("heading", { name: "Bạn đã làm được rồi!" }).waitFor();
  await page.goto(`${origin}/#history`);
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Xuất lịch sử Excel", exact: true })
    .click();
  assert.match((await downloadPromise).suggestedFilename(), /\.xlsx$/);
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(
          sessionStorage.getItem("techcamp.demo.v1"),
        ).sessions[0].items.filter((i) => i.answer).length,
    ),
    2,
  );
  await page.goto(`${origin}/#dashboard`);
  await page.screenshot({
    path: resolve(screenshotRoot, "demo-desktop.png"),
    fullPage: true,
  });
  for (const route of [
    "dashboard",
    "library",
    "saved",
    "review",
    "history",
    "profile",
  ]) {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${origin}/#${route}`);
    await page.waitForTimeout(70);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Mobile overflow: ${route}`,
    );
  }
  await page.screenshot({
    path: resolve(screenshotRoot, "demo-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await page
    .getByRole("button", { name: "Quản trị viên", exact: true })
    .click();
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page
    .getByRole("heading", { name: "Cùng xây dựng một nơi học tốt hơn" })
    .waitFor();
  await page.getByRole("tab", { name: "Từ & câu hỏi", exact: true }).click();
  await page.getByRole("button", { name: "Thêm từ mới", exact: true }).click();
  await page.getByLabel("Mã định danh", { exact: true }).fill("DEMO-UI-WORD");
  await page.getByLabel("Từ tiếng Anh", { exact: true }).fill("sunlight");
  await page.getByLabel("Phiên âm IPA").fill("/ˈsʌnlaɪt/");
  await page
    .getByLabel("Nghĩa tiếng Việt", { exact: true })
    .fill("ánh sáng mặt trời");
  await page
    .getByLabel("Ví dụ tiếng Anh", { exact: true })
    .fill("The sunlight is warm.");
  await page
    .getByLabel("Nguồn nội dung / quyền sử dụng", { exact: true })
    .fill("Tự biên soạn");
  await page.getByRole("button", { name: "Lưu nội dung", exact: true }).click();
  await page.getByText("Đã lưu nội dung và ghi nhận nhật ký.").waitFor();
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
    "DEMO-UI-IMPORT",
    "moonlight",
    "danh từ",
    "/ˈmuːnlaɪt/",
    "ánh trăng",
    "The moonlight is beautiful.",
    "EVERYDAY",
    "Tự biên soạn",
  ]);
  await page.getByRole("tab", { name: "Nhập Excel", exact: true }).click();
  await page.getByLabel("Chọn tệp Excel", { exact: true }).setInputFiles({
    name: "demo.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
  });
  await page.getByRole("button", { name: "Kiểm tra tệp", exact: true }).click();
  await page
    .getByRole("button", { name: "Xác nhận nhập 1 từ", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Đã nhập dữ liệu thành công", exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem("techcamp.demo.v1")).words.filter(
          (w) => w.code === "DEMO-UI-IMPORT",
        ).length,
    ),
    1,
  );
  await page.getByRole("tab", { name: "Báo cáo", exact: true }).click();
  await page
    .getByRole("heading", {
      name: "Hoạt động & chất lượng học tập",
      exact: true,
    })
    .waitFor();
  const isolated = await browser.newContext();
  const isolatedPage = await isolated.newPage();
  await isolatedPage.goto(origin);
  await isolatedPage
    .getByRole("heading", { name: "Chào mừng bạn trở lại." })
    .waitFor();
  assert.equal(
    await isolatedPage.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem("techcamp.demo.v1")).sessions.length,
    ),
    0,
  );
  assert.deepEqual(apiRequests, []);
  assert.deepEqual(outgoingApi, []);
  assert.deepEqual(errors, []);
  console.log(
    `PASS ${origin}: demo hoạt động không cần API/database; đăng nhập, flashcard, làm bài, reload, kết quả, lưu từ, quản trị, Excel và giao diện 360px; phiên mới tách dữ liệu.`,
  );
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

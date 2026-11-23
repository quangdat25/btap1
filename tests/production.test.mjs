import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("Production: không có tài khoản mẫu/hộp thư thử; gửi thư qua SMTP cục bộ và xóa liên kết sau gửi", async () => {
  const received = [];
  const sockets = new Set();
  const smtp = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.write("220 localhost ESMTP test\r\n");
    let buffer = "";
    let reading = false;
    let mail = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      while (buffer.includes("\r\n")) {
        const end = buffer.indexOf("\r\n");
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (reading) {
          if (line === ".") {
            received.push(mail);
            mail = "";
            reading = false;
            socket.write("250 message accepted\r\n");
          } else mail += line + "\r\n";
        } else if (/^EHLO|^HELO/.test(line))
          socket.write("250-localhost\r\n250 PIPELINING\r\n");
        else if (line === "DATA") {
          reading = true;
          socket.write("354 end with dot\r\n");
        } else if (line === "QUIT") socket.end("221 goodbye\r\n");
        else socket.write("250 OK\r\n");
      }
    });
  });
  await new Promise((resolve) => smtp.listen(0, "127.0.0.1", resolve));
  const directory = await mkdtemp(join(tmpdir(), "techcamp-production-test-"));
  process.env.NODE_ENV = "production";
  process.env.DB_PATH = join(directory, "production.sqlite");
  process.env.ADMIN_EMAIL = "owner@example.com";
  process.env.ADMIN_PASSWORD = "Ownerpassword@2026";
  process.env.SMTP_URL = `smtp://127.0.0.1:${smtp.address().port}`;
  process.env.MAIL_FROM = "Techcamp <noreply@example.com>";
  process.env.APP_URL = "https://techcamp.example.com";
  const { server } = await import("../server/index.mjs");
  const { db, one } = await import("../server/db.mjs");
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}/api`;
  try {
    assert.equal(one("SELECT COUNT(*) n FROM users").n, 1);
    assert.equal(one("SELECT email FROM users").email, "owner@example.com");
    assert.equal(
      (await (await fetch(origin + "/auth/me")).json()).localMode,
      false,
    );
    assert.notEqual((await fetch(origin + "/dev/mail")).status, 200);
    const response = await fetch(origin + "/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "student@example.com",
        name: "Học viên",
        password: "Learnerpassword@2026",
      }),
    });
    assert.equal(response.status, 200);
    const deadline = Date.now() + 6000;
    while (
      one("SELECT COUNT(*) n FROM mail_jobs WHERE status='sent'").n !== 1 &&
      Date.now() < deadline
    )
      await new Promise((resolve) => setTimeout(resolve, 25));
    const job = one("SELECT * FROM mail_jobs");
    assert.equal(job.status, "sent");
    assert.equal(job.link, "");
    assert.equal(job.attempts, 1);
    assert.equal(received.length, 1);
    assert.match(received[0], /student@example.com/);
    assert.equal(one("SELECT COUNT(*) n FROM mail").n, 0);
    assert.equal(one("SELECT length(hash) n FROM tokens").n, 64);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => smtp.close(resolve));
    db.close();
    await rm(directory, { recursive: true, force: true });
  }
});

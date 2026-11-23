import { seedTopics, seedSets, seedWords } from "../../server/seed.mjs";
import {
  localDay,
  normalize,
  percent,
  publicItem,
  publicWord,
  schedule,
} from "../../server/domain.mjs";

export const DEMO_STORAGE_KEY = "techcamp.demo.v1";
const copy = (value) => structuredClone(value);
const uid = () => crypto.randomUUID();
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const required = (value, label, max = 1000) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    fail(`${label} là bắt buộc và tối đa ${max} ký tự.`);
  return value.trim();
};
const emailValue = (value) => {
  const email = required(value, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fail("Email không đúng định dạng.");
  return email;
};
const passwordValue = (value) => {
  if (typeof value !== "string" || value.length < 12 || value.length > 128)
    fail("Mật khẩu cần từ 12 đến 128 ký tự.");
  return value;
};
const digest = async (value) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");

// This adapter deliberately runs in the browser. It is a demo, not an auth or
// persistence service. JSON stays in this tab's sessionStorage; no data is sent.
export function createDemoRuntime(storage, options = {}) {
  const clock = options.now || (() => Date.now());
  const now = () => new Date(clock()).toISOString();
  let state;
  let queue = Promise.resolve();
  async function load() {
    const raw = storage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (
          parsed.version === 1 &&
          Array.isArray(parsed.users) &&
          Array.isArray(parsed.sessions)
        )
          return parsed;
      } catch {
        /* Reset incompatible demo JSON. */
      }
    }
    const password = await digest("Techcamp@2026");
    const profile = () => ({
      goal: 10,
      timezone: "Asia/Ho_Chi_Minh",
      reminder: false,
      reminderTime: "20:00",
    });
    return {
      version: 1,
      userId: null,
      users: [
        {
          id: "demo-learner",
          email: "learner@techcamp.local",
          password,
          name: "Minh Anh",
          role: "learner",
          status: "active",
          profile: profile(),
          created_at: now(),
        },
        {
          id: "demo-admin",
          email: "admin@techcamp.local",
          password,
          name: "Quản trị viên",
          role: "admin",
          status: "active",
          profile: profile(),
          created_at: now(),
        },
      ],
      topics: copy(seedTopics).map((t) => ({
        ...t,
        code: t.id.toUpperCase(),
        status: "published",
      })),
      sets: copy(seedSets),
      words: copy(seedWords),
      sessions: [],
      progress: [],
      saved: [],
      daily: [],
      notifications: [],
      audit: [],
      mail: [],
      tokens: [],
      imports: [],
      config: {
        id: "demo-config",
        intervals: [1, 3, 7, 14, 30],
        retryMinutes: 10,
        sessionSize: 10,
      },
    };
  }
  function audit(actor, action, object, detail = {}) {
    state.audit.unshift({
      id: uid(),
      actor_id: actor?.id || null,
      actor: actor?.name || "Hệ thống",
      action,
      object_id: object,
      detail: JSON.stringify(detail),
      created_at: now(),
    });
  }
  function currentUser() {
    const user = state.users.find(
      (u) => u.id === state.userId && u.status === "active",
    );
    if (!user) fail("Phiên demo đã kết thúc. Vui lòng đăng nhập lại.", 401);
    return user;
  }
  function profileFor(user) {
    let p = user.profile;
    if (p.pending && localDay(clock(), p.timezone) >= p.pending.effectiveOn) {
      user.profile = { ...p, ...p.pending };
      delete user.profile.pending;
      p = user.profile;
    }
    const day = localDay(clock(), p.timezone);
    let daily = state.daily.find((d) => d.user_id === user.id && d.day === day);
    if (!daily) {
      daily = { user_id: user.id, day, goal: p.goal, timezone: p.timezone };
      state.daily.push(daily);
    }
    return { ...p, ...daily };
  }
  function userView(user) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      createdAt: user.created_at,
      profile: profileFor(user),
    };
  }
  function availableWords() {
    const topics = state.topics
      .filter((t) => t.status === "published")
      .map((t) => t.id);
    const sets = state.sets
      .filter((s) => s.status === "published" && topics.includes(s.topicId))
      .map((s) => s.id);
    return state.words.filter(
      (w) =>
        w.status === "published" && w.setIds.some((id) => sets.includes(id)),
    );
  }
  const ownAnswers = (user) =>
    state.sessions
      .filter((s) => s.user_id === user.id)
      .flatMap((s) =>
        s.items
          .filter((i) => i.answer)
          .map((i) => ({
            ...i.answer,
            word_id: i.word.id,
            mode: s.mode,
            session: s,
            word: i.word,
          })),
      );
  function sessionView(session, user) {
    if (!session || session.user_id !== user.id)
      fail("Không tìm thấy phiên học.", 404);
    const answered = session.items.filter((i) => i.answer);
    const correct = answered.filter((i) => i.answer.correct).length;
    return {
      id: session.id,
      mode: session.mode,
      setId: session.setId,
      title: session.title,
      status: session.status,
      createdAt: session.createdAt,
      completedAt: session.completedAt,
      items: session.items.map((i) => ({
        id: i.id,
        ...publicItem(i),
        ...(i.answer ? { answer: copy(i.answer) } : {}),
      })),
      correct,
      answered: answered.length,
      accuracy: percent(correct, answered.length),
    };
  }
  function statsFor(user) {
    const p = profileFor(user);
    const answers = ownAnswers(user);
    const today = answers.filter((a) => a.day === p.day);
    const available = availableWords().map((w) => w.id);
    const days = Array.from({ length: 7 }, (_, index) => {
      const d = new Date(`${p.day}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 6 + index);
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
    const cursor = new Date(`${p.day}T12:00:00Z`);
    let streak = 0;
    if (!activeDays.has(p.day)) cursor.setUTCDate(cursor.getUTCDate() - 1);
    while (activeDays.has(cursor.toISOString().slice(0, 10))) {
      streak++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    const stats = {
      learned: new Set(answers.map((a) => a.word_id)).size,
      today: new Set(today.map((a) => a.word_id)).size,
      due: state.progress.filter(
        (x) =>
          x.user_id === user.id &&
          x.due_at <= now() &&
          available.includes(x.word_id),
      ).length,
      correct: answers.filter((a) => a.correct).length,
      answers: answers.length,
      accuracy: percent(
        answers.filter((a) => a.correct).length,
        answers.length,
      ),
      streak,
      days,
      goal: p.goal,
    };
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: p.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(clock()));
    if (
      p.reminder &&
      time >= p.reminderTime &&
      (stats.today < stats.goal || stats.due) &&
      !state.notifications.some((n) => n.user_id === user.id && n.day === p.day)
    )
      state.notifications.push({
        id: uid(),
        user_id: user.id,
        day: p.day,
        read: false,
        message: stats.due
          ? `Bạn có ${stats.due} từ đến lịch ôn.`
          : `Hôm nay bạn đã luyện ${stats.today}/${stats.goal} từ. Tiếp tục một chút nhé!`,
      });
    return stats;
  }
  function report(filter = {}) {
    const { from = "", to = "9999", topic = "" } = filter;
    if (from && to && from > to) fail("Ngày bắt đầu phải trước ngày kết thúc.");
    const answers = state.sessions
      .flatMap((s) =>
        s.items
          .filter((i) => i.answer)
          .map((i) => ({ ...i.answer, user_id: s.user_id, word: i.word })),
      )
      .filter(
        (a) =>
          a.day >= from &&
          a.day <= (to || "9999") &&
          (!topic ||
            a.word.setIds.some(
              (id) => state.sets.find((s) => s.id === id)?.topicId === topic,
            )),
      );
    const words = new Map();
    for (const a of answers) {
      const key = `${a.word.id}:${a.word.version}`;
      const w = words.get(key) || {
        word: a.word.word,
        meaning: a.word.meaning,
        version: a.word.version,
        total: 0,
        wrong: 0,
      };
      w.total++;
      w.wrong += a.correct ? 0 : 1;
      words.set(key, w);
    }
    return {
      learners: state.users.filter((u) => u.role === "learner").length,
      activeLearners: new Set(answers.map((a) => a.user_id)).size,
      answers: answers.length,
      accuracy: percent(
        answers.filter((a) => a.correct).length,
        answers.length,
      ),
      practiced: new Set(answers.map((a) => `${a.user_id}:${a.word.id}`)).size,
      completed: state.sessions.filter(
        (s) =>
          s.status === "completed" &&
          s.completedAt.slice(0, 10) >= from &&
          s.completedAt.slice(0, 10) <= (to || "9999") &&
          (!topic ||
            state.sets.find((x) => x.id === s.setId)?.topicId === topic),
      ).length,
      words: [...words.values()]
        .map((w) => ({ ...w, errorRate: percent(w.wrong, w.total) }))
        .sort(
          (a, b) =>
            (b.total >= 10) - (a.total >= 10) || b.errorRate - a.errorRate,
        ),
      byTopic: state.topics.map((t) => {
        const rows = answers.filter((a) =>
          a.word.setIds.some(
            (id) => state.sets.find((s) => s.id === id)?.topicId === t.id,
          ),
        );
        return {
          name: t.name,
          count: rows.length,
          correct: rows.filter((a) => a.correct).length,
        };
      }),
      from,
      to,
      topic,
    };
  }
  function validateWord(input, id) {
    const old = state.words.find((w) => w.id === id);
    if (id && !old) fail("Không tìm thấy từ.", 404);
    const word = {
      ...input,
      id: id || uid(),
      code: required(input.code, "Mã từ", 40).toUpperCase(),
      word: required(input.word, "Từ tiếng Anh", 100),
      pos: required(input.pos, "Loại từ", 50),
      sense: required(input.sense || "01", "Mã nghĩa", 40),
      ipa: required(input.ipa, "Phiên âm", 100),
      meaning: required(input.meaning, "Nghĩa tiếng Việt"),
      example: required(input.example, "Ví dụ"),
      source: required(input.source, "Nguồn nội dung", 500),
      version: (old?.version || 0) + 1,
    };
    if (!["draft", "published", "archived"].includes(word.status))
      fail("Trạng thái không hợp lệ.");
    if (
      !Array.isArray(word.setIds) ||
      !word.setIds.length ||
      word.setIds.some((x) => !state.sets.some((s) => s.id === x))
    )
      fail("Chọn ít nhất một bộ từ hợp lệ.");
    if (
      state.words.some(
        (w) =>
          w.id !== id &&
          (w.code === word.code ||
            (normalize(w.word) === normalize(word.word) &&
              normalize(w.pos) === normalize(word.pos) &&
              w.sense === word.sense)),
      )
    )
      fail("Mã từ hoặc từ, loại từ và mã nghĩa đã tồn tại.");
    word.accepted = (input.accepted || [word.word]).map((x) =>
      required(x, "Đáp án", 128),
    );
    if (!word.accepted.length) fail("Cần ít nhất một đáp án chấp nhận.");
    word.explanation =
      input.explanation || `“${word.word}” có nghĩa là “${word.meaning}”.`;
    if (word.audio && !/^https:\/\//.test(word.audio))
      fail("URL phát âm cần sử dụng HTTPS.");
    return word;
  }
  function mailFor(user, type) {
    state.tokens
      .filter((t) => t.user_id === user.id && t.type === type)
      .forEach((t) => {
        t.used = true;
      });
    const token = uid();
    state.tokens.push({
      token,
      type,
      user_id: user.id,
      used: false,
      expiresAt: clock() + (type === "activate" ? 86400000 : 900000),
    });
    state.mail.unshift({
      id: uid(),
      recipient: user.email,
      subject:
        type === "activate"
          ? "Kích hoạt tài khoản Techcamp"
          : "Đặt lại mật khẩu Techcamp",
      link: `#${type}?token=${token}`,
      created_at: now(),
    });
  }
  async function dispatch(path, body, method) {
    const url = new URL(path, "https://demo.techcamp.local");
    const route = url.pathname;
    if (route === "/auth/me") {
      const user = state.users.find(
        (u) => u.id === state.userId && u.status === "active",
      );
      return {
        user: user ? userView(user) : null,
        localMode: true,
        demoMode: true,
      };
    }
    if (route === "/health") return { status: "ok", mode: "browser-demo" };
    if (route === "/auth/login" && method === "POST") {
      const email = emailValue(body.email);
      const password = await digest(String(body.password || ""));
      const user = state.users.find(
        (u) =>
          u.email === email && u.password === password && u.status === "active",
      );
      if (!user)
        fail(
          "Thông tin đăng nhập không hợp lệ hoặc tài khoản chưa thể truy cập.",
          401,
        );
      state.userId = user.id;
      audit(user, "auth.login", user.id);
      return { user: userView(user) };
    }
    if (
      ["/auth/register", "/auth/forgot", "/auth/resend"].includes(route) &&
      method === "POST"
    ) {
      const email = emailValue(body.email);
      let user = state.users.find((u) => u.email === email);
      if (route.endsWith("register")) {
        const name = required(body.name, "Tên hiển thị", 80);
        const password = passwordValue(body.password);
        if (!user) {
          user = {
            id: uid(),
            email,
            password: await digest(password),
            name,
            role: "learner",
            status: "pending",
            profile: {
              goal: 10,
              timezone: "Asia/Ho_Chi_Minh",
              reminder: false,
              reminderTime: "20:00",
            },
            created_at: now(),
          };
          state.users.push(user);
        }
        if (user.status === "pending") mailFor(user, "activate");
      }
      if (route.endsWith("resend") && user?.status === "pending")
        mailFor(user, "activate");
      if (route.endsWith("forgot") && user?.status === "active")
        mailFor(user, "reset");
      return {
        message:
          "Nếu thông tin đủ điều kiện, liên kết sẽ xuất hiện trong hộp thư thử nghiệm của phiên demo này.",
      };
    }
    if (
      ["/auth/activate", "/auth/reset"].includes(route) &&
      method === "POST"
    ) {
      const type = route.endsWith("activate") ? "activate" : "reset";
      const token = state.tokens.find(
        (t) =>
          t.token === body.token &&
          t.type === type &&
          !t.used &&
          t.expiresAt > clock(),
      );
      if (!token)
        fail("Liên kết không còn hiệu lực. Vui lòng yêu cầu liên kết mới.");
      const user = state.users.find((u) => u.id === token.user_id);
      if (
        (type === "activate" && user.status !== "pending") ||
        (type === "reset" && user.status !== "active")
      )
        fail("Liên kết không còn hiệu lực.");
      if (type === "activate") user.status = "active";
      else {
        user.password = await digest(passwordValue(body.password));
        if (state.userId === user.id) state.userId = null;
      }
      state.tokens
        .filter((t) => t.user_id === user.id)
        .forEach((t) => {
          t.used = true;
        });
      audit(user, `auth.${type}`, user.id);
      return {
        message:
          type === "activate"
            ? "Kích hoạt thành công. Bạn có thể đăng nhập."
            : "Đã đổi mật khẩu. Vui lòng đăng nhập lại.",
      };
    }
    if (route === "/dev/mail") return { messages: state.mail.slice(0, 30) };
    const user = currentUser();
    const profile = profileFor(user);
    if (route === "/auth/logout") {
      state.userId = null;
      return { ok: true };
    }
    if (route === "/app") {
      const words = availableWords();
      const stats = statsFor(user);
      const saved = state.saved.filter((s) => s.user_id === user.id);
      const history = state.sessions
        .filter((s) => s.user_id === user.id)
        .slice()
        .reverse()
        .map((s) => {
          const { items, ...view } = sessionView(s, user);
          return { ...view, total: items.length };
        });
      const topics = state.topics.filter((t) => t.status === "published");
      return {
        user: userView(user),
        topics,
        sets: state.sets
          .filter(
            (s) =>
              s.status === "published" &&
              topics.some((t) => t.id === s.topicId),
          )
          .map((s) => ({
            ...s,
            count: words.filter((w) => w.setIds.includes(s.id)).length,
          })),
        words: words.map(publicWord),
        saved: saved.map((s) => s.word_id),
        savedWords: saved.map((s) => ({
          ...publicWord(state.words.find((w) => w.id === s.word_id)),
          difficult: Boolean(s.difficult),
        })),
        stats,
        practicedWordIds: [...new Set(ownAnswers(user).map((a) => a.word_id))],
        progress: state.progress.filter((p) => p.user_id === user.id),
        history,
        active: history.find((s) => s.status === "active") || null,
        notifications: state.notifications
          .filter((n) => n.user_id === user.id)
          .slice()
          .reverse(),
        serverTime: now(),
        config: { sessionSize: state.config.sessionSize },
      };
    }
    if (route === "/profile" && method === "PATCH") {
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
      user.name = required(body.name, "Tên hiển thị", 80);
      user.profile.reminder = Boolean(body.reminder);
      user.profile.reminderTime = body.reminderTime;
      if (goal !== profile.goal || body.timezone !== profile.timezone) {
        const next = new Date(`${profile.day}T12:00:00Z`);
        next.setUTCDate(next.getUTCDate() + 1);
        user.profile.pending = {
          goal,
          timezone: body.timezone,
          effectiveOn: next.toISOString().slice(0, 10),
        };
      } else delete user.profile.pending;
      return {
        message:
          "Đã lưu hồ sơ demo. Mục tiêu và múi giờ mới có hiệu lực từ ngày kế tiếp.",
      };
    }
    if (route === "/profile/password" && method === "POST") {
      if ((await digest(body.current || "")) !== user.password)
        fail("Mật khẩu hiện tại không đúng.");
      user.password = await digest(passwordValue(body.password));
      state.userId = null;
      return { message: "Đã đổi mật khẩu demo. Vui lòng đăng nhập lại." };
    }
    if (route === "/saved" && method === "POST") {
      if (!state.words.some((w) => w.id === body.wordId))
        fail("Không tìm thấy từ.", 404);
      const old = state.saved.find(
        (s) => s.user_id === user.id && s.word_id === body.wordId,
      );
      if (body.saved === false)
        state.saved = state.saved.filter((s) => s !== old);
      else if (old) old.difficult = Boolean(body.difficult);
      else
        state.saved.push({
          user_id: user.id,
          word_id: body.wordId,
          difficult: Boolean(body.difficult),
        });
      return { ok: true };
    }
    if (route === "/notifications/read") {
      state.notifications
        .filter((n) => n.user_id === user.id)
        .forEach((n) => {
          n.read = true;
        });
      return { ok: true };
    }
    if (route === "/sessions" && method === "POST") {
      const active = state.sessions.find(
        (s) => s.user_id === user.id && s.status === "active",
      );
      if (active && !body.replace) return sessionView(active, user);
      if (!["new", "review", "practice"].includes(body.mode))
        fail("Chế độ học không hợp lệ.");
      const size = Number(body.size || state.config.sessionSize);
      if (!Number.isInteger(size) || size < 1 || size > 20)
        fail("Chọn từ 1 đến 20 từ mỗi phiên.");
      if (!["choice", "typing", "mixed"].includes(body.type || "mixed"))
        fail("Dạng bài không hợp lệ.");
      const available = availableWords();
      let words = available.filter(
        (w) => !body.setId || w.setIds.includes(body.setId),
      );
      const practiced = new Set(ownAnswers(user).map((a) => a.word_id));
      const progress = state.progress.filter((p) => p.user_id === user.id);
      if (body.mode === "new")
        words = words.filter((w) => !practiced.has(w.id));
      if (body.mode === "review")
        words = words
          .filter((w) =>
            progress.some((p) => p.word_id === w.id && p.due_at <= now()),
          )
          .sort(
            (a, b) =>
              progress
                .find((p) => p.word_id === a.id)
                .due_at.localeCompare(
                  progress.find((p) => p.word_id === b.id).due_at,
                ) || a.id.localeCompare(b.id),
          );
      else words = words.slice().sort(() => Math.random() - 0.5);
      words = words.slice(0, size);
      if (!words.length)
        fail(
          body.mode === "review"
            ? "Bạn chưa có từ đến lịch ôn. Hãy học từ mới hoặc luyện thêm."
            : "Chưa có từ phù hợp. Hãy chọn bộ khác hoặc luyện thêm.",
        );
      if (active) {
        active.status = "abandoned";
        active.completedAt = now();
      }
      const session = {
        id: uid(),
        user_id: user.id,
        mode: body.mode,
        setId: body.setId || null,
        title:
          state.sets.find((s) => s.id === body.setId)?.name ||
          (body.mode === "review" ? "Ôn tập đến hạn" : "Luyện tập tổng hợp"),
        status: "active",
        createdAt: now(),
        completedAt: null,
        config: copy(state.config),
        items: words.map((word, index) => {
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
                    ...available
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
            fail("Chưa đủ lựa chọn hợp lệ.");
          return {
            id: uid(),
            word: copy(word),
            type,
            options,
            correctOption: options.find((o) => o.text === word.meaning)?.id,
          };
        }),
      };
      state.sessions.push(session);
      return { ...sessionView(session, user), requestedSize: size };
    }
    const sessionMatch = /^\/sessions\/([^/]+)$/.exec(route);
    if (sessionMatch && method === "GET")
      return sessionView(
        state.sessions.find((s) => s.id === sessionMatch[1]),
        user,
      );
    const answerMatch = /^\/sessions\/([^/]+)\/items\/([^/]+)\/answer$/.exec(
      route,
    );
    if (answerMatch && method === "POST") {
      const session = state.sessions.find(
        (s) => s.id === answerMatch[1] && s.user_id === user.id,
      );
      const item = session?.items.find((i) => i.id === answerMatch[2]);
      if (!item) fail("Không tìm thấy câu hỏi.", 404);
      const response = required(body.response, "Câu trả lời", 128);
      if (item.answer) {
        if (item.answer.response !== response)
          fail("Câu này đã có kết quả. Vui lòng tải lại phiên học.", 409);
        return sessionView(session, user);
      }
      if (session.status !== "active") fail("Phiên học đã kết thúc.", 409);
      if (
        item.type === "choice" &&
        !item.options.some((o) => o.id === response)
      )
        fail("Lựa chọn không thuộc câu hỏi này.");
      const correct =
        item.type === "choice"
          ? response === item.correctOption
          : item.word.accepted.some(
              (a) => normalize(a) === normalize(response),
            );
      let progress = state.progress.find(
        (p) => p.user_id === user.id && p.word_id === item.word.id,
      );
      const updatesSchedule =
        (session.mode === "new" && !progress) ||
        Boolean(
          session.mode === "review" && progress && progress.due_at <= now(),
        );
      if (updatesSchedule) {
        const next = schedule(progress, correct, clock(), session.config);
        if (!progress) {
          progress = {
            user_id: user.id,
            word_id: item.word.id,
            correct: 0,
            total: 0,
          };
          state.progress.push(progress);
        }
        progress.stage = next.stage;
        progress.due_at = next.dueAt;
      }
      if (progress) {
        progress.correct += correct ? 1 : 0;
        progress.total++;
        progress.last_at = now();
      }
      item.answer = {
        response,
        correct,
        acceptedAt: now(),
        day: profile.day,
        timezone: profile.timezone,
        word: publicWord(copy(item.word)),
        correctAnswer:
          item.type === "choice" ? item.word.meaning : item.word.accepted[0],
        explanation: item.word.explanation,
        nextDueAt: progress?.due_at || null,
        updatesSchedule,
      };
      if (session.items.every((i) => i.answer)) {
        session.status = "completed";
        session.completedAt = now();
      }
      return sessionView(session, user);
    }
    if (!route.startsWith("/admin/"))
      fail("Không tìm thấy chức năng demo.", 404);
    if (user.role !== "admin")
      fail("Bạn chưa có quyền thực hiện thao tác này.", 403);
    if (route === "/admin/data")
      return {
        users: state.users.map(({ password, profile, ...u }) => u),
        topics: state.topics,
        sets: state.sets,
        words: state.words,
        audit: state.audit.slice(0, 200),
        config: state.config,
        report: report(),
      };
    if (route === "/admin/users" && method === "PATCH") {
      const target = state.users.find((u) => u.id === body.id);
      if (!target) fail("Không tìm thấy tài khoản.", 404);
      if (
        !["admin", "learner"].includes(body.role) ||
        !["active", "locked", "pending"].includes(body.status)
      )
        fail("Vai trò hoặc trạng thái không hợp lệ.");
      if (
        target.role === "admin" &&
        target.status === "active" &&
        (body.role !== "admin" || body.status !== "active") &&
        state.users.filter((u) => u.role === "admin" && u.status === "active")
          .length <= 1
      )
        fail("Cần có ít nhất một tài khoản quản trị đang hoạt động.");
      if (target.status === "pending" && body.status === "active")
        fail("Tài khoản cần xác minh email trước khi kích hoạt.");
      const before = { role: target.role, status: target.status };
      target.role = body.role;
      target.status = body.status;
      if (target.id === state.userId) state.userId = null;
      audit(user, "user.update", target.id, {
        before,
        after: { role: target.role, status: target.status },
      });
      return { ok: true };
    }
    if (["/admin/topics", "/admin/sets"].includes(route) && method === "POST") {
      const entity = route.endsWith("topics") ? "topics" : "sets";
      const old = state[entity].find((x) => x.id === body.id);
      if (body.id && !old) fail("Không tìm thấy nội dung.", 404);
      const value = {
        ...old,
        ...body,
        id: body.id || uid(),
        code: required(body.code, "Mã", 40).toUpperCase(),
        name: required(body.name, "Tên", 100),
        description: required(body.description, "Mô tả"),
        color: body.color || old?.color || "green",
        icon: body.icon || old?.icon || "book",
      };
      if (!["draft", "published", "archived"].includes(value.status))
        fail("Trạng thái không hợp lệ.");
      if (state[entity].some((x) => x.id !== value.id && x.code === value.code))
        fail("Mã nội dung đã tồn tại.");
      if (entity === "sets") {
        if (!state.topics.some((t) => t.id === body.topicId))
          fail("Chủ đề không hợp lệ.");
        if (!["A1", "A2", "B1", "B2", "C1", "C2"].includes(body.level))
          fail("Trình độ không hợp lệ.");
        if (
          body.status === "published" &&
          !state.words.some(
            (w) => w.setIds.includes(value.id) && w.status === "published",
          )
        )
          fail("Bộ từ cần ít nhất một từ xuất bản trước khi xuất bản bộ.");
      }
      if (old) state[entity][state[entity].indexOf(old)] = value;
      else state[entity].push(value);
      audit(user, `${entity}.save`, value.id, { before: old, after: value });
      return { ok: true, data: value };
    }
    if (route === "/admin/words" && method === "POST") {
      const word = validateWord(body, body.id);
      const index = state.words.findIndex((w) => w.id === word.id);
      if (index >= 0) state.words[index] = word;
      else state.words.push(word);
      audit(user, "word.save", word.id, {
        version: word.version,
        status: word.status,
      });
      return { ok: true, word };
    }
    if (route === "/admin/config" && method === "POST") {
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
          "Cấu hình không hợp lệ. Cần 5 khoảng ôn tăng dần, phiên từ 1–20 từ.",
        );
      state.config = {
        id: uid(),
        intervals: body.intervals,
        retryMinutes: body.retryMinutes,
        sessionSize: body.sessionSize,
      };
      audit(user, "config.save", state.config.id, state.config);
      return { ok: true };
    }
    if (route === "/admin/report")
      return report(Object.fromEntries(url.searchParams));
    if (route === "/admin/import/preview" && method === "POST") {
      if (
        !["create", "update"].includes(body.mode) ||
        !String(body.filename || "")
          .toLowerCase()
          .endsWith(".xlsx")
      )
        fail("Chọn tệp .xlsx và chế độ nhập hợp lệ.");
      const bytes = Uint8Array.from(atob(body.file || ""), (c) =>
        c.charCodeAt(0),
      );
      if (
        bytes.length > 5 * 1024 * 1024 ||
        bytes[0] !== 0x50 ||
        bytes[1] !== 0x4b
      )
        fail("Tệp phải là .xlsx hợp lệ và không quá 5 MB.");
      const { default: ExcelJS } = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      try {
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
        fail(`Thiếu cột bắt buộc: ${mandatory.join(", ")}.`);
      const rows = [];
      const errors = [];
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
          const set = state.sets.find(
            (s) => s.code === row.setCode.toUpperCase(),
          );
          if (!set) fail("Mã bộ từ không tồn tại.");
          const code = row.code.toUpperCase();
          if (codes.has(code)) fail("Mã từ trùng trong tệp.");
          codes.add(code);
          const existing = state.words.find((w) => w.code === code);
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
          rows.push({
            ...word,
            row: index,
            previousVersion: existing?.version || 0,
          });
        } catch (error) {
          errors.push({ row: index, message: error.message });
        }
      }
      if (!rows.length && !errors.length) fail("Tệp không có dữ liệu.");
      const id = errors.length ? null : uid();
      if (id)
        state.imports.push({ id, user_id: user.id, rows, committed: false });
      return { id, rows, errors, total: rows.length + errors.length };
    }
    if (route === "/admin/import/commit" && method === "POST") {
      const batch = state.imports.find(
        (b) => b.id === body.id && b.user_id === user.id,
      );
      if (!batch) fail("Không tìm thấy lô nhập.", 404);
      if (!batch.committed) {
        for (const word of batch.rows) {
          const old = state.words.find((w) => w.id === word.id);
          if ((old?.version || 0) !== word.previousVersion)
            fail(
              "Nội dung đã thay đổi sau kiểm tra. Vui lòng kiểm tra lại.",
              409,
            );
          const verified = { ...validateWord(word, old?.id), id: word.id };
          if (old) state.words[state.words.indexOf(old)] = verified;
          else state.words.push(verified);
        }
        batch.committed = true;
        audit(user, "import.commit", batch.id, { count: batch.rows.length });
      }
      return { message: "Đã nhập toàn bộ dữ liệu demo ở trạng thái nháp." };
    }
    fail("Không tìm thấy chức năng demo.", 404);
  }
  async function execute(path, body, method) {
    state = await load();
    const original = copy(state);
    try {
      const result = await dispatch(path, body || {}, method);
      storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
      return copy(result);
    } catch (error) {
      state = original;
      if (error.name === "QuotaExceededError")
        fail(
          "Bộ nhớ phiên demo đã đầy. Hãy mở một phiên trình duyệt mới để thử lại.",
        );
      throw error;
    }
  }
  function request(path, body, method = body === undefined ? "GET" : "POST") {
    const result = queue.then(() => execute(path, body, method));
    queue = result.catch(() => {});
    return result;
  }
  async function exportFile(path) {
    return queue.then(async () => {
      state = await load();
      const user = currentUser();
      const url = new URL(path, "https://demo.techcamp.local");
      const filters = Object.fromEntries(url.searchParams);
      let rows;
      let filename;
      if (url.pathname === "/history/export") {
        if (filters.from && filters.to && filters.from > filters.to)
          fail("Ngày bắt đầu phải trước ngày kết thúc.");
        const profile = profileFor(user);
        rows = ownAnswers(user)
          .filter((a) => {
            const day = localDay(a.session.createdAt, profile.timezone);
            return (
              (!filters.from || day >= filters.from) &&
              (!filters.to || day <= filters.to) &&
              (!filters.mode || a.mode === filters.mode) &&
              (!filters.status || a.session.status === filters.status)
            );
          })
          .map((a) => ({
            "Thời gian UTC": a.acceptedAt,
            "Ngày học": a.day,
            "Múi giờ": a.timezone,
            "Chế độ": a.mode,
            Từ: a.word.word,
            "Phiên bản": a.word.version,
            "Kết quả": a.correct ? "Đúng" : "Sai",
          }));
        filename = "techcamp-lich-su.xlsx";
      } else {
        if (user.role !== "admin")
          fail("Bạn chưa có quyền thực hiện thao tác này.", 403);
        if (url.pathname === "/admin/import/template") {
          rows = [
            {
              code: "NEW-WORD-01",
              word: "example",
              pos: "danh từ",
              sense: "01",
              ipa: "/ɪɡˈzɑːmpl/",
              meaning: "ví dụ",
              example: "This is an example.",
              translation: "Đây là một ví dụ.",
              setCode: state.sets[0].code,
              source: "Nội dung do tôi biên soạn",
              accepted: "example",
            },
          ];
          filename = "techcamp-mau-nhap.xlsx";
        } else if (url.pathname === "/admin/report/export") {
          rows = report(filters).words.map((w) => ({
            Từ: w.word,
            Nghĩa: w.meaning,
            "Phiên bản": w.version,
            "Số câu": w.total,
            "Số sai": w.wrong,
            "Tỷ lệ sai (%)": w.errorRate,
            "Đủ mẫu xếp hạng": w.total >= 10 ? "Có" : "Chưa đủ 10 câu",
          }));
          filename = "techcamp-bao-cao.xlsx";
        } else fail("Không tìm thấy tệp.", 404);
      }
      const { default: ExcelJS } = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Techcamp Demo";
      const sheet = workbook.addWorksheet("Techcamp");
      if (rows.length) {
        const headers = Object.keys(rows[0]);
        sheet.addRow(headers);
        rows.forEach((row) =>
          sheet.addRow(headers.map((key) => row[key] ?? "")),
        );
        sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
        sheet.getRow(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF237552" },
        };
        sheet.columns.forEach((c) => {
          c.width = 26;
        });
        sheet.views = [{ state: "frozen", ySplit: 1 }];
      } else sheet.addRow(["Chưa có dữ liệu phù hợp với bộ lọc."]);
      const info = workbook.addWorksheet("Thông tin");
      info.addRow(["Chế độ", "Demo — dữ liệu chỉ trong phiên trình duyệt"]);
      info.addRow(["Bộ lọc", JSON.stringify(filters)]);
      info.addRow(["Thời điểm xuất UTC", now()]);
      info.getColumn(1).width = 25;
      info.getColumn(2).width = 65;
      return { buffer: await workbook.xlsx.writeBuffer(), filename };
    });
  }
  return { request, exportFile };
}
let runtime;
export function demoRuntime() {
  if (!runtime) {
    let storage;
    try {
      storage = window.sessionStorage;
      storage.getItem(DEMO_STORAGE_KEY);
    } catch {
      const memory = new Map();
      storage = {
        getItem: (key) => memory.get(key) || null,
        setItem: (key, value) => memory.set(key, value),
      };
    }
    runtime = createDemoRuntime(storage);
  }
  return runtime;
}

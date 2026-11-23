import { useState } from "react";
import { api, useApp, Button, Field, go, LearningArt, Modal } from "../lib";
import { Brand } from "../App";
import Icon from "../components/Icon";

export default function Auth({ route, onLogin }) {
  const { notify, localMode } = useApp();
  const raw = route.split("?")[0];
  const page = ["register", "forgot", "reset", "activate"].includes(raw)
    ? raw
    : "login";
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirm: "",
    name: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [inbox, setInbox] = useState(null);
  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const changePage = (next) => {
    setError("");
    setMessage("");
    go(next);
  };
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (
        ["register", "reset"].includes(page) &&
        form.password !== form.confirm
      )
        throw new Error("Hai mật khẩu chưa khớp nhau.");
      if (page === "login") {
        const result = await api("/auth/login", {
          email: form.email,
          password: form.password,
        });
        await onLogin(result.user);
      } else {
        const token = new URLSearchParams(route.split("?")[1]).get("token");
        const result = await api(`/auth/${page}`, { ...form, token });
        setMessage(result.message);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const openInbox = async () => {
    try {
      setInbox((await api("/dev/mail")).messages);
    } catch (e) {
      notify(e.message, "error");
    }
  };
  const title = {
    login: "Chào mừng bạn trở lại",
    register: "Bắt đầu hành trình của bạn",
    forgot: "Bạn quên mật khẩu?",
    reset: "Tạo mật khẩu mới",
    activate: "Xác nhận tài khoản",
  }[page];
  return (
    <div className="auth-layout">
      <section className="auth-form-side">
        <a href="#login" className="brand-link">
          <Brand />
        </a>
        <div className="auth-content" key={page}>
          <span className="eyebrow">MỖI TỪ MỚI, MỘT BƯỚC TIẾN</span>
          <h1>
            {title}
            <span className="green-text">.</span>
          </h1>
          <p>
            {page === "login"
              ? "Tiếp tục xây dựng vốn từ vựng, từng ngày một."
              : page === "register"
                ? "Tạo tài khoản để lưu tiến độ và học theo cách của bạn."
                : "Chúng tôi sẽ giúp bạn tiếp tục hành trình học tập."}
          </p>
          <form onSubmit={submit} className="auth-form">
            {page === "register" && (
              <Field label="Tên của bạn">
                <input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={80}
                  placeholder="Nhập tên hiển thị"
                  value={form.name}
                  onChange={update}
                />
              </Field>
            )}
            {!["reset", "activate"].includes(page) && (
              <Field label="Địa chỉ email">
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  placeholder="ban@example.com"
                  value={form.email}
                  onChange={update}
                />
              </Field>
            )}
            {["login", "register", "reset"].includes(page) && (
              <Field
                label="Mật khẩu"
                hint={page !== "login" ? "Từ 12 đến 128 ký tự." : undefined}
              >
                <div className="password-input">
                  <input
                    type={visible ? "text" : "password"}
                    name="password"
                    autoComplete={
                      page === "login" ? "current-password" : "new-password"
                    }
                    minLength={page === "login" ? undefined : 12}
                    maxLength={128}
                    required
                    placeholder="Nhập mật khẩu của bạn"
                    value={form.password}
                    onChange={update}
                  />
                  <button
                    type="button"
                    onClick={() => setVisible(!visible)}
                    aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {visible ? "Ẩn" : "Hiện"}
                  </button>
                </div>
              </Field>
            )}
            {["register", "reset"].includes(page) && (
              <Field label="Nhập lại mật khẩu">
                <input
                  type="password"
                  name="confirm"
                  autoComplete="new-password"
                  minLength={12}
                  required
                  placeholder="Xác nhận mật khẩu"
                  value={form.confirm}
                  onChange={update}
                />
              </Field>
            )}
            {page === "login" && (
              <button
                type="button"
                className="text-link forgot-link"
                onClick={() => changePage("forgot")}
              >
                Quên mật khẩu?
              </button>
            )}
            {page === "register" && (
              <p className="privacy-note">
                <Icon name="shield" size={16} />
                Thông tin tài khoản được dùng để lưu tiến độ và hỗ trợ việc học
                của bạn.
              </p>
            )}
            {error && (
              <div role="alert" className="form-alert error">
                <Icon name="info" size={18} />
                {error}
              </div>
            )}
            {message && (
              <div role="status" className="form-alert success">
                <Icon name="check" size={18} />
                {message}
              </div>
            )}
            <Button type="submit" busy={busy} className="full-width">
              {
                {
                  login: "Đăng nhập",
                  register: "Tạo tài khoản",
                  forgot: "Gửi liên kết khôi phục",
                  reset: "Lưu mật khẩu mới",
                  activate: "Kích hoạt tài khoản",
                }[page]
              }
            </Button>
          </form>
          <p className="auth-switch">
            {page === "login"
              ? "Bạn chưa có tài khoản?"
              : "Bạn đã có tài khoản?"}{" "}
            <button
              className="text-link"
              onClick={() =>
                changePage(page === "login" ? "register" : "login")
              }
            >
              {page === "login" ? "Đăng ký miễn phí" : "Đăng nhập"}
            </button>
          </p>
          {message && page === "register" && (
            <button
              className="text-link"
              onClick={async () => {
                try {
                  notify(
                    (await api("/auth/resend", { email: form.email })).message,
                  );
                } catch (e) {
                  notify(e.message, "error");
                }
              }}
            >
              Gửi lại liên kết kích hoạt
            </button>
          )}
          {localMode && (
            <div className="demo-panel">
              <span className="demo-label">
                <Icon name="code" size={15} />
                Không gian thử nghiệm trên máy
              </span>
              {page === "login" && (
                <>
                  <p>Chọn tài khoản mẫu để khám phá các chức năng.</p>
                  <div className="demo-actions">
                    <button
                      onClick={() =>
                        setForm({
                          ...form,
                          email: "learner@techcamp.local",
                          password: "Techcamp@2026",
                        })
                      }
                    >
                      <Icon name="user" size={16} /> Người học
                    </button>
                    <button
                      onClick={() =>
                        setForm({
                          ...form,
                          email: "admin@techcamp.local",
                          password: "Techcamp@2026",
                        })
                      }
                    >
                      <Icon name="shield" size={16} /> Quản trị viên
                    </button>
                  </div>
                </>
              )}
              <button className="inbox-link" onClick={openInbox}>
                <Icon name="mail" size={16} /> Mở hộp thư thử nghiệm
              </button>
            </div>
          )}
        </div>
        <div className="auth-footer">
          Học theo nhịp của bạn. Tiến bộ theo cách của bạn.
        </div>
      </section>
      <aside className="auth-art-side">
        <span className="auth-art-tag">
          <Icon name="leaf" size={17} /> Gieo một từ, mở một thế giới
        </span>
        <LearningArt />
        <h2>
          Những điều lớn lao
          <br />
          bắt đầu từ <em>một từ nhỏ.</em>
        </h2>
        <p>
          Học từ theo chủ đề, ôn tập đúng lúc và nhìn thấy
          <br />
          bản thân tiến bộ mỗi ngày cùng Techcamp.
        </p>
        <div className="auth-features">
          <span>
            <Icon name="check" size={16} /> Học theo chủ đề
          </span>
          <span>
            <Icon name="check" size={16} /> Ôn tập cách quãng
          </span>
          <span>
            <Icon name="check" size={16} /> Theo dõi tiến độ
          </span>
        </div>
        <div className="auth-bottom">
          <span className="leaf-dot">✦</span> A little progress, every single
          day.
        </div>
      </aside>
      {inbox && (
        <Modal
          title="Hộp thư thử nghiệm"
          subtitle="Chỉ có ở chế độ phát triển trên máy. Liên kết thật sẽ gửi qua SMTP khi cấu hình production."
          onClose={() => setInbox(null)}
        >
          {inbox.length ? (
            inbox.map((m) => (
              <div className="mail-item" key={m.id}>
                <small>Đến: {m.recipient}</small>
                <h3>{m.subject}</h3>
                <a
                  href={m.link}
                  onClick={() => {
                    setInbox(null);
                    setMessage("");
                    setError("");
                  }}
                >
                  Mở liên kết
                </a>
              </div>
            ))
          ) : (
            <p className="muted">
              Chưa có thư. Hãy đăng ký hoặc yêu cầu khôi phục mật khẩu.
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}

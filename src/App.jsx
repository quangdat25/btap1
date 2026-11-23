import { useCallback, useEffect, useState } from "react";
import { api, Context, go, IconButton, Button, Empty } from "./lib";
import Icon from "./components/Icon";
import Auth from "./pages/Auth";
import {
  Dashboard,
  Library,
  SetPage,
  Saved,
  Review,
  History,
  Profile,
} from "./pages/Learner";
import { Flashcards, Session } from "./pages/Learning";
import Admin from "./pages/Admin";
import "./App.css";
import "./readability.css";

const navigation = [
  ["dashboard", "Tổng quan", "home"],
  ["library", "Khám phá bộ từ", "book"],
  ["review", "Ôn tập", "review"],
  ["saved", "Từ của tôi", "bookmark"],
  ["history", "Tiến độ học tập", "chart"],
];
export default function App() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [route, setRoute] = useState(
    window.location.hash.slice(1) || "dashboard",
  );
  const [toast, setToast] = useState(null);
  const [mobile, setMobile] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [localMode, setLocalMode] = useState(false);
  const notify = useCallback(
    (message, type = "success") => setToast({ message, type, id: Date.now() }),
    [],
  );
  const refresh = useCallback(async () => {
    try {
      const next = await api("/app");
      setData(next);
      setUser(next.user);
      return next;
    } catch (error) {
      if (error.status === 401) {
        setData(null);
        setUser(null);
        go("login");
      }
      throw error;
    }
  }, []);
  const bootstrap = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const auth = await api("/auth/me");
      setLocalMode(auth.localMode);
      setUser(auth.user);
      if (auth.user) await refresh();
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, [refresh]);
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);
  useEffect(() => {
    const handler = () => {
      setRoute(window.location.hash.slice(1) || "dashboard");
      setMobile(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(
      () =>
        refresh().catch((e) => {
          if (e.status === 401) {
            setUser(null);
            setData(null);
            notify(e.message, "error");
          }
        }),
      60000,
    );
    return () => clearInterval(timer);
  }, [user?.id, refresh, notify]);
  const logout = async () => {
    try {
      await api("/auth/logout", {});
      setUser(null);
      setData(null);
      go("login");
    } catch (e) {
      notify(e.message, "error");
    }
  };
  const login = async (next) => {
    setUser(next);
    setLoading(true);
    try {
      await refresh();
      go(next.role === "admin" ? "admin" : "dashboard");
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  };
  const [page, id] = route.split("?")[0].split("/");
  const context = { user, data, refresh, notify, localMode, logout };
  let content;
  if (page === "dashboard") content = <Dashboard />;
  else if (page === "library") content = <Library />;
  else if (page === "set") content = <SetPage id={id} />;
  else if (page === "flashcards") content = <Flashcards key={id} id={id} />;
  else if (page === "session") content = <Session key={id} id={id} />;
  else if (page === "saved") content = <Saved />;
  else if (page === "review") content = <Review />;
  else if (page === "history") content = <History />;
  else if (page === "profile") content = <Profile />;
  else if (page === "admin" && user?.role === "admin") content = <Admin />;
  else
    content = (
      <Empty
        title="Trang này không khả dụng"
        description="Quay về tổng quan để tiếp tục học."
      >
        <Button onClick={() => go("dashboard")}>Về tổng quan</Button>
      </Empty>
    );
  return (
    <Context.Provider value={context}>
      {loading ? (
        <div className="app-loading">
          <Brand />
          <span className="spinner" />
          <p>Đang chuẩn bị không gian học của bạn…</p>
        </div>
      ) : loadError ? (
        <div className="app-loading">
          <Empty
            icon="info"
            title="Chưa kết nối được Techcamp"
            description={loadError}
          >
            <Button onClick={bootstrap}>Thử lại</Button>
          </Empty>
        </div>
      ) : !user || ["activate", "reset"].includes(page) ? (
        <Auth route={route} onLogin={login} />
      ) : (
        data && (
          <div className="app-shell">
            {mobile && (
              <button
                className="sidebar-overlay"
                onClick={() => setMobile(false)}
                aria-label="Đóng menu"
              />
            )}
            <aside className={`sidebar ${mobile ? "open" : ""}`}>
              <a className="brand-link" href="#dashboard">
                <Brand />
              </a>
              <div className="sidebar-label">KHÔNG GIAN HỌC TẬP</div>
              <nav aria-label="Điều hướng chính">
                {navigation.map(([key, label, icon]) => (
                  <a
                    key={key}
                    href={`#${key}`}
                    className={
                      page === key ||
                      (key === "library" &&
                        ["set", "flashcards", "session"].includes(page))
                        ? "active"
                        : ""
                    }
                  >
                    <Icon name={icon} />
                    <span>{label}</span>
                    {key === "review" && data.stats.due > 0 && (
                      <span className="nav-count">{data.stats.due}</span>
                    )}
                  </a>
                ))}
                {user.role === "admin" && (
                  <>
                    <div className="nav-divider" />
                    <a
                      href="#admin"
                      className={page === "admin" ? "active" : ""}
                    >
                      <Icon name="shield" />
                      <span>Quản trị hệ thống</span>
                    </a>
                  </>
                )}
              </nav>
              <div className="sidebar-bottom">
                <div className="sidebar-note">
                  <span className="mini-spark">
                    <Icon name="spark" />
                  </span>
                  <strong>
                    Mỗi ngày một chút,
                    <br />
                    tiến bộ thật nhiều.
                  </strong>
                  <p>Dành vài phút cho phiên học tiếp theo của bạn.</p>
                  <button onClick={() => go("library")}>
                    Khám phá bộ từ <Icon name="book" size={16} />
                  </button>
                </div>
                <a
                  href="#profile"
                  className={`settings-link ${page === "profile" ? "active" : ""}`}
                >
                  <Icon name="settings" />
                  <span>Cài đặt tài khoản</span>
                </a>
                <div className="sidebar-profile">
                  <button
                    className="profile-link"
                    onClick={() => go("profile")}
                  >
                    <span className="avatar">
                      {user.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span>
                      <strong>{user.name}</strong>
                      <small>
                        {user.role === "admin" ? "Quản trị viên" : "Người học"}
                      </small>
                    </span>
                  </button>
                  <IconButton
                    icon="logout"
                    title="Đăng xuất"
                    onClick={logout}
                  />
                </div>
              </div>
            </aside>
            <div className="main-wrap">
              <header className="topbar">
                <div className="topbar-title">
                  <span className="mobile-menu">
                    <IconButton
                      icon="menu"
                      title="Mở menu"
                      onClick={() => setMobile(true)}
                    />
                  </span>
                  <span>Học một từ mới. Mở thêm một cơ hội.</span>
                </div>
                <div className="topbar-right">
                  <span className="streak-pill">
                    <Icon name="flame" size={17} /> {data.stats.streak} ngày
                    liên tiếp
                  </span>
                  <div className="notification-wrap">
                    <button
                      className="icon-btn"
                      onClick={async () => {
                        setNotifications(!notifications);
                        if (!notifications) {
                          try {
                            await api("/notifications/read", {});
                            await refresh();
                          } catch (e) {
                            notify(e.message, "error");
                          }
                        }
                      }}
                      aria-label="Thông báo"
                      aria-expanded={notifications}
                    >
                      <Icon name="bell" />
                      {data.notifications.some((n) => !n.read) && (
                        <span className="unread-dot" />
                      )}
                    </button>
                    {notifications && (
                      <div className="notification-panel">
                        <h3>Thông báo của bạn</h3>
                        {data.notifications.length ? (
                          data.notifications.map((n) => (
                            <div key={n.id}>
                              <p>{n.message}</p>
                              <small>
                                {n.day.split("-").reverse().join("/")}
                              </small>
                            </div>
                          ))
                        ) : (
                          <p>
                            Chưa có thông báo. Bạn có thể bật nhắc học trong cài
                            đặt.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    className="avatar top-avatar"
                    aria-label="Hồ sơ của tôi"
                    onClick={() => go("profile")}
                  >
                    {user.name.slice(0, 1).toUpperCase()}
                  </button>
                </div>
              </header>
              <main
                className={`main-content ${page === "session" ? "session-main" : ""}`}
              >
                {content}
              </main>
              <footer className="footer">
                <span>© {new Date().getFullYear()} Techcamp</span>
                <span>Learn a little. Grow every day.</span>
              </footer>
            </div>
          </div>
        )
      )}
      {toast && (
        <div
          key={toast.id}
          className={`toast ${toast.type}`}
          role={toast.type === "error" ? "alert" : "status"}
        >
          <Icon name={toast.type === "error" ? "info" : "check"} />
          <span>{toast.message}</span>
          <IconButton
            icon="close"
            title="Đóng thông báo"
            onClick={() => setToast(null)}
          />
        </div>
      )}
    </Context.Provider>
  );
}
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path d="M7 7h18v5h-7v14h-5V12H7Z" fill="currentColor" />
          <path d="m22 19 5-5v11h-5Z" fill="#bedc8a" />
        </svg>
      </span>
      <span>
        techcamp<span className="brand-dot">.</span>
      </span>
    </span>
  );
}

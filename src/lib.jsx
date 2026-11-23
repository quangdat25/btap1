import { createContext, useContext, useEffect, useRef, useState } from "react";
import Icon from "./components/Icon";
export const Context = createContext(null);
export const useApp = () => useContext(Context);
export async function api(
  path,
  body,
  method = body === undefined ? "GET" : "POST",
) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      ...(body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
  } catch {
    throw new Error(
      "Không kết nối được máy chủ. Dữ liệu đã nhập được giữ lại, bạn có thể thử lại.",
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      data.message || "Không thể xử lý yêu cầu. Vui lòng thử lại.",
    );
    error.status = response.status;
    throw error;
  }
  return data;
}
export async function download(path) {
  const response = await fetch(`/api${path}`, { credentials: "same-origin" });
  if (!response.ok)
    throw new Error((await response.json()).message || "Không tải được tệp.");
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download =
    /filename="([^"]+)"/.exec(
      response.headers.get("content-disposition") || "",
    )?.[1] || "techcamp.xlsx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const go = (path) => {
  window.location.hash = path;
};
export const date = (value, timezone = "Asia/Ho_Chi_Minh", time = false) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        timeZone: timezone,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
      }).format(new Date(value))
    : "—";
export const modeNames = {
  new: "Học từ mới",
  review: "Ôn đến hạn",
  practice: "Luyện thêm",
};
export const statusNames = {
  draft: "Bản nháp",
  published: "Đã xuất bản",
  archived: "Đã lưu trữ",
  active: "Đang hoạt động",
  locked: "Đã khóa",
  pending: "Chờ xác minh",
  completed: "Hoàn thành",
  abandoned: "Đã dừng",
};
export function Button({
  children,
  icon,
  variant = "primary",
  className = "",
  busy,
  disabled,
  ...props
}) {
  return (
    <button
      className={`btn ${variant} ${className}`}
      disabled={disabled || busy}
      {...props}
    >
      {busy ? (
        <span className="spinner small" />
      ) : (
        icon && <Icon name={icon} size={18} />
      )}
      {children}
    </button>
  );
}
export function IconButton({ icon, title, ...props }) {
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={title}
      title={title}
      {...props}
    >
      <Icon name={icon} />
    </button>
  );
}
export function Empty({
  icon = "book",
  title = "Chưa có dữ liệu",
  description,
  children,
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={30} />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}
export function Badge({ children, color = "" }) {
  return <span className={`badge ${color}`}>{children}</span>;
}
export function Progress({ value, max = 100, className = "" }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={`progress ${className}`}
    >
      <span
        style={{ width: `${Math.min(100, max ? (value / max) * 100 : 0)}%` }}
      />
    </div>
  );
}
export function Field({ label, error, children, hint, className = "" }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}
export function Modal({ title, subtitle, children, onClose, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handle = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const elements = [
          ...ref.current.querySelectorAll(
            "button,input,select,textarea,a[href]",
          ),
        ].filter((x) => !x.disabled && x.offsetParent);
        const first = elements[0];
        const last = elements.at(-1);
        if (!first) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <IconButton icon="close" title="Đóng" onClick={onClose} />
        </div>
        {children}
      </section>
    </div>
  );
}
export function PageHeading({ eyebrow, title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}
export function WordAudio({ word, audio, className = "" }) {
  const { notify } = useApp();
  const [playing, setPlaying] = useState(false);
  const play = () => {
    if (audio) {
      const sound = new Audio(audio);
      setPlaying(true);
      sound.onended = () => setPlaying(false);
      sound.onerror = () => {
        setPlaying(false);
        notify(
          "Chưa phát được âm thanh. Bạn vẫn có thể xem nghĩa và ví dụ.",
          "error",
        );
      };
      sound.play().catch(() => {
        setPlaying(false);
        notify("Chưa phát được âm thanh. Hãy thử lại.", "error");
      });
      return;
    }
    if (!window.speechSynthesis) {
      notify(
        "Trình duyệt chưa hỗ trợ phát âm. Bạn vẫn có thể xem phiên âm và ví dụ.",
        "error",
      );
      return;
    }
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(word);
    speech.lang = "en-US";
    speech.rate = 0.85;
    setPlaying(true);
    speech.onend = () => setPlaying(false);
    speech.onerror = () => {
      setPlaying(false);
      notify("Chưa phát được âm thanh. Vui lòng thử lại.", "error");
    };
    window.speechSynthesis.speak(speech);
  };
  return (
    <button
      type="button"
      className={`audio-btn ${playing ? "playing" : ""} ${className}`}
      aria-label={`Nghe phát âm ${word}`}
      onClick={play}
    >
      <Icon name="sound" size={20} />
    </button>
  );
}
export function LearningArt({ small = false }) {
  return (
    <svg
      className={`learning-art ${small ? "small-art" : ""}`}
      viewBox="0 0 320 240"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="177" cy="112" r="90" fill="#d5e9b8" />
      <circle
        cx="177"
        cy="112"
        r="68"
        stroke="#8db47a"
        strokeWidth="1.5"
        strokeDasharray="4 7"
      />
      <path d="M74 183 207 171l59 24-131 19Z" fill="#b6d392" />
      <path d="m85 157 115-14 51 25-116 15Z" fill="#588a63" />
      <path d="m85 157 50 26v23l-50-25Z" fill="#276545" />
      <path d="m135 183 116-15v21l-116 17Z" fill="#fff7df" />
      <path d="m138 190 110-14m-110 21 110-14" stroke="#dfddc9" />
      <path d="m101 139 98-11 47 24-98 12Z" fill="#f4c963" />
      <path d="m101 139 47 25v14l-47-24Z" fill="#dda743" />
      <path d="m148 164 98-12v13l-98 13Z" fill="#fffbef" />
      <path
        d="M153 68c28-23 61-11 61 16 0 20-16 31-27 40l-20 2c-4-18-29-38-14-58Z"
        fill="#fdfdf5"
        stroke="#39754d"
        strokeWidth="2"
      />
      <path d="M168 124 186 122l-1 14-14 2Z" fill="#5b8460" />
      <path d="m173 139 9-1-3 5Z" fill="#2d6042" />
      <path
        d="m175 121-5-31m7 29 10-33m-17 3c-12-10-16 8 0 1m17-3c14-12 15 7 0 0"
        stroke="#b79b48"
        strokeWidth="2"
      />
      <path
        d="M72 92V60m-16 16h32M240 75v-20m-10 10h20M233 126v-14m-7 7h14"
        stroke="#7eaa6e"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="102" cy="112" r="5" fill="#f3c658" />
      <circle cx="245" cy="96" r="3" fill="#4f8458" />
      <path d="M263 200c-10-21-12-36-2-47 17 13 13 28 2 47Z" fill="#6c9d69" />
      <path d="M262 201c-24-9-31-21-27-30 18 0 28 11 27 30Z" fill="#8cb480" />
      <path d="M257 204h16l-3 17h-10Z" fill="#d1a677" />
      <path
        d="m58 161 15-8m-13 25 17-6"
        stroke="#96b17e"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

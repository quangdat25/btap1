import { useEffect, useState } from "react";
import {
  api,
  useApp,
  Button,
  Badge,
  Empty,
  Field,
  Modal,
  PageHeading,
  Progress,
  date,
  download,
  statusNames,
} from "../lib";
import Icon from "../components/Icon";

const tabs = [
  ["overview", "Tổng quan", "chart"],
  ["words", "Từ & câu hỏi", "book"],
  ["sets", "Bộ từ", "layers"],
  ["topics", "Chủ đề", "globe"],
  ["users", "Tài khoản", "user"],
  ["import", "Nhập Excel", "upload"],
  ["reports", "Báo cáo", "chart"],
  ["settings", "Cấu hình", "settings"],
  ["audit", "Nhật ký", "shield"],
];
export default function Admin() {
  const { notify, refresh, user } = useApp();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("overview");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [actionUser, setActionUser] = useState(null);
  const load = async () => {
    try {
      setData(await api("/admin/data"));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const updated = async () => {
    await load();
    await refresh();
  };
  if (!data)
    return error ? (
      <Empty title="Chưa tải được khu vực quản trị" description={error}>
        <Button onClick={load}>Thử lại</Button>
      </Empty>
    ) : (
      <div className="loading-section">
        <span className="spinner" />
        Đang tải dữ liệu quản trị…
      </div>
    );
  const changeTab = (next) => {
    setTab(next);
    setQuery("");
    setStatus("");
    setPage(1);
  };
  const entities = ["words", "sets", "topics"].includes(tab);
  const rows = (
    entities ? data[tab] : tab === "users" ? data.users : []
  ).filter(
    (x) =>
      (!query ||
        `${x.word || x.name} ${x.code || x.email} ${x.meaning || ""}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!status || x.status === status),
  );
  return (
    <>
      <PageHeading
        eyebrow="KHÔNG GIAN QUẢN TRỊ"
        title="Cùng xây dựng một nơi học tốt hơn"
        description="Quản lý nội dung, chăm sóc người học và theo dõi hoạt động."
      />
      <div className="admin-tabs" role="tablist">
        {tabs.map(([id, label, icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => changeTab(id)}
          >
            <Icon name={icon} size={17} />
            {label}
          </button>
        ))}
      </div>
      {error && (
        <div className="form-alert error" role="alert">
          {error}
        </div>
      )}
      {tab === "overview" && (
        <>
          <div className="stats-grid admin-stats">
            {[
              ["user", data.report.learners, "Tài khoản người học", "blue"],
              ["book", data.words.length, "Từ vựng trong hệ thống", "green"],
              ["layers", data.sets.length, "Bộ từ đã tạo", "purple"],
              ["target", data.report.answers, "Câu đã được chấm", "orange"],
            ].map(([icon, value, label, color]) => (
              <div className="stat-card" key={label}>
                <div className="stat-top">
                  <span>{label}</span>
                  <span className={`stat-icon ${color}`}>
                    <Icon name={icon} />
                  </span>
                </div>
                <strong>{value}</strong>
                <p>Dữ liệu thực tế trong hệ thống</p>
              </div>
            ))}
          </div>
          <div className="admin-overview-grid">
            <section className="panel">
              <div className="section-line">
                <div>
                  <h3>Sức khỏe kho nội dung</h3>
                  <p>Kiểm tra trước khi đưa nội dung đến người học</p>
                </div>
                <Icon name="shield" />
              </div>
              {[
                [
                  "Đã xuất bản",
                  data.words.filter((w) => w.status === "published").length,
                  "green",
                ],
                [
                  "Bản nháp cần rà soát",
                  data.words.filter((w) => w.status === "draft").length,
                  "orange",
                ],
                [
                  "Đã lưu trữ",
                  data.words.filter((w) => w.status === "archived").length,
                  "neutral",
                ],
                [
                  "Chưa có tệp phát âm riêng",
                  data.words.filter((w) => !w.audio).length,
                  "neutral",
                ],
              ].map(([label, count, color]) => (
                <div className="quality-row" key={label}>
                  <span>{label}</span>
                  <Badge color={color}>{count} từ</Badge>
                </div>
              ))}
              <p className="data-note">
                Từ chưa có tệp âm thanh dùng giọng đọc của trình duyệt nếu được
                hỗ trợ. Nội dung khởi tạo là mẫu biên soạn, cần chuyên môn rà
                soát.
              </p>
              <Button
                variant="secondary"
                icon="edit"
                onClick={() => changeTab("words")}
              >
                Quản lý nội dung
              </Button>
            </section>
            <section className="panel">
              <div className="section-line">
                <div>
                  <h3>Hoạt động gần đây</h3>
                  <p>Những thay đổi được ghi nhận</p>
                </div>
              </div>
              {data.audit.length ? (
                data.audit.slice(0, 5).map((a) => (
                  <div className="audit-preview" key={a.id}>
                    <span className="audit-icon">
                      <Icon
                        name={a.action.startsWith("auth") ? "user" : "edit"}
                        size={17}
                      />
                    </span>
                    <div>
                      <strong>{a.action}</strong>
                      <small>
                        {a.actor || "Hệ thống"} ·{" "}
                        {date(a.created_at, user.profile.timezone, true)}
                      </small>
                    </div>
                  </div>
                ))
              ) : (
                <Empty icon="clock" title="Chưa có thay đổi" />
              )}
              <button className="text-link" onClick={() => changeTab("audit")}>
                Xem nhật ký đầy đủ
              </button>
            </section>
          </div>
        </>
      )}
      {(entities || tab === "users") && (
        <>
          <div className="section-heading">
            <h2>
              {tabs.find((t) => t[0] === tab)[1]}{" "}
              <span className="count-text">{rows.length}</span>
            </h2>
            {entities && (
              <Button
                icon="plus"
                onClick={() => setEditing({ entity: tab, value: null })}
              >
                Thêm{" "}
                {tab === "words"
                  ? "từ mới"
                  : tab === "sets"
                    ? "bộ từ"
                    : "chủ đề"}
              </Button>
            )}
          </div>
          <div className="filter-toolbar">
            <label className="search-box">
              <Icon name="search" size={19} />
              <input
                value={query}
                placeholder={
                  tab === "users"
                    ? "Tìm theo tên hoặc email…"
                    : "Tìm nội dung hoặc mã…"
                }
                aria-label="Tìm kiếm quản trị"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <select
              aria-label="Lọc trạng thái"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              {(tab === "users"
                ? ["active", "locked", "pending"]
                : ["draft", "published", "archived"]
              ).map((s) => (
                <option value={s} key={s}>
                  {statusNames[s]}
                </option>
              ))}
            </select>
          </div>
          {rows.length ? (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {tab === "words" ? (
                        <>
                          <th>Từ vựng</th>
                          <th>Nghĩa & bộ từ</th>
                          <th>Phiên bản</th>
                        </>
                      ) : tab === "users" ? (
                        <>
                          <th>Tài khoản</th>
                          <th>Vai trò</th>
                          <th>Ngày tham gia</th>
                        </>
                      ) : (
                        <>
                          <th>{tab === "sets" ? "Bộ từ" : "Chủ đề"}</th>
                          <th>Mô tả</th>
                          <th>{tab === "sets" ? "Trình độ" : "Số bộ từ"}</th>
                        </>
                      )}
                      <th>Trạng thái</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice((page - 1) * 20, page * 20).map((row) => (
                      <tr key={row.id}>
                        {tab === "words" ? (
                          <>
                            <td>
                              <strong>{row.word}</strong>
                              <small>
                                {row.code} · {row.pos}
                              </small>
                            </td>
                            <td>
                              <strong>{row.meaning}</strong>
                              <small>
                                {row.setIds
                                  .map(
                                    (id) =>
                                      data.sets.find((s) => s.id === id)?.name,
                                  )
                                  .join(", ")}
                              </small>
                            </td>
                            <td>
                              <Badge color="neutral">v{row.version}</Badge>
                            </td>
                          </>
                        ) : tab === "users" ? (
                          <>
                            <td>
                              <strong>{row.name}</strong>
                              <small>{row.email}</small>
                            </td>
                            <td>
                              {row.role === "admin"
                                ? "Quản trị viên"
                                : "Người học"}
                            </td>
                            <td>{date(row.created_at)}</td>
                          </>
                        ) : (
                          <>
                            <td>
                              <strong>{row.name}</strong>
                              <small>{row.code}</small>
                            </td>
                            <td className="description-cell">
                              {row.description}
                            </td>
                            <td>
                              {tab === "sets"
                                ? row.level
                                : data.sets.filter((s) => s.topicId === row.id)
                                    .length}
                            </td>
                          </>
                        )}
                        <td>
                          <Badge
                            color={
                              ["published", "active"].includes(row.status)
                                ? "green"
                                : ["draft", "pending"].includes(row.status)
                                  ? "orange"
                                  : "neutral"
                            }
                          >
                            {statusNames[row.status]}
                          </Badge>
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            icon="edit"
                            onClick={() =>
                              tab === "users"
                                ? setActionUser(row)
                                : setEditing({ entity: tab, value: row })
                            }
                          >
                            Chỉnh sửa
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 20 && (
                <div className="pagination">
                  <Button
                    variant="secondary"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Trang trước
                  </Button>
                  <span>
                    {page} / {Math.ceil(rows.length / 20)}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={page * 20 >= rows.length}
                    onClick={() => setPage(page + 1)}
                  >
                    Trang sau
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Empty
              icon="search"
              title="Chưa có nội dung phù hợp"
              description="Thay đổi bộ lọc hoặc tạo nội dung mới."
            />
          )}
        </>
      )}
      {tab === "import" && <ImportPanel onDone={updated} />}
      {tab === "reports" && (
        <Reports initial={data.report} topics={data.topics} />
      )}
      {tab === "settings" && (
        <Settings initial={data.config} onDone={updated} />
      )}
      {tab === "audit" && (
        <>
          <div className="section-heading">
            <div>
              <h2>Nhật ký hoạt động</h2>
              <p>200 sự kiện gần nhất · chỉ đọc</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Người thực hiện</th>
                  <th>Hành động</th>
                  <th>Đối tượng & chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {data.audit.map((a) => (
                  <tr key={a.id}>
                    <td>{date(a.created_at, user.profile.timezone, true)}</td>
                    <td>{a.actor || "Hệ thống"}</td>
                    <td>
                      <Badge color="neutral">{a.action}</Badge>
                    </td>
                    <td>
                      <details>
                        <summary>{a.object_id.slice(0, 22)}</summary>
                        <pre>
                          {JSON.stringify(JSON.parse(a.detail), null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {editing && (
        <EntityModal
          entity={editing.entity}
          value={editing.value}
          data={data}
          onClose={() => setEditing(null)}
          onDone={async () => {
            await updated();
            setEditing(null);
          }}
        />
      )}
      {actionUser && (
        <UserModal
          value={actionUser}
          onClose={() => setActionUser(null)}
          onDone={async () => {
            await updated();
            setActionUser(null);
          }}
        />
      )}
    </>
  );
}
function EntityModal({ entity, value, data, onClose, onDone }) {
  const { notify } = useApp();
  const defaults =
    entity === "words"
      ? {
          code: "",
          word: "",
          ipa: "",
          pos: "danh từ",
          sense: "01",
          meaning: "",
          example: "",
          translation: "",
          source: "",
          audio: "",
          question: "",
          explanation: "",
          accepted: "",
          setIds: [data.sets[0]?.id].filter(Boolean),
          status: "draft",
        }
      : {
          code: "",
          name: "",
          description: "",
          status: "draft",
          topicId: data.topics[0]?.id || "",
          level: "A1",
          color: "green",
          icon: "book",
        };
  const [form, setForm] = useState(
    value
      ? {
          ...value,
          ...(entity === "words"
            ? { accepted: value.accepted.join(" | ") }
            : {}),
        }
      : defaults,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const field = (key, label, options = {}) => (
    <Field
      label={label}
      hint={options.hint}
      className={options.wide ? "span-two" : ""}
    >
      {options.textarea ? (
        <textarea
          required={options.required !== false}
          maxLength={options.max || 1000}
          value={form[key] || ""}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          rows={3}
        />
      ) : (
        <input
          type={options.type || "text"}
          required={options.required !== false}
          maxLength={options.max || 100}
          value={form[key] || ""}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      )}
    </Field>
  );
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/admin/${entity}`, {
        ...form,
        ...(entity === "words"
          ? {
              accepted: (form.accepted || form.word)
                .split("|")
                .map((x) => x.trim())
                .filter(Boolean),
            }
          : {}),
      });
      await onDone();
      notify("Đã lưu nội dung và ghi nhận nhật ký.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      wide
      title={`${value ? "Chỉnh sửa" : "Tạo"} ${entity === "words" ? "từ vựng & câu hỏi" : entity === "sets" ? "bộ từ" : "chủ đề"}`}
      subtitle={
        entity === "words"
          ? "Mỗi lần lưu tạo một phiên bản mới. Phiên học cũ giữ nguyên nội dung đã chốt."
          : "Nội dung nháp và lưu trữ không hiển thị trong phiên học mới."
      }
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          {field("code", "Mã định danh", { max: 40 })}
          <Field label="Trạng thái">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {["draft", "published", "archived"].map((s) => (
                <option key={s} value={s}>
                  {statusNames[s]}
                </option>
              ))}
            </select>
          </Field>
          {entity === "words" ? (
            <>
              {field("word", "Từ tiếng Anh")}
              {field("ipa", "Phiên âm IPA")}
              <Field label="Loại từ">
                <select
                  value={form.pos}
                  onChange={(e) => setForm({ ...form, pos: e.target.value })}
                >
                  {[
                    "danh từ",
                    "động từ",
                    "tính từ",
                    "trạng từ",
                    "giới từ",
                    "liên từ",
                    "đại từ",
                    "thán từ",
                    "cụm từ",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              {field("sense", "Mã nghĩa", { max: 40 })}
              {field("meaning", "Nghĩa tiếng Việt", { wide: true, max: 1000 })}
              {field("example", "Ví dụ tiếng Anh", { wide: true, max: 1000 })}
              {field("translation", "Dịch ví dụ", {
                required: false,
                wide: true,
                max: 1000,
              })}
              <Field
                label="Bộ từ liên kết"
                className="span-two"
                hint="Có thể dùng một từ trong nhiều bộ mà không tạo trùng tiến độ."
              >
                <div className="set-checkboxes">
                  {data.sets.map((s) => (
                    <label className="checkbox-label" key={s.id}>
                      <input
                        type="checkbox"
                        checked={form.setIds.includes(s.id)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            setIds: e.target.checked
                              ? [...form.setIds, s.id]
                              : form.setIds.filter((id) => id !== s.id),
                          })
                        }
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              </Field>
              {field("source", "Nguồn nội dung / quyền sử dụng", {
                textarea: true,
                wide: true,
                max: 500,
              })}
              {field("audio", "URL tệp phát âm (HTTPS)", {
                required: false,
                wide: true,
                type: "url",
                max: 1000,
                hint: "Để trống để dùng giọng đọc của trình duyệt.",
              })}
              <div className="form-subheading span-two">
                <Icon name="edit" size={18} />
                <h3>Câu hỏi luyện tập</h3>
              </div>
              {field("question", "Câu hỏi tùy chỉnh", {
                required: false,
                wide: true,
                max: 1000,
                hint: "Để trống để tự tạo câu hỏi chọn nghĩa và nhập từ.",
              })}
              {field("accepted", "Đáp án nhập từ chấp nhận", {
                required: false,
                wide: true,
                max: 1000,
                hint: "Phân cách bằng dấu |. Để trống để dùng từ tiếng Anh ở trên.",
              })}
              {field("explanation", "Giải thích sau khi chấm", {
                required: false,
                textarea: true,
                wide: true,
              })}
            </>
          ) : (
            <>
              {field("name", entity === "sets" ? "Tên bộ từ" : "Tên chủ đề", {
                wide: true,
              })}
              {field("description", "Mô tả", { textarea: true, wide: true })}
              {entity === "sets" ? (
                <>
                  <Field label="Chủ đề">
                    <select
                      required
                      value={form.topicId}
                      onChange={(e) =>
                        setForm({ ...form, topicId: e.target.value })
                      }
                    >
                      {data.topics.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Trình độ">
                    <select
                      value={form.level}
                      onChange={(e) =>
                        setForm({ ...form, level: e.target.value })
                      }
                    >
                      {["A1", "A2", "B1", "B2", "C1", "C2"].map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                  </Field>
                  <p className="data-note span-two">
                    Tạo bộ ở trạng thái nháp, thêm từ xuất bản, rồi xuất bản bộ
                    từ.
                  </p>
                </>
              ) : (
                <>
                  <Field label="Màu chủ đề">
                    <select
                      value={form.color}
                      onChange={(e) =>
                        setForm({ ...form, color: e.target.value })
                      }
                    >
                      {[
                        ["green", "Xanh lá"],
                        ["blue", "Xanh dương"],
                        ["orange", "Cam"],
                        ["purple", "Tím"],
                        ["cyan", "Xanh ngọc"],
                        ["rose", "Hồng"],
                      ].map(([key, name]) => (
                        <option value={key} key={key}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Biểu tượng">
                    <select
                      value={form.icon}
                      onChange={(e) =>
                        setForm({ ...form, icon: e.target.value })
                      }
                    >
                      {[
                        ["book", "Sách"],
                        ["chat", "Giao tiếp"],
                        ["briefcase", "Công việc"],
                        ["globe", "Thế giới"],
                        ["leaf", "Cuộc sống"],
                        ["code", "Công nghệ"],
                        ["graduation", "Học tập"],
                      ].map(([key, name]) => (
                        <option value={key} key={key}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              )}
            </>
          )}
        </div>
        {error && (
          <div className="form-alert error" role="alert">
            {error}
          </div>
        )}
        <div className="form-footer">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" busy={busy}>
            Lưu nội dung
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function UserModal({ value, onClose, onDone }) {
  const { notify } = useApp();
  const [form, setForm] = useState(value);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title="Cập nhật tài khoản"
      subtitle={`${value.name} · ${value.email}`}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api(
              "/admin/users",
              { id: value.id, role: form.role, status: form.status },
              "PATCH",
            );
            await onDone();
            notify(
              "Đã cập nhật tài khoản. Các phiên đăng nhập cũ đã được thu hồi.",
            );
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Vai trò">
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="learner">Người học</option>
            <option value="admin">Quản trị viên</option>
          </select>
        </Field>
        <Field label="Trạng thái">
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            {["active", "locked", "pending"].map((s) => (
              <option key={s} value={s}>
                {statusNames[s]}
              </option>
            ))}
          </select>
        </Field>
        <p className="data-note">
          Xác nhận sẽ thu hồi các phiên đăng nhập của tài khoản này. Hệ thống
          bảo vệ tài khoản quản trị hoạt động cuối cùng.
        </p>
        {error && <div className="form-alert error">{error}</div>}
        <div className="form-footer">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button busy={busy} type="submit">
            Xác nhận cập nhật
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function ImportPanel({ onDone }) {
  const { notify } = useApp();
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("create");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [committed, setCommitted] = useState(false);
  const check = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    setPreview(null);
    setCommitted(false);
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("Tệp không được vượt quá 5 MB.");
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = () => reject(new Error("Không đọc được tệp."));
        reader.readAsDataURL(file);
      });
      setPreview(
        await api("/admin/import/preview", {
          filename: file.name,
          file: base64,
          mode,
        }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const commit = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api("/admin/import/commit", { id: preview.id });
      setCommitted(true);
      await onDone();
      notify(result.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Nhập từ vựng từ Excel</h2>
          <p>
            Kiểm tra toàn bộ lô trước khi xác nhận. Nội dung mới được lưu ở
            trạng thái nháp.
          </p>
        </div>
        <Button
          variant="secondary"
          icon="download"
          onClick={() =>
            download("/admin/import/template").catch((e) =>
              notify(e.message, "error"),
            )
          }
        >
          Tải tệp mẫu
        </Button>
      </div>
      <div className="panel import-panel">
        <div className="import-steps">
          <span className="active">Chọn tệp</span>
          <i />
          <span className={preview ? "active" : ""}>Kiểm tra dữ liệu</span>
          <i />
          <span className={committed ? "active" : ""}>Xác nhận nhập</span>
        </div>
        <div className="import-dropzone">
          <span>
            <Icon name="upload" size={34} />
          </span>
          <h3>Đưa những từ mới vào Techcamp</h3>
          <p>Tệp .xlsx · Tối đa 5 MB và 2.000 dòng dữ liệu</p>
          <input
            type="file"
            aria-label="Chọn tệp Excel"
            accept=".xlsx"
            onChange={(e) => {
              setFile(e.target.files[0]);
              setPreview(null);
              setError("");
              setCommitted(false);
            }}
          />
        </div>
        <div className="import-options">
          <Field label="Chế độ nhập">
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                setPreview(null);
                setCommitted(false);
              }}
            >
              <option value="create">Tạo mới (chống trùng mã)</option>
              <option value="update">Cập nhật theo mã từ</option>
            </select>
          </Field>
          <Button icon="check" busy={busy} disabled={!file} onClick={check}>
            Kiểm tra tệp
          </Button>
        </div>
        <p className="data-note">
          Các cột bắt buộc: code, word, pos, ipa, meaning, example, setCode,
          source. Cột tùy chọn: sense, translation, accepted. Dùng mã bộ từ
          trong mục “Bộ từ”.
        </p>
      </div>
      {error && (
        <div className="form-alert error" role="alert">
          {error}
        </div>
      )}
      {preview && (
        <section className="panel import-preview">
          <div className="section-line">
            <div>
              <h3>
                {committed
                  ? "Đã nhập dữ liệu thành công"
                  : preview.errors.length
                    ? "Cần sửa lỗi trước khi nhập"
                    : "Dữ liệu hợp lệ, sẵn sàng nhập"}
              </h3>
              <p>
                {preview.total} dòng · {preview.rows.length} hợp lệ ·{" "}
                {preview.errors.length} lỗi
              </p>
            </div>
            <Badge color={preview.errors.length ? "orange" : "green"}>
              {committed
                ? "Đã hoàn tất"
                : preview.errors.length
                  ? "Chưa thể nhập"
                  : "Đã kiểm tra"}
            </Badge>
          </div>
          {preview.errors.length > 0 && (
            <div className="import-errors" role="alert">
              {preview.errors.map((err, i) => (
                <p key={i}>
                  <strong>Dòng {err.row}:</strong> {err.message}
                </p>
              ))}
            </div>
          )}
          {preview.rows.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Dòng</th>
                    <th>Mã</th>
                    <th>Từ</th>
                    <th>Nghĩa</th>
                    <th>Thay đổi</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 50).map((w) => (
                    <tr key={w.id}>
                      <td>{w.row}</td>
                      <td>{w.code}</td>
                      <td>{w.word}</td>
                      <td>{w.meaning}</td>
                      <td>
                        {w.previousVersion
                          ? `v${w.previousVersion} → v${w.version}`
                          : "Tạo mới"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {preview.rows.length > 50 && (
            <p className="data-note">
              Đang hiển thị 50/{preview.rows.length} dòng. Khi xác nhận sẽ nhập
              toàn bộ lô.
            </p>
          )}
          {!preview.errors.length && !committed && (
            <div className="form-footer">
              <Button icon="upload" busy={busy} onClick={commit}>
                Xác nhận nhập {preview.rows.length} từ
              </Button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
function Reports({ initial, topics }) {
  const { notify } = useApp();
  const [report, setReport] = useState(initial);
  const [filter, setFilter] = useState({ from: "", to: "", topic: "" });
  const [applied, setApplied] = useState({ from: "", to: "", topic: "" });
  const [busy, setBusy] = useState(false);
  const load = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (filter.from && filter.to && filter.from > filter.to)
        throw new Error("Ngày bắt đầu phải trước ngày kết thúc.");
      setReport(await api(`/admin/report?${new URLSearchParams(filter)}`));
      setApplied(filter);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Hoạt động & chất lượng học tập</h2>
          <p>Dữ liệu tổng hợp, không bao gồm thông tin định danh người học.</p>
        </div>
        <Button
          variant="secondary"
          icon="download"
          onClick={() =>
            download(
              `/admin/report/export?${new URLSearchParams(applied)}`,
            ).catch((e) => notify(e.message, "error"))
          }
        >
          Xuất Excel
        </Button>
      </div>
      <form className="filter-toolbar report-filters" onSubmit={load}>
        <Field label="Từ ngày">
          <input
            type="date"
            value={filter.from}
            onChange={(e) => setFilter({ ...filter, from: e.target.value })}
          />
        </Field>
        <Field label="Đến ngày">
          <input
            type="date"
            min={filter.from}
            value={filter.to}
            onChange={(e) => setFilter({ ...filter, to: e.target.value })}
          />
        </Field>
        <Field label="Chủ đề">
          <select
            value={filter.topic}
            onChange={(e) => setFilter({ ...filter, topic: e.target.value })}
          >
            <option value="">Tất cả chủ đề</option>
            {topics.map((t) => (
              <option value={t.id} key={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit" busy={busy}>
          Áp dụng
        </Button>
      </form>
      <div className="stats-grid">
        {[
          ["Người học hoạt động", report.activeLearners],
          ["Câu đã chấm", report.answers],
          [
            "Tỷ lệ trả lời đúng",
            report.accuracy == null ? "—" : `${report.accuracy}%`,
          ],
          ["Phiên hoàn thành", report.completed],
        ].map(([label, value]) => (
          <div className="stat-card" key={label}>
            <span className="muted">{label}</span>
            <strong>{value}</strong>
            <p>Theo bộ lọc đang áp dụng</p>
          </div>
        ))}
      </div>
      <section className="panel">
        <h3>Lượt trả lời theo chủ đề</h3>
        <div className="topic-report">
          {report.byTopic.map((t) => (
            <div key={t.name}>
              <span>{t.name}</span>
              <Progress
                value={t.count}
                max={Math.max(1, ...report.byTopic.map((x) => x.count))}
              />
              <strong>{t.count}</strong>
            </div>
          ))}
        </div>
      </section>
      <div className="section-heading">
        <div>
          <h2>Từ cần rà soát</h2>
          <p>Tỷ lệ sai = số sai / số câu đã chấm của từng phiên bản.</p>
        </div>
        <Badge color="neutral">Cỡ mẫu: {report.answers} câu</Badge>
      </div>
      {report.words.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Từ</th>
                <th>Phiên bản</th>
                <th>Số câu</th>
                <th>Số sai</th>
                <th>Tỷ lệ sai</th>
                <th>Cỡ mẫu</th>
              </tr>
            </thead>
            <tbody>
              {report.words.map((w) => (
                <tr key={`${w.word}-${w.version}`}>
                  <td>
                    <strong>{w.word}</strong>
                    <small>{w.meaning}</small>
                  </td>
                  <td>v{w.version}</td>
                  <td>{w.total}</td>
                  <td>{w.wrong}</td>
                  <td>{w.errorRate}%</td>
                  <td>
                    <Badge color={w.total >= 10 ? "green" : "neutral"}>
                      {w.total >= 10 ? "Đủ mẫu" : "Chưa đủ 10 câu để xếp hạng"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          icon="chart"
          title="Chưa có dữ liệu phù hợp"
          description="Kết quả sẽ xuất hiện khi người học trả lời bài luyện."
        />
      )}
      <p className="data-note">
        Ngày trả lời theo ngày học đã lưu của mỗi người. Phiên hoàn thành lọc
        theo UTC. Người học hoạt động là tài khoản có câu trả lời được lưu; đăng
        nhập không tính là hoạt động học.
      </p>
    </>
  );
}
function Settings({ initial, onDone }) {
  const { notify } = useApp();
  const [form, setForm] = useState({
    intervals: initial.intervals.join(", "),
    retryMinutes: initial.retryMinutes,
    sessionSize: initial.sessionSize,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="settings-admin panel">
      <h2>Cấu hình học & ôn tập</h2>
      <p>
        Mỗi lần lưu tạo một phiên bản. Thay đổi chỉ áp dụng cho các phiên mới,
        không tính lại hạn ôn đã có.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api("/admin/config", {
              ...form,
              intervals: form.intervals.split(",").map((v) => Number(v.trim())),
            });
            await onDone();
            notify("Đã lưu phiên bản cấu hình mới.");
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field
          label="Khoảng cách ôn khi trả lời đúng (ngày)"
          hint="5 số nguyên tăng dần, phân cách bằng dấu phẩy. Mặc định: 1, 3, 7, 14, 30."
        >
          <input
            required
            value={form.intervals}
            onChange={(e) => setForm({ ...form, intervals: e.target.value })}
          />
        </Field>
        <div className="form-grid">
          <Field label="Ôn sau câu sai (phút)">
            <input
              type="number"
              required
              min={1}
              max={1440}
              value={form.retryMinutes}
              onChange={(e) =>
                setForm({ ...form, retryMinutes: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Số từ mặc định mỗi phiên">
            <input
              type="number"
              required
              min={1}
              max={20}
              value={form.sessionSize}
              onChange={(e) =>
                setForm({ ...form, sessionSize: Number(e.target.value) })
              }
            />
          </Field>
        </div>
        {error && <div className="form-alert error">{error}</div>}
        <div className="form-footer">
          <Button type="submit" busy={busy}>
            Lưu phiên bản cấu hình
          </Button>
        </div>
      </form>
    </div>
  );
}

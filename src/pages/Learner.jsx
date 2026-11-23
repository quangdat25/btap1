import { useState } from "react";
import {
  api,
  useApp,
  Button,
  Badge,
  Empty,
  Field,
  IconButton,
  LearningArt,
  Modal,
  PageHeading,
  Progress,
  WordAudio,
  date,
  download,
  go,
  modeNames,
  statusNames,
} from "../lib";
import Icon from "../components/Icon";
import { StartSession } from "./Learning";

export function SetCard({ set }) {
  const { data } = useApp();
  const topic = data.topics.find((t) => t.id === set.topicId);
  const words = data.words.filter((w) => w.setIds.includes(set.id));
  const count = words.filter((w) =>
    data.practicedWordIds.includes(w.id),
  ).length;
  return (
    <article className="set-card">
      <div className={`set-cover ${topic?.color || "green"}`}>
        <span className="cover-orbit orbit-one" />
        <span className="cover-orbit orbit-two" />
        <span className="set-cover-icon">
          <Icon name={topic?.icon} size={43} />
        </span>
        <span className="cover-caption">{topic?.name}</span>
        <Badge>{set.level}</Badge>
      </div>
      <div className="set-card-body">
        <div className="set-meta">
          <span>
            <Icon name="layers" size={15} />
            {words.length} từ vựng
          </span>
          <span>
            <Icon name="clock" size={15} />
            {set.duration || "10 phút"}
          </span>
        </div>
        <h3>
          <a href={`#set/${set.id}`}>{set.name}</a>
        </h3>
        <p>{set.description}</p>
        <div className="set-card-progress">
          <span>
            {count
              ? `${count}/${words.length} từ đã luyện`
              : "Sẵn sàng để bắt đầu"}
          </span>
          <span>
            {words.length ? Math.round((count / words.length) * 100) : 0}%
          </span>
        </div>
        <Progress value={count} max={words.length} />
        <a className="set-card-link" href={`#set/${set.id}`}>
          {count ? "Tiếp tục khám phá" : "Khám phá bộ từ"}
          <Icon name="book" size={17} />
        </a>
      </div>
    </article>
  );
}
export function StatCards({ stats }) {
  return (
    <div className="stats-grid">
      {[
        [
          "book",
          "Từ đã luyện",
          stats.learned,
          "Từng từ nhỏ, từng bước tiến",
          "green",
        ],
        [
          "review",
          "Từ đến lịch ôn",
          stats.due,
          stats.due ? "Sẵn sàng củng cố trí nhớ" : "Lịch ôn của bạn đang trống",
          "orange",
        ],
        [
          "target",
          "Tỷ lệ trả lời đúng",
          stats.accuracy == null ? "—" : `${stats.accuracy}%`,
          stats.answers
            ? `Từ ${stats.answers} câu đã trả lời`
            : "Bắt đầu học để xem kết quả",
          "purple",
        ],
        [
          "flame",
          "Chuỗi ngày học",
          stats.streak,
          "Duy trì thói quen mỗi ngày",
          "rose",
        ],
      ].map(([icon, label, value, description, color]) => (
        <article className="stat-card" key={label}>
          <div className="stat-top">
            <span>{label}</span>
            <span className={`stat-icon ${color}`}>
              <Icon name={icon} size={20} />
            </span>
          </div>
          <strong>
            {value}
            <small>{icon === "flame" ? "ngày" : ""}</small>
          </strong>
          <p>{description}</p>
        </article>
      ))}
    </div>
  );
}
export function ActivityChart({ days }) {
  const max = Math.max(10, ...days.map((d) => d.count));
  return (
    <div className="activity-chart">
      {days.map((day, i) => (
        <div
          className={`chart-column ${i === days.length - 1 ? "today" : ""}`}
          key={day.day}
        >
          <div className="chart-bar-wrap">
            <span className="chart-value">{day.count}</span>
            <div
              className="chart-bar"
              style={{
                height: `${(day.count / max) * 100}%`,
                minHeight: day.count ? 8 : 3,
              }}
            />
          </div>
          <span>
            {new Intl.DateTimeFormat("vi-VN", { weekday: "short" }).format(
              new Date(`${day.day}T12:00:00`),
            )}
          </span>
          <small>
            {day.day.slice(8)}/{day.day.slice(5, 7)}
          </small>
        </div>
      ))}
    </div>
  );
}
export function Dashboard() {
  const { user, data } = useApp();
  const { stats } = data;
  const [start, setStart] = useState(false);
  const weekday = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: user.profile.timezone,
  }).format(new Date(data.serverTime));
  const word = data.words.length
    ? data.words[
        Number(user.profile.day.replaceAll("-", "")) % data.words.length
      ]
    : null;
  return (
    <>
      <PageHeading
        eyebrow={weekday}
        title={`Chào ${user.name.split(" ").at(-1)}, cùng học nhé!`}
        description="Một chút kiên trì hôm nay, một phiên bản tự tin hơn ngày mai."
      >
        <button className="date-chip" onClick={() => go("history")}>
          <Icon name="calendar" size={17} />
          Lịch học của tôi
        </button>
      </PageHeading>
      <div className="dashboard-intro">
        <section className="welcome-banner">
          <div>
            <span className="banner-label">
              <span />
              HÀNH TRÌNH CỦA BẠN
            </span>
            <h2>
              Mỗi từ mới là một
              <br />
              <span>cánh cửa mới.</span>
            </h2>
            <p>
              Dành vài phút để mở rộng thế giới của bạn.
              <br />
              Bắt đầu với một bộ từ yêu thích hôm nay.
            </p>
            <Button
              icon={data.active ? "play" : "spark"}
              onClick={() =>
                data.active ? go(`session/${data.active.id}`) : setStart(true)
              }
            >
              {data.active ? "Tiếp tục phiên đang học" : "Bắt đầu học ngay"}
            </Button>
          </div>
          <LearningArt />
        </section>
        <section className="daily-goal panel">
          <div className="section-line">
            <h3>Mục tiêu hôm nay</h3>
            <button
              className="text-link"
              onClick={() => go("profile")}
              aria-label="Chỉnh sửa mục tiêu"
            >
              <Icon name="edit" size={17} />
            </button>
          </div>
          <div
            className="goal-circle"
            style={{
              "--goal": `${Math.min(100, (stats.today / stats.goal) * 100)}%`,
            }}
          >
            <div>
              <Icon name="target" size={25} />
              <strong>
                {stats.today}
                <small> / {stats.goal}</small>
              </strong>
              <span>từ đã luyện</span>
            </div>
          </div>
          <p>
            {stats.today >= stats.goal
              ? "Bạn đã hoàn thành mục tiêu hôm nay!"
              : `Còn ${stats.goal - stats.today} từ nữa để đạt mục tiêu. Cố lên nhé!`}
          </p>
          <span className="goal-note">
            <Icon name="leaf" size={15} />
            Mỗi bước nhỏ đều có giá trị
          </span>
        </section>
      </div>
      <StatCards stats={stats} />
      <div className="dashboard-mid">
        <section className="panel activity-panel">
          <div className="section-line">
            <div>
              <h3>Nhịp học của bạn</h3>
              <p>Số từ đã luyện trong 7 ngày gần đây</p>
            </div>
            <Badge color="neutral">7 ngày qua</Badge>
          </div>
          <ActivityChart days={stats.days} />
          <div className="chart-summary">
            <span className="chart-legend">
              <i />
              Từ đã luyện mỗi ngày
            </span>
            <strong>
              {stats.days.reduce((sum, day) => sum + day.count, 0)}
              <small> lượt từ trong tuần</small>
            </strong>
          </div>
        </section>
        <section className="review-prompt panel">
          <span className="review-prompt-icon">
            <Icon name="review" size={26} />
          </span>
          <h3>
            Ôn đúng lúc,
            <br />
            nhớ lâu hơn.
          </h3>
          <p>
            {stats.due
              ? `Bạn có ${stats.due} từ đang chờ ôn lại. Dành vài phút để củng cố nhé!`
              : "Từ đã học sẽ xuất hiện ở đây khi đến lịch ôn. Học từ mới để bắt đầu hành trình."}
          </p>
          <Button
            variant="secondary"
            icon="review"
            onClick={() => go("review")}
          >
            {stats.due ? `Ôn tập ${stats.due} từ` : "Xem lịch ôn tập"}
          </Button>
        </section>
      </div>
      <div className="section-heading">
        <div>
          <span className="eyebrow">TÌM ĐIỀU BẠN YÊU THÍCH</span>
          <h2>Bộ từ dành cho bạn</h2>
        </div>
        <a className="text-link inline-link" href="#library">
          Xem tất cả
          <Icon name="book" size={17} />
        </a>
      </div>
      <div className="sets-grid home-sets">
        {data.sets.slice(0, 3).map((set) => (
          <SetCard key={set.id} set={set} />
        ))}
      </div>
      {word && (
        <div className="word-of-day">
          <span className="word-day-icon">
            <Icon name="spark" size={25} />
          </span>
          <div>
            <span>TỪ MỚI MỖI NGÀY</span>
            <h3>
              {word.word} <small>{word.ipa}</small>
            </h3>
            <p>
              {word.meaning} <i>— {word.example}</i>
            </p>
          </div>
          <WordAudio word={word.word} audio={word.audio} />
        </div>
      )}
      {start && <StartSession onClose={() => setStart(false)} />}
    </>
  );
}
export function Library() {
  const { data } = useApp();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("");
  const [page, setPage] = useState(1);
  const filtered = data.sets.filter(
    (s) =>
      (!query ||
        `${s.name} ${s.description} ${data.topics.find((t) => t.id === s.topicId)?.name}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!topic || s.topicId === topic) &&
      (!level || s.level === level),
  );
  return (
    <>
      <PageHeading
        eyebrow="KHÁM PHÁ ĐỂ TIẾN XA HƠN"
        title="Một thế giới từ vựng đang chờ bạn"
        description="Chọn chủ đề bạn quan tâm. Học những từ bạn sẽ thực sự sử dụng."
      />
      <div className="library-banner">
        <div>
          <span className="eyebrow">HỌC THEO CÁCH CỦA BẠN</span>
          <h2>Bắt đầu từ điều gần gũi.</h2>
          <p>
            {data.sets.length} bộ từ · {data.words.length} từ vựng · Từ cơ bản
            đến nâng cao
          </p>
        </div>
        <div className="library-banner-art">
          <Icon name="globe" size={86} />
          <Icon name="spark" size={26} />
        </div>
      </div>
      <div className="filter-toolbar">
        <label className="search-box">
          <Icon name="search" size={19} />
          <input
            aria-label="Tìm bộ từ"
            placeholder="Tìm tên bộ từ hoặc chủ đề…"
            maxLength={100}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
          {query && (
            <button aria-label="Xóa từ khóa" onClick={() => setQuery("")}>
              <Icon name="close" size={16} />
            </button>
          )}
        </label>
        <select
          aria-label="Lọc trình độ"
          value={level}
          onChange={(e) => {
            setLevel(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả trình độ</option>
          {["A1", "A2", "B1", "B2", "C1", "C2"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>
      <div className="topic-tabs">
        <button
          className={!topic ? "active" : ""}
          onClick={() => {
            setTopic("");
            setPage(1);
          }}
        >
          Tất cả chủ đề
        </button>
        {data.topics.map((t) => (
          <button
            key={t.id}
            className={topic === t.id ? "active" : ""}
            onClick={() => {
              setTopic(t.id);
              setPage(1);
            }}
          >
            <Icon name={t.icon} size={17} />
            {t.name}
          </button>
        ))}
      </div>
      <div className="results-label">
        <strong>{filtered.length} bộ từ</strong>
        <span>Hành trình lớn bắt đầu từ những điều nhỏ</span>
      </div>
      {filtered.length ? (
        <>
          <div className="sets-grid">
            {filtered.slice((page - 1) * 9, page * 9).map((set) => (
              <SetCard set={set} key={set.id} />
            ))}
          </div>
          {filtered.length > 9 && (
            <div className="pagination">
              <Button
                variant="secondary"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Trang trước
              </Button>
              <span>
                {page}/{Math.ceil(filtered.length / 9)}
              </span>
              <Button
                variant="secondary"
                disabled={page * 9 >= filtered.length}
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
          title="Chưa tìm thấy bộ từ phù hợp"
          description="Thử một từ khóa khác hoặc bỏ bớt bộ lọc."
        >
          <Button
            variant="secondary"
            onClick={() => {
              setQuery("");
              setTopic("");
              setLevel("");
            }}
          >
            Xóa bộ lọc
          </Button>
        </Empty>
      )}
    </>
  );
}
export function SetPage({ id }) {
  const { data } = useApp();
  const set = data.sets.find((s) => s.id === id);
  const [start, setStart] = useState(false);
  if (!set)
    return (
      <Empty
        title="Bộ từ không còn khả dụng"
        description="Nội dung có thể đã được lưu trữ. Hãy khám phá các bộ từ khác."
      >
        <Button onClick={() => go("library")}>Khám phá bộ từ</Button>
      </Empty>
    );
  const topic = data.topics.find((t) => t.id === set.topicId);
  const words = data.words.filter((w) => w.setIds.includes(id));
  const learned = words.filter((w) =>
    data.practicedWordIds.includes(w.id),
  ).length;
  return (
    <>
      <a className="back-link" href="#library">
        <Icon name="left" size={17} />
        Khám phá bộ từ
      </a>
      <div className={`set-detail-banner ${topic?.color}`}>
        <span className="detail-icon">
          <Icon name={topic?.icon} size={55} />
        </span>
        <div>
          <Badge>
            {set.level} · {topic?.name}
          </Badge>
          <h1>{set.name}</h1>
          <p>{set.description}</p>
          <div className="set-meta">
            <span>
              <Icon name="layers" size={17} />
              {words.length} từ vựng
            </span>
            <span>
              <Icon name="clock" size={17} />
              {set.duration || "10 phút"}
            </span>
            <span>{learned} từ đã luyện</span>
          </div>
        </div>
      </div>
      <div className="detail-actions">
        <Button icon="play" onClick={() => setStart(true)}>
          Bắt đầu luyện tập
        </Button>
        <Button
          icon="layers"
          variant="secondary"
          onClick={() => go(`flashcards/${id}`)}
        >
          Học bằng flashcard
        </Button>
      </div>
      <div className="section-heading">
        <div>
          <h2>Từ vựng trong bộ</h2>
          <p>Làm quen với nghĩa, ví dụ và cách phát âm trước khi luyện tập.</p>
        </div>
        <Badge color="neutral">{words.length} từ</Badge>
      </div>
      <WordList words={words} />
      {start && <StartSession setId={id} onClose={() => setStart(false)} />}
    </>
  );
}
export function WordList({ words, allowDifficult = false }) {
  const { data, notify, refresh } = useApp();
  const [busy, setBusy] = useState("");
  const save = async (word, difficult) => {
    setBusy(word.id);
    try {
      const saved = data.saved.includes(word.id);
      await api("/saved", {
        wordId: word.id,
        saved: difficult === undefined ? !saved : true,
        difficult: difficult ?? false,
      });
      await refresh();
      notify(
        difficult !== undefined
          ? "Đã cập nhật đánh dấu từ khó."
          : saved
            ? "Đã bỏ lưu từ."
            : "Đã thêm vào từ của tôi.",
      );
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy("");
    }
  };
  return words.length ? (
    <div className="word-list">
      {words.map((word) => (
        <article className="word-row" key={word.id}>
          <div className="word-main">
            <div className="word-title">
              <h3>{word.word}</h3>
              <WordAudio word={word.word} audio={word.audio} />
            </div>
            <span>
              {word.ipa} <i>· {word.pos}</i>
            </span>
          </div>
          <div className="word-meaning">
            <strong>{word.meaning}</strong>
            <p>{word.example}</p>
            {word.status !== "published" && (
              <Badge color="orange">
                Đã lưu trữ · không dùng trong phiên mới
              </Badge>
            )}
          </div>
          <div className="word-actions">
            {allowDifficult && (
              <button
                disabled={busy === word.id}
                className={`icon-btn ${word.difficult ? "is-difficult" : ""}`}
                onClick={() => save(word, !word.difficult)}
                aria-label={
                  word.difficult ? "Bỏ đánh dấu khó" : "Đánh dấu từ khó"
                }
                title="Đánh dấu từ khó"
              >
                <Icon name="flame" />
              </button>
            )}
            <button
              className={`icon-btn save-btn ${data.saved.includes(word.id) ? "is-saved" : ""}`}
              disabled={busy === word.id}
              onClick={() => save(word)}
              aria-label={
                data.saved.includes(word.id)
                  ? `Bỏ lưu ${word.word}`
                  : `Lưu ${word.word}`
              }
              title={data.saved.includes(word.id) ? "Bỏ lưu từ" : "Lưu từ"}
            >
              <Icon name="bookmark" />
            </button>
          </div>
        </article>
      ))}
    </div>
  ) : (
    <Empty title="Chưa có từ vựng" />
  );
}
export function Saved() {
  const { data } = useApp();
  const [query, setQuery] = useState("");
  const [difficult, setDifficult] = useState(false);
  const words = data.savedWords.filter(
    (w) =>
      (!query ||
        `${w.word} ${w.meaning}`.toLowerCase().includes(query.toLowerCase())) &&
      (!difficult || w.difficult),
  );
  return (
    <>
      <PageHeading
        eyebrow="BỘ SƯU TẬP CỦA RIÊNG BẠN"
        title="Những từ bạn muốn ghi nhớ"
        description="Lưu lại từ yêu thích và dành thêm thời gian cho những từ còn khó."
      >
        {data.savedWords.some((w) => w.status === "published") && (
          <Button icon="layers" onClick={() => go("flashcards/saved")}>
            Ôn bằng flashcard
          </Button>
        )}
      </PageHeading>
      <div className="filter-toolbar">
        <label className="search-box">
          <Icon name="search" size={19} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm từ tiếng Anh hoặc nghĩa tiếng Việt…"
            aria-label="Tìm trong từ đã lưu"
          />
        </label>
        <button
          className={`filter-chip ${difficult ? "active" : ""}`}
          onClick={() => setDifficult(!difficult)}
        >
          <Icon name="flame" size={17} />
          Chỉ từ khó
        </button>
        <Badge color="neutral">{words.length} từ</Badge>
      </div>
      {words.length ? (
        <WordList words={words} allowDifficult />
      ) : (
        <Empty
          icon="bookmark"
          title={
            data.savedWords.length
              ? "Không tìm thấy từ phù hợp"
              : "Bộ sưu tập của bạn đang chờ từ đầu tiên"
          }
          description="Nhấn biểu tượng lưu ở mỗi từ để tạo danh sách của riêng bạn."
        >
          <Button onClick={() => go("library")}>Khám phá bộ từ</Button>
        </Empty>
      )}
    </>
  );
}
export function Review() {
  const { data, user } = useApp();
  const [start, setStart] = useState(false);
  const now = data.serverTime;
  const due = data.progress
    .filter(
      (p) => p.due_at <= now && data.words.some((w) => w.id === p.word_id),
    )
    .sort((a, b) => a.due_at.localeCompare(b.due_at));
  const future = data.progress
    .filter((p) => p.due_at > now && data.words.some((w) => w.id === p.word_id))
    .sort((a, b) => a.due_at.localeCompare(b.due_at));
  return (
    <>
      <PageHeading
        eyebrow="CỦNG CỐ TỪNG CHÚT MỘT"
        title="Đúng lúc để ghi nhớ lâu hơn"
        description="Ôn lại những từ đến hạn, ưu tiên từ cần bạn quan tâm trước."
      />
      <section className="review-banner">
        <div className="review-banner-symbol">
          <Icon name="review" size={48} />
        </div>
        <div>
          <h2>
            {due.length
              ? `${due.length} từ đang chờ bạn ôn lại`
              : "Bạn đang theo kịp lịch ôn!"}
          </h2>
          <p>
            {due.length
              ? "Một phiên ôn ngắn sẽ giúp bạn củng cố những từ đã học."
              : "Hãy tiếp tục học từ mới, chúng tôi sẽ giữ lịch ôn cho bạn."}
          </p>
        </div>
        <Button
          icon={due.length ? "play" : "book"}
          onClick={() => (due.length ? setStart(true) : go("library"))}
        >
          {due.length ? "Bắt đầu ôn tập" : "Học từ mới"}
        </Button>
      </section>
      <div className="section-heading">
        <h2>Từ đến lịch ôn</h2>
        <Badge color="orange">{due.length} từ</Badge>
      </div>
      {due.length ? (
        <WordList
          words={due.map((p) => data.words.find((w) => w.id === p.word_id))}
        />
      ) : (
        <div className="panel">
          <Empty
            icon="check"
            title="Chưa có từ đến hạn lúc này"
            description={
              future.length
                ? `Lần ôn tiếp theo: ${date(future[0].due_at, user.profile.timezone, true)}.`
                : "Sau khi trả lời bài học mới, lịch ôn của bạn sẽ được tạo tự động."
            }
          />
        </div>
      )}
      {future.length > 0 && (
        <>
          <div className="section-heading">
            <h2>Sắp đến lịch ôn</h2>
            <span className="muted">
              Giờ hiển thị theo {user.profile.timezone}
            </span>
          </div>
          <div className="upcoming-grid">
            {future.slice(0, 12).map((p) => {
              const w = data.words.find((w) => w.id === p.word_id);
              return (
                <div className="upcoming-item" key={p.word_id}>
                  <div>
                    <strong>{w.word}</strong>
                    <p>{w.meaning}</p>
                  </div>
                  <span>
                    <Icon name="clock" size={15} />
                    {date(p.due_at, user.profile.timezone, true)}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
      {start && <StartSession mode="review" onClose={() => setStart(false)} />}
    </>
  );
}
export function History() {
  const { data, user, notify } = useApp();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [mode, setMode] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const invalid = from && to && from > to;
  const filtered = data.history.filter((s) => {
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: user.profile.timezone,
    }).format(new Date(s.createdAt));
    return (
      (!from || day >= from) &&
      (!to || day <= to) &&
      (!mode || mode === s.mode) &&
      (!status || status === s.status)
    );
  });
  const exportData = async () => {
    setBusy(true);
    try {
      await download(
        `/history/export?${new URLSearchParams({ from, to, mode, status })}`,
      );
      notify("Đã tải lịch sử học tập.");
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="NHÌN LẠI ĐỂ TIẾN XA HƠN"
        title="Từng bước tiến của bạn"
        description="Mỗi câu trả lời đều là một phần trong hành trình học tập."
      >
        <Button
          variant="secondary"
          icon="download"
          busy={busy}
          disabled={invalid}
          onClick={exportData}
        >
          Xuất lịch sử Excel
        </Button>
      </PageHeading>
      <StatCards stats={data.stats} />
      <section className="panel activity-panel">
        <div className="section-line">
          <div>
            <h3>Hoạt động 7 ngày gần đây</h3>
            <p>Đếm số từ khác nhau có câu trả lời được lưu trong mỗi ngày.</p>
          </div>
        </div>
        <ActivityChart days={data.stats.days} />
      </section>
      <div className="section-heading">
        <h2>Lịch sử phiên học</h2>
        <span className="muted">{data.history.length} phiên gần nhất</span>
      </div>
      <div className="filter-toolbar history-filters">
        <Field label="Từ ngày">
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        <Field label="Đến ngày">
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        <Field label="Chế độ">
          <select
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả chế độ</option>
            {Object.entries(modeNames).map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Trạng thái">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="completed">Hoàn thành</option>
            <option value="active">Đang học</option>
            <option value="abandoned">Đã dừng</option>
          </select>
        </Field>
      </div>
      {invalid ? (
        <div className="form-alert error">
          Ngày bắt đầu phải trước ngày kết thúc.
        </div>
      ) : filtered.length ? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Phiên học</th>
                  <th>Thời gian</th>
                  <th>Kết quả</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.slice((page - 1) * 15, page * 15).map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.title}</strong>
                      <small>{modeNames[s.mode]}</small>
                    </td>
                    <td>{date(s.createdAt, user.profile.timezone, true)}</td>
                    <td>
                      <strong>
                        {s.correct}/{s.answered} đúng
                      </strong>
                      <small>
                        {s.answered}/{s.total} câu đã trả lời ·{" "}
                        {s.accuracy == null
                          ? "Chưa có dữ liệu"
                          : `${s.accuracy}%`}
                      </small>
                    </td>
                    <td>
                      <Badge
                        color={s.status === "completed" ? "green" : "neutral"}
                      >
                        {s.status === "active"
                          ? "Đang học"
                          : statusNames[s.status]}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        onClick={() => go(`session/${s.id}`)}
                      >
                        {s.status === "active" ? "Tiếp tục" : "Xem kết quả"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 15 && (
            <div className="pagination">
              <Button
                variant="secondary"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Trang trước
              </Button>
              <span>
                {page}/{Math.ceil(filtered.length / 15)}
              </span>
              <Button
                variant="secondary"
                disabled={page * 15 >= filtered.length}
                onClick={() => setPage(page + 1)}
              >
                Trang sau
              </Button>
            </div>
          )}
        </>
      ) : (
        <Empty
          icon="chart"
          title="Chưa có phiên học phù hợp"
          description="Hãy bắt đầu học hoặc thử thay đổi bộ lọc."
        >
          <Button onClick={() => go("library")}>Bắt đầu học</Button>
        </Empty>
      )}
      <p className="data-note">
        Từ đã luyện và tỷ lệ trả lời đúng phản ánh hoạt động học, chưa đánh giá
        mức độ ghi nhớ lâu dài.
      </p>
    </>
  );
}
export function Profile() {
  const { user, refresh, notify, logout } = useApp();
  const p = user.profile;
  const [form, setForm] = useState({
    name: user.name,
    goal: p.pending?.goal || p.goal,
    timezone: p.pending?.timezone || p.timezone,
    reminder: p.reminder,
    reminderTime: p.reminderTime,
  });
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState(null);
  const [error, setError] = useState("");
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api("/profile", form, "PATCH");
      await refresh();
      notify(result.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="ĐIỀU CHỈNH NHỊP HỌC CỦA BẠN"
        title="Tài khoản & mục tiêu"
        description="Một kế hoạch vừa sức sẽ giúp bạn đi xa hơn."
      />
      <div className="profile-grid">
        <section className="profile-card panel">
          <div className="avatar large-avatar">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <Badge color="green">
            {user.role === "admin" ? "Quản trị viên" : "Người học Techcamp"}
          </Badge>
          <div className="profile-card-bottom">
            <span>Tham gia từ {date(user.createdAt)}</span>
            <Button
              variant="secondary"
              icon="lock"
              onClick={() =>
                setPassword({ current: "", password: "", confirm: "" })
              }
            >
              Đổi mật khẩu
            </Button>
          </div>
        </section>
        <form className="panel profile-form" onSubmit={save}>
          <h2>Thiết lập của bạn</h2>
          <Field label="Tên hiển thị">
            <input
              value={form.name}
              maxLength={80}
              required
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <div className="form-grid">
            <Field label="Mục tiêu mỗi ngày" hint="Từ 1 đến 100 từ mỗi ngày.">
              <input
                type="number"
                required
                min={1}
                max={100}
                value={form.goal}
                onChange={(e) =>
                  setForm({ ...form, goal: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Múi giờ">
              <select
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              >
                {[
                  "Asia/Ho_Chi_Minh",
                  "Asia/Bangkok",
                  "Asia/Tokyo",
                  "Asia/Singapore",
                  "Europe/London",
                  "America/New_York",
                  "UTC",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="settings-notice">
            <Icon name="info" size={18} />
            <p>
              Mục tiêu hiện tại: <strong>{p.goal} từ/ngày</strong>. Thay đổi mục
              tiêu và múi giờ có hiệu lực từ ngày kế tiếp.
              {p.pending && (
                <>
                  {" "}
                  Đã hẹn thay đổi từ{" "}
                  {p.pending.effectiveOn.split("-").reverse().join("/")}.
                </>
              )}
            </p>
          </div>
          <div className="reminder-setting">
            <div>
              <h3>Nhắc tôi dành thời gian học</h3>
              <p>
                Thông báo trong tài khoản khi chưa đạt mục tiêu hoặc có từ cần
                ôn.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-label="Bật nhắc học"
              aria-checked={form.reminder}
              className={`toggle ${form.reminder ? "on" : ""}`}
              onClick={() => setForm({ ...form, reminder: !form.reminder })}
            >
              <span />
            </button>
          </div>
          {form.reminder && (
            <Field label="Giờ nhắc học">
              <input
                type="time"
                required
                value={form.reminderTime}
                onChange={(e) =>
                  setForm({ ...form, reminderTime: e.target.value })
                }
              />
            </Field>
          )}
          {error && (
            <div className="form-alert error" role="alert">
              {error}
            </div>
          )}
          <div className="form-footer">
            <Button type="submit" busy={busy}>
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </div>
      {password && (
        <PasswordModal
          form={password}
          setForm={setPassword}
          onClose={() => setPassword(null)}
          onDone={logout}
        />
      )}
    </>
  );
}
function PasswordModal({ form, setForm, onClose, onDone }) {
  const { notify } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal title="Đổi mật khẩu" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          if (form.password !== form.confirm)
            return setError("Hai mật khẩu mới chưa khớp.");
          setBusy(true);
          try {
            const result = await api("/profile/password", form);
            notify(result.message);
            window.location.hash = "login";
            window.location.reload();
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {[
          ["current", "Mật khẩu hiện tại"],
          ["password", "Mật khẩu mới"],
          ["confirm", "Nhập lại mật khẩu mới"],
        ].map(([key, label]) => (
          <Field label={label} key={key}>
            <input
              type="password"
              required
              minLength={key === "current" ? undefined : 12}
              maxLength={128}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              autoComplete={
                key === "current" ? "current-password" : "new-password"
              }
            />
          </Field>
        ))}
        {error && <div className="form-alert error">{error}</div>}
        <div className="form-footer">
          <Button variant="secondary" type="button" onClick={onClose}>
            Hủy
          </Button>
          <Button busy={busy} type="submit">
            Đổi mật khẩu
          </Button>
        </div>
      </form>
    </Modal>
  );
}

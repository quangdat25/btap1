import { useEffect, useRef, useState } from "react";
import {
  api,
  useApp,
  Button,
  Badge,
  Empty,
  Field,
  IconButton,
  Modal,
  PageHeading,
  Progress,
  WordAudio,
  date,
  go,
  modeNames,
} from "../lib";
import Icon from "../components/Icon";

export function StartSession({ setId = "", mode = "new", onClose }) {
  const { data, refresh, notify } = useApp();
  const [form, setForm] = useState({
    setId,
    mode,
    size: data.config.sessionSize,
    type: "mixed",
    replace: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await api("/sessions", form);
      if (result.requestedSize && result.items.length < result.requestedSize)
        notify(
          `Bộ từ có ${result.items.length} từ phù hợp. Phiên dùng số từ thực tế.`,
        );
      await refresh();
      onClose();
      go(`session/${result.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={mode === "review" ? "Sẵn sàng ôn tập?" : "Một phiên học vừa sức"}
      subtitle="Chọn nội dung phù hợp với thời gian của bạn."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {data.active && (
          <div className="active-session-notice">
            <Icon name="play" size={21} />
            <div>
              <strong>Bạn đang có một phiên học dở</strong>
              <p>
                {data.active.title} · {data.active.answered}/{data.active.total}{" "}
                câu đã lưu
              </p>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.replace}
                  onChange={(e) =>
                    setForm({ ...form, replace: e.target.checked })
                  }
                />
                Kết thúc phiên này để bắt đầu phiên mới
              </label>
            </div>
          </div>
        )}
        <Field label="Chế độ học">
          <select
            value={form.mode}
            onChange={(e) => setForm({ ...form, mode: e.target.value })}
          >
            {Object.entries(modeNames).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Bộ từ">
          <select
            value={form.setId}
            onChange={(e) => setForm({ ...form, setId: e.target.value })}
          >
            <option value="">Tất cả bộ từ</option>
            {data.sets.map((s) => (
              <option value={s.id} key={s.id}>
                {s.name} · {s.level}
              </option>
            ))}
          </select>
        </Field>
        <div className="form-grid">
          <Field label="Số từ trong phiên">
            <input
              type="number"
              min={1}
              max={20}
              required
              value={form.size}
              onChange={(e) =>
                setForm({ ...form, size: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Dạng bài">
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="mixed">Kết hợp</option>
              <option value="choice">Chọn nghĩa đúng</option>
              <option value="typing">Nhập từ tiếng Anh</option>
            </select>
          </Field>
        </div>
        <p className="data-note">
          {form.mode === "practice"
            ? "Luyện thêm giúp bạn thực hành; lịch ôn hiện có được giữ nguyên."
            : form.mode === "review"
              ? "Chỉ những từ đã đến hạn mới được chọn. Không có từ đến hạn sẽ không tạo phiên."
              : "Chỉ chọn những từ chưa có câu trả lời được lưu."}
        </p>
        {error && (
          <div className="form-alert error" role="alert">
            {error}
          </div>
        )}
        <div className="form-footer">
          <Button type="button" variant="secondary" onClick={onClose}>
            Để sau
          </Button>
          <Button type="submit" icon="play" busy={busy}>
            {data.active && !form.replace
              ? "Tiếp tục phiên đang học"
              : "Bắt đầu phiên học"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function Flashcards({ id }) {
  const { data, refresh, notify } = useApp();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [onlyHard, setOnlyHard] = useState(false);
  const [start, setStart] = useState(false);
  const set = data.sets.find((s) => s.id === id);
  let words =
    id === "saved"
      ? data.savedWords.filter((w) => data.words.some((x) => x.id === w.id))
      : data.words.filter((w) => w.setIds.includes(id));
  if (onlyHard)
    words = words.filter((w) =>
      data.savedWords.some((x) => x.id === w.id && x.difficult),
    );
  const word = words[Math.min(index, words.length - 1)];
  const saved = word && data.saved.includes(word.id);
  const difficult =
    word && data.savedWords.find((w) => w.id === word.id)?.difficult;
  const change = (next) => {
    setIndex(next);
    setFlipped(false);
  };
  const save = async (hard) => {
    setBusy(true);
    try {
      await api("/saved", {
        wordId: word.id,
        saved: hard === undefined ? !saved : true,
        difficult: hard ?? false,
      });
      await refresh();
      notify(
        hard === undefined
          ? saved
            ? "Đã bỏ lưu từ."
            : "Đã lưu vào từ của tôi."
          : "Đã cập nhật đánh dấu từ khó.",
      );
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <a className="back-link" href={id === "saved" ? "#saved" : `#set/${id}`}>
        <Icon name="left" size={17} />
        {id === "saved" ? "Từ của tôi" : set?.name || "Bộ từ"}
      </a>
      <PageHeading
        eyebrow="HỌC BẰNG THẺ GHI NHỚ"
        title={
          id === "saved" ? "Những từ của riêng bạn" : set?.name || "Flashcard"
        }
        description="Nhìn từ, thử nhớ nghĩa, rồi lật thẻ để khám phá."
      >
        <button
          className={`filter-chip ${onlyHard ? "active" : ""}`}
          onClick={() => {
            setOnlyHard(!onlyHard);
            change(0);
          }}
        >
          <Icon name="flame" size={17} />
          Chỉ từ khó
        </button>
      </PageHeading>
      {word ? (
        <div className="flashcard-workspace">
          <div className="flashcard-topline">
            <Badge color="green">
              {index + 1} / {words.length} từ
            </Badge>
            <span>Không tính điểm khi xem thẻ</span>
          </div>
          <Progress value={index + 1} max={words.length} />
          <div className={`flashcard ${flipped ? "flipped" : ""}`}>
            <div className="flashcard-tools">
              <Badge color="neutral">{word.pos}</Badge>
              <div>
                <WordAudio word={word.word} audio={word.audio} />
                <button
                  className={`icon-btn ${saved ? "is-saved" : ""}`}
                  disabled={busy}
                  onClick={() => save()}
                  aria-label={saved ? "Bỏ lưu từ" : "Lưu từ"}
                >
                  <Icon name="bookmark" />
                </button>
              </div>
            </div>
            <button
              className="flashcard-content"
              onClick={() => setFlipped(!flipped)}
              aria-label={
                flipped ? "Lật về mặt từ tiếng Anh" : "Lật thẻ để xem nghĩa"
              }
            >
              <span className="eyebrow">
                {flipped ? "NGHĨA & CÁCH DÙNG" : "BẠN CÓ NHỚ NGHĨA CỦA TỪ NÀY?"}
              </span>
              <h2>{flipped ? word.meaning : word.word}</h2>
              <span className="phonetic">
                {flipped ? `${word.word} · ${word.ipa}` : word.ipa}
              </span>
              {flipped ? (
                <div className="flashcard-example">
                  <p>“{word.example}”</p>
                  <small>{word.translation}</small>
                </div>
              ) : (
                <p className="flip-hint">
                  <Icon name="rotate" size={17} />
                  Nhấn vào thẻ để xem nghĩa
                </p>
              )}
            </button>
            <div className="flashcard-bottom">
              <Icon name="layers" size={16} />
              <span>{flipped ? "Mặt nghĩa" : "Mặt từ"}</span>
            </div>
          </div>
          <div className="flashcard-controls">
            <Button
              variant="secondary"
              disabled={index === 0}
              onClick={() => change(index - 1)}
            >
              Từ trước
            </Button>
            <Button
              variant={difficult ? "soft" : "ghost"}
              icon="flame"
              busy={busy}
              onClick={() => save(!difficult)}
            >
              {difficult ? "Đã đánh dấu khó" : "Đánh dấu từ khó"}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                index + 1 >= words.length ? change(0) : change(index + 1)
              }
            >
              {index + 1 >= words.length ? "Xem lại từ đầu" : "Từ tiếp theo"}
            </Button>
          </div>
          <div className="flashcard-practice">
            <div>
              <strong>Sẵn sàng kiểm tra trí nhớ?</strong>
              <p>Thử một bài luyện để xem bạn nhớ được bao nhiêu.</p>
            </div>
            <Button icon="play" onClick={() => setStart(true)}>
              Luyện tập ngay
            </Button>
          </div>
        </div>
      ) : (
        <Empty
          icon="layers"
          title="Chưa có từ phù hợp"
          description="Thử bỏ bộ lọc hoặc lưu thêm những từ muốn học."
        >
          <Button
            onClick={() => {
              setOnlyHard(false);
              go("library");
            }}
          >
            Khám phá bộ từ
          </Button>
        </Empty>
      )}
      {start && (
        <StartSession
          setId={id === "saved" ? "" : id}
          onClose={() => setStart(false)}
        />
      )}
    </>
  );
}
export function Session({ id }) {
  const { refresh, notify, user, data } = useApp();
  const [session, setSession] = useState(null);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState(false);
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [start, setStart] = useState(false);
  const submitLock = useRef(false);
  const inputRef = useRef(null);
  const load = async () => {
    setLoadError("");
    try {
      const next = await api(`/sessions/${id}`);
      setSession(next);
      const first = next.items.findIndex((i) => !i.answer);
      setIndex(Math.max(0, first));
      setResult(next.status !== "active");
      setResponse("");
    } catch (e) {
      setLoadError(e.message);
    }
  };
  useEffect(() => {
    load();
  }, [id]);
  useEffect(() => {
    inputRef.current?.focus();
  }, [index, session?.id]);
  const submit = async (e) => {
    e.preventDefault();
    if (submitLock.current || !response.trim() || item.answer) return;
    submitLock.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await api(`/sessions/${id}/items/${item.id}/answer`, {
        response,
      });
      setSession(next);
      await refresh();
    } catch (e) {
      setError(e.message);
      if (e.status === 409) {
        await load();
        notify("Đã tải kết quả được lưu trước đó.");
      }
    } finally {
      setBusy(false);
      submitLock.current = false;
    }
  };
  if (loadError)
    return (
      <Empty icon="info" title="Chưa mở được phiên học" description={loadError}>
        <Button onClick={load}>Thử lại</Button>
        <Button variant="secondary" onClick={() => go("history")}>
          Xem lịch sử
        </Button>
      </Empty>
    );
  if (!session)
    return (
      <div className="loading-section">
        <span className="spinner" />
        Đang tải phiên học…
      </div>
    );
  const item = session.items[index];
  const advance = () => {
    if (index >= session.items.length - 1) setResult(true);
    else {
      setIndex(index + 1);
      setResponse("");
      setError("");
    }
  };
  if (result)
    return (
      <>
        <SessionResult session={session} onPractice={() => setStart(true)} />
        {start && (
          <StartSession
            mode="practice"
            setId={session.setId || ""}
            onClose={() => setStart(false)}
          />
        )}
      </>
    );
  return (
    <div className="quiz-workspace">
      <div className="quiz-top">
        <a className="back-link" href="#dashboard">
          <Icon name="left" size={17} />
          Lưu & về tổng quan
        </a>
        <Badge color="green">{modeNames[session.mode]}</Badge>
      </div>
      <div className="quiz-heading">
        <div>
          <span className="eyebrow">{session.title}</span>
          <h1>Một từ mới, một bước tiến</h1>
        </div>
        <span className="question-counter">
          {index + 1}
          <small> / {session.items.length}</small>
        </span>
      </div>
      <Progress value={session.answered} max={session.items.length} />
      <div className="quiz-saved">
        <Icon name="shield" size={14} />
        {session.answered}/{session.items.length} câu trả lời đã được lưu
      </div>
      <form onSubmit={submit}>
        <section className="question-card">
          <div className="question-type">
            <Icon name={item.type === "typing" ? "edit" : "layers"} size={17} />
            {item.type === "typing" ? "NHẬP TỪ TIẾNG ANH" : "CHỌN NGHĨA ĐÚNG"}
          </div>
          <h2>{item.prompt}</h2>
          {item.type === "choice" ? (
            <>
              <div className="question-word">
                <strong>{item.word.word}</strong>
                <WordAudio word={item.word.word} />
              </div>
              <p className="phonetic">{item.word.ipa}</p>
              <div className="answer-options">
                {item.options.map((option, i) => {
                  const selected =
                    (item.answer?.response || response) === option.id;
                  const correct =
                    item.answer && option.text === item.answer.correctAnswer;
                  return (
                    <button
                      type="button"
                      key={option.id}
                      disabled={Boolean(item.answer) || busy}
                      className={`answer-option ${selected ? "selected" : ""} ${correct ? "correct" : ""} ${item.answer && selected && !item.answer.correct ? "incorrect" : ""}`}
                      onClick={() => setResponse(option.id)}
                    >
                      <span className="option-letter">{"ABCD"[i]}</span>
                      <span>{option.text}</span>
                      {correct && <Icon name="check" size={19} />}
                      {item.answer && selected && !item.answer.correct && (
                        <Icon name="close" size={19} />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="typing-meaning">
                <strong>{item.word.meaning}</strong>
                <Badge color="neutral">{item.word.pos}</Badge>
              </div>
              <Field label="Câu trả lời của bạn">
                <input
                  ref={inputRef}
                  className="typing-answer"
                  value={item.answer?.response || response}
                  disabled={Boolean(item.answer) || busy}
                  maxLength={128}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="Nhập từ tiếng Anh…"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </Field>
            </>
          )}
          {item.answer && (
            <div
              className={`answer-feedback ${item.answer.correct ? "correct" : "incorrect"}`}
              role="status"
            >
              <span className="feedback-icon">
                <Icon
                  name={item.answer.correct ? "check" : "close"}
                  size={22}
                />
              </span>
              <div>
                <strong>
                  {item.answer.correct
                    ? "Chính xác! Thêm một bước tiến."
                    : "Chưa đúng, cùng ghi nhớ lại nhé."}
                </strong>
                <p>
                  {!item.answer.correct && (
                    <>
                      Đáp án: <b>{item.answer.correctAnswer}</b>.{" "}
                    </>
                  )}
                  {item.answer.explanation}
                </p>
                <small>
                  {item.answer.updatesSchedule
                    ? `Lần ôn tiếp theo: ${date(item.answer.nextDueAt, user.profile.timezone, true)}`
                    : "Lịch ôn hiện có được giữ nguyên."}
                </small>
              </div>
            </div>
          )}
          {error && (
            <div className="form-alert error" role="alert">
              <Icon name="info" size={18} />
              {error} Câu trả lời của bạn vẫn được giữ lại.
            </div>
          )}
        </section>
        <div className="quiz-bottom">
          <span>
            <Icon name="info" size={16} />
            {item.answer
              ? "Đã lưu câu trả lời."
              : "Cứ thử nhé, mỗi lần luyện là một lần tiến bộ."}
          </span>
          {item.answer ? (
            <Button type="button" onClick={advance}>
              {index + 1 >= session.items.length
                ? "Xem kết quả"
                : "Câu tiếp theo"}
            </Button>
          ) : (
            <Button type="submit" disabled={!response.trim()} busy={busy}>
              {error ? "Thử gửi lại" : "Kiểm tra đáp án"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
function SessionResult({ session, onPractice }) {
  const { user } = useApp();
  const wrong = session.items.filter((i) => i.answer && !i.answer.correct);
  const [all, setAll] = useState(false);
  return (
    <div className="result-workspace">
      <div className="result-hero">
        <span className="result-trophy">
          <Icon name="trophy" size={44} />
        </span>
        <span className="eyebrow">
          {session.status === "completed"
            ? "THÊM MỘT BƯỚC TIẾN HÔM NAY"
            : "NHỮNG BƯỚC TIẾN ĐÃ ĐƯỢC LƯU"}
        </span>
        <h1>
          {session.status === "completed"
            ? "Bạn đã làm được rồi!"
            : "Kết quả phiên đã dừng"}
        </h1>
        <p>
          {session.title} · {modeNames[session.mode]}
        </p>
        <div className="result-stats">
          <div>
            <strong>
              {session.correct}
              <small>/{session.answered}</small>
            </strong>
            <span>Câu trả lời đúng</span>
          </div>
          <div>
            <strong>
              {session.accuracy == null ? "—" : `${session.accuracy}%`}
            </strong>
            <span>Tỷ lệ trả lời đúng</span>
          </div>
          <div>
            <strong>{session.items.length - session.answered}</strong>
            <span>Câu chưa trả lời</span>
          </div>
        </div>
        <p className="result-date">
          <Icon name="calendar" size={16} />
          {date(
            session.completedAt || session.createdAt,
            user.profile.timezone,
            true,
          )}
        </p>
        <div className="result-actions">
          <Button icon="review" onClick={onPractice}>
            Luyện thêm một lần
          </Button>
          <Button variant="secondary" onClick={() => go("dashboard")}>
            Về tổng quan
          </Button>
        </div>
      </div>
      <div className="section-heading">
        <h2>{all ? "Tất cả câu trả lời" : "Những từ cần xem lại"}</h2>
        <button className="text-link" onClick={() => setAll(!all)}>
          {all ? "Chỉ xem câu sai" : "Xem tất cả câu"}
        </button>
      </div>
      {(all ? session.items : wrong).length ? (
        <div className="result-answers">
          {(all ? session.items : wrong).map((item) => (
            <div className="result-answer-row" key={item.id}>
              <span
                className={`result-status-icon ${item.answer ? (item.answer.correct ? "correct" : "incorrect") : ""}`}
              >
                <Icon
                  name={
                    item.answer
                      ? item.answer.correct
                        ? "check"
                        : "close"
                      : "clock"
                  }
                  size={19}
                />
              </span>
              <div>
                <h3>
                  {item.answer?.word?.word ||
                    item.word.word ||
                    item.word.meaning}
                </h3>
                <p>{item.answer ? item.answer.word.meaning : "Chưa trả lời"}</p>
                {item.answer && <small>{item.answer.word.example}</small>}
              </div>
              {item.answer && (
                <span className="next-review">
                  {item.answer.nextDueAt
                    ? `Ôn tiếp: ${date(item.answer.nextDueAt, user.profile.timezone, true)}`
                    : "Luyện thêm · giữ lịch ôn"}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty
            icon="check"
            title={
              session.answered
                ? "Tất cả câu đã trả lời đều chính xác"
                : "Phiên này chưa có câu trả lời"
            }
            description={
              session.answered
                ? "Hẹn gặp bạn trong lần ôn tiếp theo!"
                : "Bắt đầu phiên mới để luyện tập nhé."
            }
          />
        </div>
      )}
      <p className="data-note">
        Tỷ lệ đúng = số câu đúng / số câu đã trả lời. Kết quả phản ánh phiên
        luyện tập, chưa đánh giá mức độ ghi nhớ lâu dài.
      </p>
    </div>
  );
}

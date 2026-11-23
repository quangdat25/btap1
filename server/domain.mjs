export const normalize = (value) =>
  String(value ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("en-US");
export const intervals = [1, 3, 7, 14, 30];
export function schedule(previous, correct, now, config = {}) {
  const stage = correct ? Math.min((previous?.stage ?? 0) + 1, 5) : 0;
  const delay = correct
    ? (config.intervals ?? intervals)[stage - 1] * 86400000
    : (config.retryMinutes ?? 10) * 60000;
  return { stage, dueAt: new Date(now + delay).toISOString() };
}
export function localDay(time = Date.now(), timezone = "Asia/Ho_Chi_Minh") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(time));
}
export function percent(correct, total) {
  return total ? Math.round((correct / total) * 1000) / 10 : null;
}
// Check ZIP directory sizes before decompressing untrusted spreadsheets.
export function validateXlsxArchive(bytes) {
  const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0 || end + 22 > bytes.length)
    throw new Error("Invalid XLSX archive");
  const entries = bytes.readUInt16LE(end + 10);
  const centralSize = bytes.readUInt32LE(end + 12);
  let offset = bytes.readUInt32LE(end + 16);
  if (!entries || entries > 4000 || offset + centralSize > end)
    throw new Error("Invalid XLSX archive");
  let inflated = 0;
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50)
      throw new Error("Invalid XLSX directory");
    const size = bytes.readUInt32LE(offset + 24);
    inflated += size;
    if (
      size > 32 * 1024 * 1024 ||
      inflated > 64 * 1024 * 1024 ||
      bytes.readUInt16LE(offset + 8) & 1
    )
      throw new Error("XLSX decompression limit exceeded");
    offset +=
      46 +
      bytes.readUInt16LE(offset + 28) +
      bytes.readUInt16LE(offset + 30) +
      bytes.readUInt16LE(offset + 32);
  }
}
export const publicWord = ({ accepted, explanation, question, ...word }) =>
  word;
export function publicItem(item) {
  const { word, correctOption, ...rest } = item;
  return {
    ...rest,
    word: {
      id: word.id,
      word: item.type === "choice" ? word.word : undefined,
      ipa: item.type === "choice" ? word.ipa : undefined,
      pos: word.pos,
      meaning: item.type === "typing" ? word.meaning : undefined,
    },
    prompt:
      word.question ||
      (item.type === "choice"
        ? `“${word.word}” có nghĩa là gì?`
        : "Nhập từ tiếng Anh phù hợp với nghĩa sau"),
  };
}

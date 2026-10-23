/** RFC 4180 style CSV. BOM, CRLF, embedded commas/newlines and escaped quotes are supported. */
export function parseCSV(text) {
  if (typeof text !== "string") throw Error("请上传 CSV 文本");
  text = text.replace(/^\uFEFF/, "");
  const records = [];
  let row = [],
    cell = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
      continue;
    }
    if (c === '"') {
      if (cell || closed) throw Error("CSV 引号位置不正确");
      quoted = true;
      continue;
    }
    if (c === "," || c === "\n" || c === "\r") {
      row.push(cell);
      cell = "";
      closed = false;
      if (c !== ",") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        if (row.some((x) => x.trim())) records.push(row);
        row = [];
      }
      continue;
    }
    if (closed) throw Error("CSV 引号后只能是分隔符");
    cell += c;
  }
  if (quoted) throw Error("CSV 存在未闭合的引号");
  row.push(cell);
  if (row.some((x) => x.trim())) records.push(row);
  if (records.length < 2) throw Error("CSV 至少需要表头和一行成绩");
  const headers = records.shift().map((x) => x.trim());
  if (new Set(headers).size !== headers.length || headers.some((x) => !x))
    throw Error("CSV 表头为空或重复");
  return records.map((values, index) => {
    if (values.length !== headers.length)
      throw Error(`CSV 第 ${index + 2} 行列数不一致`);
    return Object.fromEntries(headers.map((key, i) => [key, values[i].trim()]));
  });
}
export function serializeCSV(headers, records) {
  const escape = (value) => {
    let s = String(value ?? "");
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
  };
  return (
    "\uFEFF" +
    [headers, ...records.map((r) => headers.map((h) => r[h]))]
      .map((r) => r.map(escape).join(","))
      .join("\r\n")
  );
}

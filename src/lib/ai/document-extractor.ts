import { inflateRawSync, inflateSync } from "node:zlib";

const MAX_TEXT_BYTES = 10 * 1024 * 1024;

/**
 * Extract readable text from an uploaded document without external parsing
 * libraries (this deployment has no npm-available pdf/docx packages).
 *
 * Supported: plain text, CSV, markdown, PDF (best-effort), DOCX (ZIP).
 * Throws a descriptive error when the format cannot be parsed so callers can
 * surface a failed indexing state instead of silently storing an empty source.
 */
export async function extractTextFromFile(file: File): Promise<string> {
  if (file.size === 0) {
    throw new Error("File is empty.");
  }
  if (file.size > MAX_TEXT_BYTES) {
    throw new Error(`File exceeds the ${Math.floor(MAX_TEXT_BYTES / 1024 / 1024)}MB text-extraction limit.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (mime === "text/plain" || name.endsWith(".txt")) {
    return decodeUtf8(buffer);
  }
  if (mime === "text/csv" || name.endsWith(".csv")) {
    return csvToText(buffer);
  }
  if (mime === "text/markdown" || name.endsWith(".md")) {
    return decodeUtf8(buffer);
  }
  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    return extractPdfText(buffer);
  }
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || name.endsWith(".docx")) {
    return extractDocxText(buffer);
  }
  throw new Error(`Unsupported file type "${mime || name}". Expected PDF, DOCX, TXT, CSV, or MD.`);
}

function decodeUtf8(buffer: Buffer): string {
  const text = buffer
    .toString("utf8")
    .replace(/^\uFEFF/, "")
    .trim();
  if (text.length < 10) {
    throw new Error("No readable text found in the file.");
  }
  return text;
}

/** Convert CSV rows into sentence-like lines so embeddings capture meaning. */
function csvToText(buffer: Buffer): string {
  const text = decodeUtf8(buffer);
  const rows = text
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter(Boolean);

  if (rows.length === 0) {
    throw new Error("No readable rows found in the CSV file.");
  }

  const header = rows[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
  const lines: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const values = parseCsvRow(rows[i]);
    const pairs = header.map((h, idx) => (h ? `${h}: ${values[idx] ?? ""}` : (values[idx] ?? ""))).filter(Boolean);
    if (pairs.length > 0) {
      lines.push(pairs.join(", "));
    }
  }

  const result = lines.join("\n");
  if (result.trim().length < 10) {
    throw new Error("No usable content found in the CSV file.");
  }
  return result;
}

function parseCsvRow(row: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (inQuotes) {
      if (ch === '"') {
        if (row[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      values.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values;
}

/**
 * Best-effort PDF text extraction. Handles the common case: FlateDecode
 * content streams and text-showing operators (Tj / TJ). Non-extractable PDFs
 * (scanned images, exotic filters) throw so indexing is marked failed.
 */
function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const chunks: string[] = [];

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (const match of raw.matchAll(streamRegex)) {
    const data = Buffer.from(match[1], "latin1");
    const inflated = tryInflate(data);
    const content = inflated ? extractTextOperators(inflated) : extractTextOperators(data);
    if (content.trim().length > 0) {
      chunks.push(content);
    }
  }

  const text = chunks
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length < 10) {
    throw new Error("No extractable text found in the PDF. It may be a scanned image document.");
  }
  return text;
}

function tryInflate(data: Buffer): Buffer | null {
  try {
    return inflateSync(data);
  } catch {
    try {
      return inflateRawSync(data);
    } catch {
      return null;
    }
  }
}

/** Pull strings from Tj / TJ text operators in a content stream. */
function extractTextOperators(stream: Buffer): string {
  const content = stream.toString("latin1");
  const lines: string[] = [];

  const btRegex = /BT([\s\S]*?)ET/g;
  for (const btMatch of content.matchAll(btRegex)) {
    const block = btMatch[1];
    const stringRegex = /\(((?:\\.|[^\\()])*)\)\s*(Tj|TJ)/g;
    for (const strMatch of block.matchAll(stringRegex)) {
      const decoded = decodePdfString(strMatch[1]);
      if (decoded) {
        lines.push(decoded);
      }
    }
  }

  return lines.join(" ");
}

function decodePdfString(escaped: string): string {
  let out = "";
  for (let i = 0; i < escaped.length; i++) {
    const ch = escaped[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = escaped[i + 1];
    switch (next) {
      case "n":
        out += "\n";
        i++;
        break;
      case "r":
        out += "\r";
        i++;
        break;
      case "t":
        out += "\t";
        i++;
        break;
      case "b":
        out += "\b";
        i++;
        break;
      case "f":
        out += "\f";
        i++;
        break;
      case "(":
        out += "(";
        i++;
        break;
      case ")":
        out += ")";
        i++;
        break;
      case "\\":
        out += "\\";
        i++;
        break;
      default: {
        // Possibly an octal escape (\ddd)
        const oct = /^[0-7]{1,3}/.exec(escaped.slice(i + 1));
        if (oct) {
          out += String.fromCharCode(Number.parseInt(oct[0], 8));
          i += oct[0].length;
        } else {
          out += next;
          i++;
        }
      }
    }
  }
  return out.replace(/\r/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Minimal DOCX (ZIP) reader. Locates the `word/document.xml` entry via the
 * central directory and inflates it (deflate or stored), then strips XML
 * markup to readable paragraphs.
 */
function extractDocxText(buffer: Buffer): string {
  const xml = extractZipEntry(buffer, "word/document.xml");
  if (!xml) {
    throw new Error("No document body found in the DOCX file (word/document.xml missing).");
  }
  const text = xmlToText(xml);
  if (text.trim().length < 10) {
    throw new Error("No extractable text found in the DOCX file.");
  }
  return text;
}

function extractZipEntry(buffer: Buffer, target: string): string | null {
  const eocd = findEndOfCentralDirectory(buffer);
  if (!eocd) throw new Error("Invalid DOCX file (ZIP end-of-central-directory not found).");

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  for (let i = 0; i < entryCount; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("Corrupt ZIP central directory.");
    const method = buffer.readUInt16LE(offset + 10);
    const compSize = buffer.readUInt32LE(offset + 20);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLen);

    if (name === target) {
      return inflateZipLocalEntry(buffer, localOffset, method, compSize);
    }

    offset += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

function inflateZipLocalEntry(buffer: Buffer, localOffset: number, method: number, compSize: number): string | null {
  if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("Corrupt ZIP local file header.");
  const nameLen = buffer.readUInt16LE(localOffset + 26);
  const extraLen = buffer.readUInt16LE(localOffset + 28);
  const data = buffer.subarray(localOffset + 30 + nameLen + extraLen, localOffset + 30 + nameLen + extraLen + compSize);

  let inflated: Buffer;
  try {
    inflated = method === 0 ? data : inflateRawSync(data);
  } catch {
    throw new Error("Failed to decompress DOCX content stream.");
  }
  return inflated.toString("utf8").replace(/^\uFEFF/, "");
}

function findEndOfCentralDirectory(buffer: Buffer): number | null {
  const min = buffer.length - 22 - 65535;
  const start = Math.max(0, min);
  for (let i = buffer.length - 22; i >= start; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      return i;
    }
  }
  return null;
}

/** Convert word/document.xml into paragraph-separated text. */
function xmlToText(xml: string): string {
  const withBreaks = xml
    .replace(/<\/w:p>/g, "\n\n")
    .replace(/<\/w:tab>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return withBreaks;
}

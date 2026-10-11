/**
 * Lightweight, robust, RFC-4180 compliant CSV, JSON, and JSONL parser.
 * Zero external dependencies.
 */

export interface ParsedRawData {
  columns: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

/**
 * Sniff the most probable delimiter from the first few lines of a CSV string.
 */
export function sniffDelimiter(sampleText: string): string {
  const lines = sampleText.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0).slice(0, 5);
  if (lines.length === 0) return ",";

  const candidates = [",", "\t", ";", "|"];
  let bestDelimiter = ",";
  let maxConsistentCount = 0;

  for (const delim of candidates) {
    const counts = lines.map((line) => {
      // Split ignoring quotes for a rough count
      let insideQuote = false;
      let count = 0;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') insideQuote = !insideQuote;
        else if (line[i] === delim && !insideQuote) count++;
      }
      return count;
    });

    const firstCount = counts[0];
    const isConsistent = counts.every((c) => c === firstCount && c > 0);
    if (isConsistent && firstCount > maxConsistentCount) {
      maxConsistentCount = firstCount;
      bestDelimiter = delim;
    }
  }

  return bestDelimiter;
}

/**
 * Parse raw CSV text into columns and row objects.
 */
export function parseCSV(text: string, customDelimiter?: string): ParsedRawData {
  if (!text || !text.trim()) {
    return { columns: [], rows: [], totalRows: 0 };
  }

  const delimiter = customDelimiter || sniffDelimiter(text);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i += 2;
        continue;
      }
      if (char === '"') {
        inQuotes = false;
        i++;
        continue;
      }
      currentField += char;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (char === delimiter) {
      currentRow.push(currentField.trim());
      currentField = "";
      i++;
      continue;
    }

    if (char === "\r" || char === "\n") {
      currentRow.push(currentField.trim());
      currentField = "";
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];

      if (char === "\r" && nextChar === "\n") {
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    currentField += char;
    i++;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) {
    return { columns: [], rows: [], totalRows: 0 };
  }

  // Header row
  const rawHeaders = rows[0].map((h, idx) => h || `Column_${idx + 1}`);
  const dataRows = rows.slice(1);

  const parsedObjects: Record<string, string>[] = [];
  for (const row of dataRows) {
    const obj: Record<string, string> = {};
    for (let h = 0; h < rawHeaders.length; h++) {
      obj[rawHeaders[h]] = row[h] ?? "";
    }
    parsedObjects.push(obj);
  }

  return {
    columns: rawHeaders,
    rows: parsedObjects,
    totalRows: parsedObjects.length,
  };
}

/**
 * Parse JSON or JSONL text into uniform rows and columns.
 */
export function parseJSON(text: string): ParsedRawData {
  const trimmed = text.trim();
  if (!trimmed) {
    return { columns: [], rows: [], totalRows: 0 };
  }

  let items: Record<string, unknown>[] = [];

  // Check if standard JSON
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        items = parsed.filter((item) => typeof item === "object" && item !== null);
      } else if (typeof parsed === "object" && parsed !== null) {
        // Envelopes like { transactions: [...] }
        const candidateKeys = ["transactions", "events", "data", "records", "rows"];
        for (const k of candidateKeys) {
          if (Array.isArray(parsed[k])) {
            items = parsed[k];
            break;
          }
        }
        if (items.length === 0) {
          items = [parsed];
        }
      }
    } catch {
      // Fallback to JSONL
      items = [];
    }
  }

  // If not standard JSON, try JSONL
  if (items.length === 0) {
    const lines = trimmed.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (typeof parsed === "object" && parsed !== null) {
          items.push(parsed);
        }
      } catch {
        // Skip unparseable line
      }
    }
  }

  if (items.length === 0) {
    return { columns: [], rows: [], totalRows: 0 };
  }

  // Discover all unique keys across rows
  const colSet = new Set<string>();
  for (const item of items) {
    for (const key of Object.keys(item)) {
      colSet.add(key);
    }
  }
  const columns = Array.from(colSet);

  const rows: Record<string, string>[] = items.map((item) => {
    const row: Record<string, string> = {};
    for (const col of columns) {
      const val = item[col];
      if (val === null || val === undefined) {
        row[col] = "";
      } else if (typeof val === "object") {
        row[col] = JSON.stringify(val);
      } else {
        row[col] = String(val);
      }
    }
    return row;
  });

  return {
    columns,
    rows,
    totalRows: rows.length,
  };
}

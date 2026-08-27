/**
 * Browser-side file reading for the Import Center.
 *
 * The file is parsed locally so the person can see and confirm exactly what
 * will be saved before anything reaches their workspace.
 */

import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface ParsedFile {
  headers: string[];
  rows: Record<string, unknown>[];
  fileName: string;
  fileType: "csv" | "xlsx" | "json";
}

const MAX_ROWS = 5_000;

function fromObjects(objects: Record<string, unknown>[]): { headers: string[]; rows: Record<string, unknown>[] } {
  const headers: string[] = [];
  for (const object of objects) {
    for (const key of Object.keys(object)) if (!headers.includes(key)) headers.push(key);
  }
  return { headers, rows: objects.slice(0, MAX_ROWS) };
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".json")) {
    const text = await file.text();
    const parsed: unknown = JSON.parse(text);
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { data?: unknown })?.data)
        ? ((parsed as { data: unknown[] }).data)
        : null;
    if (!list) throw new Error("This file doesn't contain a list of entries.");
    const objects = list.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
    if (!objects.length) throw new Error("This file doesn't contain any entries we can read.");
    return { ...fromObjects(objects), fileName: file.name, fileType: "json" };
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const book = XLSX.read(buffer, { cellDates: true });
    const sheetName = book.SheetNames[0];
    if (!sheetName) throw new Error("This spreadsheet has no sheets.");
    const objects = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[sheetName]!, { defval: "" });
    if (!objects.length) throw new Error("That sheet is empty.");
    return { ...fromObjects(objects), fileName: file.name, fileType: "xlsx" };
  }

  const text = await file.text();
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });
  const objects = (result.data ?? []).filter((row) => row && Object.keys(row).length > 0);
  if (!objects.length) throw new Error("We couldn't find any rows in that file.");
  return {
    headers: (result.meta.fields ?? []).filter(Boolean),
    rows: objects.slice(0, MAX_ROWS),
    fileName: file.name,
    fileType: "csv",
  };
}

/** Reads a screenshot into a data URL for on-screen confirmation. */
export function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("We couldn't open that image."));
    reader.readAsDataURL(file);
  });
}

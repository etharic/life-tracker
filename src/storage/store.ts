/** A file in the journal, path relative to Journal/ with forward slashes. */
export interface StoredFile {
  path: string;
  /** Milliseconds since epoch, as reported by the file system. */
  modified: number;
  size: number;
}

/**
 * Everything the app reads and writes goes through this interface, so the plain
 * folder stays the single source of truth whatever sits behind it.
 */
export interface Store {
  list(): Promise<StoredFile[]>;
  readText(path: string): Promise<string | null>;
  writeText(path: string, text: string): Promise<void>;
  readBase64(path: string): Promise<string | null>;
  writeBase64(path: string, data: string): Promise<void>;
  /** Copies a file from outside the journal (picker, cache) into it. */
  importFile(sourceUri: string, path: string): Promise<void>;
  remove(path: string): Promise<void>;
  exists(path: string): boolean;
  /** A file:// URI for displaying or playing a file. */
  uri(path: string): string;
  md5(path: string): Promise<string | null>;
}

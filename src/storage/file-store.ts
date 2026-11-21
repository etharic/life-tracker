import { Directory, File, Paths } from 'expo-file-system';

import type { Store, StoredFile } from './store';

/**
 * The journal as real files in the app's Documents folder. With file sharing enabled the
 * folder shows up in the Files app (On My iPhone > Life-Tracker > Journal).
 */
export class FileStore implements Store {
  readonly root: Directory;

  constructor(root = new Directory(Paths.document, 'Journal')) {
    this.root = root;
    this.root.create({ idempotent: true, intermediates: true });
  }

  private file(path: string): File {
    return new File(this.root, ...path.split('/'));
  }

  /** The file object itself (with its folders created), for streaming uploads and downloads. */
  fileRef(path: string): File {
    return this.ensureParent(path);
  }

  private ensureParent(path: string): File {
    const parts = path.split('/');
    if (parts.length > 1)
      new Directory(this.root, ...parts.slice(0, -1)).create({ idempotent: true, intermediates: true });
    return this.file(path);
  }

  async list(): Promise<StoredFile[]> {
    const out: StoredFile[] = [];
    const walk = (dir: Directory, prefix: string) => {
      for (const item of dir.list()) {
        if (item.name.startsWith('.')) continue;
        if (item instanceof Directory) walk(item, `${prefix}${item.name}/`);
        else out.push({ path: `${prefix}${item.name}`, modified: item.modificationTime ?? 0, size: item.size });
      }
    };
    walk(this.root, '');
    return out;
  }

  async readText(path: string): Promise<string | null> {
    const f = this.file(path);
    return f.exists ? f.text() : null;
  }

  async writeText(path: string, text: string): Promise<void> {
    // Write to a temporary file first, then move it into place, so a crash never leaves half a file.
    const target = this.ensureParent(path);
    const tmp = new File(target.parentDirectory, `.${target.name}.tmp`);
    if (tmp.exists) tmp.delete();
    tmp.create();
    await tmp.write(text);
    await tmp.move(target, { overwrite: true });
  }

  async readBase64(path: string): Promise<string | null> {
    const f = this.file(path);
    return f.exists ? f.base64() : null;
  }

  async writeBase64(path: string, data: string): Promise<void> {
    const target = this.ensureParent(path);
    if (target.exists) target.delete();
    target.create();
    await target.write(data, { encoding: 'base64' });
  }

  async importFile(sourceUri: string, path: string): Promise<void> {
    const target = this.ensureParent(path);
    await new File(sourceUri).copy(target, { overwrite: true });
  }

  async remove(path: string): Promise<void> {
    const f = this.file(path);
    if (f.exists) f.delete();
  }

  exists(path: string): boolean {
    return this.file(path).exists;
  }

  uri(path: string): string {
    return this.file(path).uri;
  }

  async md5(path: string): Promise<string | null> {
    const f = this.file(path);
    return f.exists ? f.digest('MD5') : null;
  }
}

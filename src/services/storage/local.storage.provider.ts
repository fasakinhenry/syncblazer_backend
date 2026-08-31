import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/config/env.ts";
import type { StorageProvider, StoredObjectRef } from "@/services/storage/storage.provider.ts";

const uploadRoot = path.resolve(process.cwd(), env.uploadDir);

export class LocalStorageProvider implements StorageProvider {
  async save(file: { buffer: Buffer; originalName: string; mimeType: string }): Promise<StoredObjectRef> {
    await mkdir(uploadRoot, { recursive: true });
    const ext = path.extname(file.originalName);
    const key = `${randomUUID()}${ext}`;
    await writeFile(path.join(uploadRoot, key), file.buffer);

    return { key, size: file.buffer.byteLength, mimeType: file.mimeType };
  }

  getReadStreamPath(key: string): string {
    return path.join(uploadRoot, key);
  }

  async delete(key: string): Promise<void> {
    await unlink(path.join(uploadRoot, key)).catch(() => undefined);
  }
}

export const storageProvider: StorageProvider = new LocalStorageProvider();

export interface StoredObjectRef {
  key: string;
  size: number;
  mimeType: string;
}

/**
 * Abstraction over where "cloud fallback" transfer assets are persisted.
 * SyncBlaze prefers direct local/LAN transfer between paired devices, which
 * never touches this provider. This only backs the cloud relay path
 * (section 62-65 / 71-72 of the product brief) and future providers
 * (S3, Cloudflare R2, Supabase Storage) should implement the same interface.
 */
export interface StorageProvider {
  save(file: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
  }): Promise<StoredObjectRef>;

  getReadStreamPath(key: string): string;

  delete(key: string): Promise<void>;
}

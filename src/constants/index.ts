export const TransferStatus = {
  CREATED: "created",
  QUEUED: "queued",
  CONNECTING: "connecting",
  TRANSFERRING: "transferring",
  COMPLETED: "completed",
  FAILED: "failed",
  RETRYING: "retrying",
  CANCELLED: "cancelled",
} as const;
export type TransferStatus = (typeof TransferStatus)[keyof typeof TransferStatus];

export const TransferType = {
  FILE: "file",
  IMAGE: "image",
  TEXT: "text",
  LINK: "link",
} as const;
export type TransferType = (typeof TransferType)[keyof typeof TransferType];

export const TransferMethod = {
  LOCAL: "local",
  CLOUD: "cloud",
} as const;
export type TransferMethod = (typeof TransferMethod)[keyof typeof TransferMethod];

export const DeviceType = {
  DESKTOP: "desktop",
  LAPTOP: "laptop",
  MOBILE: "mobile",
  TABLET: "tablet",
} as const;
export type DeviceType = (typeof DeviceType)[keyof typeof DeviceType];

export const DevicePlatform = {
  WINDOWS: "windows",
  MACOS: "macos",
  LINUX: "linux",
  IOS: "ios",
  ANDROID: "android",
  WEB: "web",
} as const;
export type DevicePlatform = (typeof DevicePlatform)[keyof typeof DevicePlatform];

export const DeviceStatus = {
  ONLINE: "online",
  OFFLINE: "offline",
} as const;
export type DeviceStatus = (typeof DeviceStatus)[keyof typeof DeviceStatus];

export const RoomType = {
  PERSONAL: "personal",
  PROJECT: "project",
  TEMPORARY: "temporary",
  SHARED: "shared",
} as const;
export type RoomType = (typeof RoomType)[keyof typeof RoomType];

export const ActivityType = {
  TRANSFER: "transfer",
  NOTE_CREATED: "note_created",
  NOTE_UPDATED: "note_updated",
  NOTE_DELETED: "note_deleted",
  DEVICE_CONNECTED: "device_connected",
  DEVICE_REMOVED: "device_removed",
  MEMBER_JOINED: "member_joined",
} as const;
export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];

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
  MEMBER_REMOVED: "member_removed",
  ROOM_CREATED: "room_created",
} as const;
export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];

// Per-recipient notifications — distinct from ActivityType above, which is a
// room-scoped log keyed by the actor. A notification is always keyed by who
// should SEE it, which is a different (sometimes overlapping) set of people.
export const NotificationType = {
  MEMBER_JOINED: "member_joined",
  MEMBER_REMOVED: "member_removed",
  DEVICE_JOINED: "device_joined",
  NOTE_SHARED: "note_shared",
  NOTE_UPDATED: "note_updated",
  NOTE_DELETED: "note_deleted",
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const NotificationCategory = {
  ROOMS: "rooms",
  DEVICES: "devices",
  NOTES: "notes",
} as const;
export type NotificationCategory = (typeof NotificationCategory)[keyof typeof NotificationCategory];

export const NOTIFICATION_CATEGORY_BY_TYPE: Record<NotificationType, NotificationCategory> = {
  [NotificationType.MEMBER_JOINED]: NotificationCategory.ROOMS,
  [NotificationType.MEMBER_REMOVED]: NotificationCategory.ROOMS,
  [NotificationType.DEVICE_JOINED]: NotificationCategory.DEVICES,
  [NotificationType.NOTE_SHARED]: NotificationCategory.NOTES,
  [NotificationType.NOTE_UPDATED]: NotificationCategory.NOTES,
  [NotificationType.NOTE_DELETED]: NotificationCategory.NOTES,
};

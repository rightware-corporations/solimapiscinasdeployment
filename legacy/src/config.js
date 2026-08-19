import path from "node:path";

const root = process.cwd();
export const config = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || "development",
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
  sessionSecret: process.env.SESSION_SECRET || "development-only-change-me-32-characters",
  adminEmail: process.env.ADMIN_EMAIL || "admin@solima.co.mz",
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || "",
  storageRoot: path.resolve(process.env.STORAGE_ROOT || path.join(root, "storage")),
  retentionDays: Number(process.env.UPLOAD_RETENTION_DAYS || 90),
  whatsappMode: process.env.WHATSAPP_MODE || "link",
  whatsappNumber: process.env.WHATSAPP_STAFF_NUMBER || "258824407120",
  emailEnabled: process.env.EMAIL_NOTIFICATIONS_ENABLED === "true",
  captchaEnabled: process.env.CAPTCHA_ENABLED === "true",
  allowedOrigin: process.env.APP_BASE_URL || "http://localhost:3000"
};

import os from "node:os";
import path from "node:path";
import { z } from "zod";

const boolean = (fallback) => z.preprocess((value) => {
  if (value === undefined || value === "") return undefined;
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return value;
}, z.boolean().default(fallback));

const integer = (fallback, minimum, maximum) => z.coerce.number().int().min(minimum).max(maximum).default(fallback);
const optional = (rule = z.string()) => z.preprocess((value) => value === "" ? undefined : value, rule.optional());

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: integer(3000, 1, 65535),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1).default("file:./dev.db"),
  STORAGE_ROOT: optional(z.string().min(1)),
  MEDIA_RETENTION_HOURS: integer(72, 1, 24 * 31),
  PRIVACY_POLICY_VERSION: z.string().min(1).max(100).default("local-draft-v1"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  WHATSAPP_ENABLED: boolean(false),
  WHATSAPP_ACCESS_TOKEN: optional(),
  WHATSAPP_PHONE_NUMBER_ID: optional(),
  WHATSAPP_DESTINATION_NUMBER: optional(),
  WHATSAPP_API_VERSION: optional(z.string().regex(/^v\d+\.\d+$/)),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: optional(z.string().min(16)),
  META_APP_SECRET: optional(z.string().min(16)),
  WHATSAPP_SUMMARY_TEMPLATE_NAME: optional(z.string().min(1)),
  WHATSAPP_IMAGE_TEMPLATE_NAME: optional(z.string().min(1)),
  WHATSAPP_TEMPLATE_LANGUAGE: optional(z.string().min(2).max(20)),
  WHATSAPP_BUSINESS_ACCOUNT_ID: optional(),
  TRUST_PROXY: boolean(false),
  DELIVERY_RECOVERY_INTERVAL_MS: integer(180_000, 30_000, 3_600_000),
  PROVIDER_TIMEOUT_MS: integer(10_000, 1_000, 60_000)
});

export function loadConfig(environment = process.env) {
  const parsed = schema.safeParse(environment);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  }
  const value = parsed.data;
  const missing = [];
  if (value.NODE_ENV === "production") {
    for (const key of ["APP_BASE_URL", "DATABASE_URL", "STORAGE_ROOT", "MEDIA_RETENTION_HOURS", "PRIVACY_POLICY_VERSION"]) {
      if (environment[key] === undefined || environment[key] === "") missing.push(key);
    }
    if (!value.WHATSAPP_ENABLED) missing.push("WHATSAPP_ENABLED=true");
    for (const key of [
      "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_DESTINATION_NUMBER",
      "WHATSAPP_API_VERSION", "WHATSAPP_WEBHOOK_VERIFY_TOKEN", "META_APP_SECRET",
      "WHATSAPP_SUMMARY_TEMPLATE_NAME", "WHATSAPP_IMAGE_TEMPLATE_NAME", "WHATSAPP_TEMPLATE_LANGUAGE"
    ]) if (!value[key]) missing.push(key);
  }
  if (missing.length) throw new Error(`Missing production configuration: ${missing.join(", ")}`);

  return Object.freeze({
    nodeEnv: value.NODE_ENV,
    isProduction: value.NODE_ENV === "production",
    port: value.PORT,
    appBaseUrl: value.APP_BASE_URL,
    databaseUrl: value.DATABASE_URL,
    storageRoot: path.resolve(value.STORAGE_ROOT || path.join(process.cwd(), "storage", "pending-media")),
    rawUploadRoot: path.join(os.tmpdir(), "solima-raw-uploads"),
    mediaRetentionHours: value.MEDIA_RETENTION_HOURS,
    privacyPolicyVersion: value.PRIVACY_POLICY_VERSION,
    logLevel: value.LOG_LEVEL,
    whatsapp: Object.freeze({
      enabled: value.WHATSAPP_ENABLED,
      accessToken: value.WHATSAPP_ACCESS_TOKEN || "",
      phoneNumberId: value.WHATSAPP_PHONE_NUMBER_ID || "",
      destinationNumber: value.WHATSAPP_DESTINATION_NUMBER || "",
      apiVersion: value.WHATSAPP_API_VERSION || "",
      webhookVerifyToken: value.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "",
      appSecret: value.META_APP_SECRET || "",
      summaryTemplateName: value.WHATSAPP_SUMMARY_TEMPLATE_NAME || "",
      imageTemplateName: value.WHATSAPP_IMAGE_TEMPLATE_NAME || "",
      templateLanguage: value.WHATSAPP_TEMPLATE_LANGUAGE || "",
      businessAccountId: value.WHATSAPP_BUSINESS_ACCOUNT_ID || ""
    }),
    trustProxy: value.TRUST_PROXY,
    deliveryRecoveryIntervalMs: value.DELIVERY_RECOVERY_INTERVAL_MS,
    providerTimeoutMs: value.PROVIDER_TIMEOUT_MS,
    maxFileBytes: 5 * 1024 * 1024,
    maxImagePixels: 40_000_000
  });
}

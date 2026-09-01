export class EmailProviderError extends Error {
  constructor(message, { code = "email_provider_error", retryable = false } = {}) {
    super(message);
    this.name = "EmailProviderError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function toEmailProviderError(error) {
  if (error instanceof EmailProviderError) return error;
  if (error?.name === "AbortError" || error?.name === "TimeoutError") {
    return new EmailProviderError("Email provider timeout", { code: "timeout", retryable: true });
  }
  const smtpCode = Number(error?.responseCode);
  if (smtpCode >= 400 && smtpCode < 500) {
    return new EmailProviderError("Temporary email provider failure", { code: `smtp_${smtpCode}`, retryable: true });
  }
  if (smtpCode >= 500) {
    return new EmailProviderError("Email provider rejected the message", { code: `smtp_${smtpCode}`, retryable: false });
  }
  return new EmailProviderError("Email provider connection failed", { code: "connection_error", retryable: true });
}

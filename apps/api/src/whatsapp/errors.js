export class ProviderError extends Error {
  constructor(message, { code = "provider_error", retryable = false, mediaExpired = false } = {}) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.retryable = retryable;
    this.mediaExpired = mediaExpired;
  }
}

export function toProviderError(error) {
  if (error instanceof ProviderError) return error;
  if (error?.name === "AbortError" || error?.name === "TimeoutError") return new ProviderError("Provider timeout", { code: "timeout", retryable: true });
  return new ProviderError("Provider connection failed", { code: "connection_error", retryable: true });
}

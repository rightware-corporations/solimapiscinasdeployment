import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { EmailProviderError } from "./errors.js";

export class SmtpEmailAdapter {
  constructor({ config, transport } = {}) {
    this.config = config;
    this.transport = transport || nodemailer.createTransport({
      host: config.email.smtp.host,
      port: config.email.smtp.port,
      secure: config.email.smtp.secure,
      auth: { user: config.email.smtp.user, pass: config.email.smtp.password },
      connectionTimeout: config.providerTimeoutMs,
      greetingTimeout: config.providerTimeoutMs,
      socketTimeout: config.providerTimeoutMs
    });
  }

  async send(message) {
    const response = await this.transport.sendMail(message);
    if (!response?.messageId) throw new EmailProviderError("Malformed email provider response", { code: "malformed_response", retryable: true });
    return { messageId: response.messageId };
  }
}

export class FakeEmailAdapter {
  constructor({ failures = [] } = {}) {
    this.failures = [...failures];
    this.calls = [];
  }

  queueFailure(error) { this.failures.push(error); }

  async send(message) {
    const error = this.failures.shift();
    if (error) throw error;
    this.calls.push(message);
    return { messageId: `email.test.${crypto.randomUUID()}` };
  }
}

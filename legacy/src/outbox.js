import nodemailer from "nodemailer";
import { config } from "./config.js";

export async function processOutbox(prisma) {
  const events = await prisma.outboxEvent.findMany({
    where: { status: { in: ["PENDING", "RETRY"] }, nextAttemptAt: { lte: new Date() } },
    take: 10,
    orderBy: { createdAt: "asc" }
  });
  for (const event of events) {
    try {
      const payload = JSON.parse(event.payload);
      if (config.emailEnabled) {
        const transport = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: Number(process.env.SMTP_PORT) === 465,
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined
        });
        await transport.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: process.env.NOTIFICATION_EMAIL,
          subject: `Novo pedido ${payload.ticketNumber}`,
          text: `Ticket: ${payload.ticketNumber}\nNome: ${payload.customerName}\nContacto: ${payload.phoneE164}\nLocalização: ${payload.location}\nServiço: ${payload.serviceType}`
        });
      }
      await prisma.$transaction([
        prisma.outboxEvent.update({ where: { id: event.id }, data: { status: "PROCESSED", processedAt: new Date() } }),
        prisma.quoteRequest.update({ where: { id: event.quoteRequestId }, data: { notificationStatus: config.emailEnabled ? "SENT" : "NOT_CONFIGURED" } })
      ]);
    } catch (error) {
      const attempts = event.attempts + 1;
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: attempts >= 8 ? "FAILED" : "RETRY",
          attempts,
          lastError: String(error.message || error).slice(0, 300),
          nextAttemptAt: new Date(Date.now() + Math.min(3_600_000, 2 ** attempts * 30_000))
        }
      });
    }
  }
}

import { createWhatsappIntentController } from "./controller.js";
export function mountIntentRoutes(app, { intentService, intentLimiter }) {
  app.post("/api/intents/whatsapp", intentLimiter, createWhatsappIntentController({ intentService }));
}

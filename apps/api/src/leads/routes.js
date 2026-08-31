import { createLeadController } from "./controller.js";

export function mountLeadRoutes(app, { upload, uploadLimiter, leadService }) {
  app.post("/api/leads", uploadLimiter, upload.fields([
    { name: "locationPhotos", maxCount: 3 },
    { name: "inspirationPhotos", maxCount: 2 }
  ]), createLeadController({ leadService }));
}

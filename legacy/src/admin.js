import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { config } from "./config.js";

const statuses = ["RECEIVED", "UNDER_REVIEW", "CONTACT_PENDING", "CONTACTED", "QUOTE_PREPARING", "QUOTE_SENT", "ACCEPTED", "REJECTED", "CLOSED"];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const cookie = (req) => Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map((v) => v.trim().split(/=(.*)/s).slice(0, 2)));
const hash = (value) => crypto.createHmac("sha256", config.sessionSecret).update(value).digest("hex");

async function session(req, prisma) {
  const raw = cookie(req).solima_admin;
  if (!raw) return null;
  const [id, signature] = raw.split(".");
  if (!id || signature?.length !== 64 || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hash(id)))) return null;
  return prisma.adminSession.findFirst({ where: { id, expiresAt: { gt: new Date() } } });
}

const shell = (title, body) => `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)} · SOLIMA</title><style>
body{margin:0;background:#061124;color:#edf8ff;font:15px Inter,system-ui,sans-serif}a{color:#67d6f5}.wrap{max-width:1120px;margin:auto;padding:32px 20px}nav{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px}form,.card{background:#0e1e34;border:1px solid #29415d;padding:22px}input,select,textarea,button{font:inherit;padding:11px;border:1px solid #3c5672;background:#071426;color:#fff}input,textarea,select{width:100%;box-sizing:border-box;margin:6px 0 14px}button{background:#42c8ec;color:#04121d;font-weight:700;cursor:pointer}.grid{display:grid;gap:12px}.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.request{display:grid;grid-template-columns:1.2fr .8fr .8fr auto;gap:12px;padding:15px;border-bottom:1px solid #29415d}.muted{color:#9eb0c5}.thumbs{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}.thumbs img{width:100%;aspect-ratio:1;object-fit:cover}.error{color:#ffafaf}@media(max-width:700px){.request{grid-template-columns:1fr}.wrap{padding:20px 14px}}</style></head><body><div class="wrap">${body}</div></body></html>`;

export function adminRouter(express, prisma, loginLimiter) {
  const router = express.Router();
  router.get("/login", (req, res) => res.send(shell("Entrar", `<h1>Administração SOLIMA</h1><form method="post"><label>Email<input name="email" type="email" required></label><label>Palavra-passe<input name="password" type="password" required></label><button>Entrar</button></form>`)));
  router.post("/login", loginLimiter, express.urlencoded({ extended: false }), async (req, res) => {
    const configured = config.adminPasswordHash && req.body.email === config.adminEmail && await bcrypt.compare(req.body.password || "", config.adminPasswordHash);
    if (!configured) return res.status(401).send(shell("Acesso recusado", `<p class="error">Credenciais inválidas.</p><a href="/admin/login">Tentar novamente</a>`));
    const id = crypto.randomUUID();
    const csrf = crypto.randomBytes(24).toString("hex");
    await prisma.adminSession.create({ data: { id, data: JSON.stringify({ csrf, email: config.adminEmail }), expiresAt: new Date(Date.now() + 8 * 3600_000) } });
    res.setHeader("Set-Cookie", `solima_admin=${id}.${hash(id)}; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=28800${config.nodeEnv === "production" ? "; Secure" : ""}`);
    res.redirect("/admin/requests");
  });
  router.use(async (req, res, next) => {
    req.adminSession = await session(req, prisma);
    if (!req.adminSession) return res.redirect("/admin/login");
    req.adminData = JSON.parse(req.adminSession.data);
    next();
  });
  router.get("/requests", async (req, res) => {
    const q = String(req.query.q || "").slice(0, 100);
    const status = statuses.includes(req.query.status) ? req.query.status : undefined;
    const requests = await prisma.quoteRequest.findMany({
      where: { ...(status && { status }), ...(q && { OR: [{ ticketNumber: { contains: q } }, { phoneE164: { contains: q } }] }) },
      orderBy: { createdAt: "desc" }, take: 100
    });
    const rows = requests.map((r) => `<a class="request" href="/admin/requests/${r.id}"><strong>${esc(r.ticketNumber)}</strong><span>${esc(r.customerName)}</span><span>${esc(r.status)}</span><span>${r.createdAt.toLocaleDateString("pt-MZ")}</span></a>`).join("");
    res.send(shell("Pedidos", `<nav><h1>Pedidos</h1><a href="/">Ver website</a></nav><form class="row" method="get"><input style="width:auto;flex:1;margin:0" name="q" value="${esc(q)}" placeholder="Ticket ou telefone"><select style="width:auto;margin:0" name="status"><option value="">Todos os estados</option>${statuses.map((s) => `<option ${s===status?"selected":""}>${s}</option>`)}</select><button>Filtrar</button></form><div class="card">${rows || "<p>Nenhum pedido.</p>"}</div>`));
  });
  router.get("/requests/:id", async (req, res) => {
    const r = await prisma.quoteRequest.findUnique({ where: { id: req.params.id }, include: { files: true, history: { orderBy: { createdAt: "desc" } } } });
    if (!r) return res.sendStatus(404);
    const thumbs = r.files.map((f) => `<img src="/admin/media/${f.id}" alt="${esc(f.originalNameSanitized)}">`).join("");
    res.send(shell(r.ticketNumber, `<nav><a href="/admin/requests">← Pedidos</a><strong>${esc(r.ticketNumber)}</strong></nav><div class="grid"><section class="card"><h1>${esc(r.customerName)}</h1><p>${esc(r.phoneE164)} · ${esc(r.location)}</p><p>${esc(r.serviceType)} · ${esc(JSON.parse(r.extrasJson).join(", ") || "Sem complementos")}</p><p>${esc(r.notes || "Sem observações")}</p></section><div class="thumbs">${thumbs}</div><form method="post"><input type="hidden" name="_csrf" value="${req.adminData.csrf}"><label>Estado<select name="status">${statuses.map((s)=>`<option ${s===r.status?"selected":""}>${s}</option>`)}</select></label><label>Nota interna<textarea name="note" maxlength="500"></textarea></label><button>Guardar alteração</button></form></div>`));
  });
  router.get("/media/:fileId", async (req, res) => {
    const file = await prisma.quoteRequestFile.findUnique({ where: { id: req.params.fileId } });
    if (!file) return res.sendStatus(404);
    const { config } = await import("./config.js");
    const path = await import("node:path");
    res.type(file.mimeType).sendFile(path.join(config.storageRoot, file.thumbnailStorageKey));
  });
  router.post("/requests/:id", express.urlencoded({ extended: false }), async (req, res) => {
    if (req.body._csrf !== req.adminData.csrf || !statuses.includes(req.body.status)) return res.sendStatus(403);
    const current = await prisma.quoteRequest.findUnique({ where: { id: req.params.id } });
    if (!current) return res.sendStatus(404);
    await prisma.$transaction([
      prisma.quoteRequest.update({ where: { id: current.id }, data: { status: req.body.status } }),
      prisma.quoteRequestStatusHistory.create({ data: { quoteRequestId: current.id, previousStatus: current.status, newStatus: req.body.status, actorType: "ADMIN", actorId: req.adminData.email, note: String(req.body.note || "").slice(0, 500) || null } })
    ]);
    res.redirect(`/admin/requests/${current.id}`);
  });
  return router;
}

export const INTENT_SOURCE_TYPES = ["PROJECT", "SERVICE", "PROCESS", "CONTACT", "STICKY", "GENERIC"];
export const INTENT_CTA_TYPES = ["WHATSAPP_CHAT"];

const projects = new Map([
  ["vista-do-vale", { name: "Vista do Vale", suggestedService: "NEW_CONSTRUCTION" }],
  ["residencia-sommerschield", { name: "Residência Sommerschield", suggestedService: "MODERNIZATION" }],
  ["composite-deck", { name: "Composite Deck", suggestedService: "NEW_CONSTRUCTION" }],
  ["crepusculo-aquatico", { name: "Crepúsculo Aquático", suggestedService: "MODERNIZATION" }],
  ["conjunto-familiar", { name: "Conjunto Familiar", suggestedService: null }],
  ["pergola-lounge", { name: "Pergola & Lounge", suggestedService: null }]
]);

const services = new Map([
  ["NEW_CONSTRUCTION", { name: "Construção", suggestedService: "NEW_CONSTRUCTION" }],
  ["MODERNIZATION", { name: "Modernização", suggestedService: "MODERNIZATION" }],
  ["MAINTENANCE", { name: "Manutenção", suggestedService: "MAINTENANCE" }]
]);

const sourceWithoutReference = new Map([
  ["PROCESS", "Processo SOLIMA"],
  ["CONTACT", "Contacto SOLIMA"],
  ["STICKY", "Ação contextual"],
  ["GENERIC", "Contacto geral"]
]);

export function resolveIntentSource(sourceType, sourceRef) {
  if (sourceType === "PROJECT") return sourceRef ? projects.get(sourceRef) || null : null;
  if (sourceType === "SERVICE") return sourceRef ? services.get(sourceRef) || null : null;
  if (sourceRef) return null;
  const name = sourceWithoutReference.get(sourceType);
  return name ? { name, suggestedService: null } : null;
}

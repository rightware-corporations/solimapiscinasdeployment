import { customAlphabet, nanoid } from "nanoid";
const readable = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 6);
export function createTicket(date = new Date()) {
  const stamp = date.toISOString().slice(0, 10).replaceAll("-", "");
  return `SOL-${stamp}-${readable()}`;
}
export const createPublicToken = () => nanoid(32);

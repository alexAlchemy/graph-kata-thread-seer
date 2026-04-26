import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const randomId = customAlphabet(alphabet, 10);

export function createId(prefix: string): string {
  return `${prefix}_${randomId()}`;
}

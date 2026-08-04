// Pembungkus Cloudflare Pages Function.
import { ruteBalas } from "../../../src/rute.js";

export const onRequest = (c) => ruteBalas(c.request, c.env);

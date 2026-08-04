// Pembungkus Cloudflare Pages Function.
import { ruteSehat } from "../../src/rute.js";

export const onRequest = (c) => ruteSehat(c.request, c.env);

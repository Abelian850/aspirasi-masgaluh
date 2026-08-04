// Pembungkus Cloudflare Pages Function.
import { ruteAspirasi } from "../../src/rute.js";

export const onRequest = (c) => ruteAspirasi(c.request, c.env);

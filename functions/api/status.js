// Pembungkus Cloudflare Pages Function.
import { ruteStatus } from "../../src/rute.js";

export const onRequest = (c) => ruteStatus(c.request, c.env);

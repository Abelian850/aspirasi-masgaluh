// Pembungkus Cloudflare Pages Function.
import { ruteLogin } from "../../../src/rute.js";

export const onRequest = (c) => ruteLogin(c.request, c.env);

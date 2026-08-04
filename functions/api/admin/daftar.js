// Pembungkus Cloudflare Pages Function.
import { ruteDaftar } from "../../../src/rute.js";

export const onRequest = (c) => ruteDaftar(c.request, c.env);

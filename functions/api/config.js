// Pembungkus Cloudflare Pages Function.
// Logikanya ada di src/rute.js supaya bisa dipakai bersama server lokal.
import { ruteConfig } from "../../src/rute.js";

export const onRequest = (c) => ruteConfig(c.request, c.env);

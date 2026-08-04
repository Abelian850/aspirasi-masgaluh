// Satu tempat untuk membaca environment variable.
//
// Di Cloudflare Pages Functions, env datang sebagai argumen (context.env),
// bukan dari process.env. Di server lokal Node, sebaliknya. Fungsi ini
// menyatukan keduanya supaya modul lain tidak perlu peduli sedang jalan di mana.
//
// Catatan: dengan nodejs_compat, Cloudflare juga mengisi process.env, tetapi
// env yang dikirim eksplisit selalu lebih dipercaya.

export function ambilEnv(env) {
  const dariProses =
    typeof process !== "undefined" && process.env ? process.env : {};
  return { ...dariProses, ...(env || {}) };
}

export function nilai(env, nama, bawaan = "") {
  const e = ambilEnv(env);
  const v = e[nama];
  return v == null || v === "" ? bawaan : String(v);
}

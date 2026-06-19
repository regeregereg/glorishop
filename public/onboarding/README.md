# Foto Onboarding

Taruh foto kamu di folder ini dengan nama file PERSIS seperti berikut, supaya
otomatis muncul di layar onboarding (`/onboarding`):

- `haircut.jpg`   — foto potong rambut
- `shaving.jpg`   — foto cukur / shaving
- `coloring.jpg`  — foto coloring
- `treatment.jpg` — foto treatment

Format `.jpg` atau ganti ekstensinya di
`src/app/onboarding/page.tsx` (array `SLIDES`) kalau mau pakai `.png`/`.webp`.

Kalau salah satu foto belum ada / gagal dimuat, kartunya otomatis fallback ke
tampilan gradient + ikon, jadi tampilan tetap rapi sambil nunggu foto asli
ditambahkan.

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/Button";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/user-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal login.");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg px-5 pb-10">
      <header className="flex items-center gap-3 py-4">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border-soft text-text-secondary"
        >
          <ChevronLeft size={18} />
        </Link>
      </header>

      <div className="mt-6">
        <h1 className="font-display text-2xl font-extrabold">
          Masuk ke Glori Barbershop
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Cukup masukkan nama dan nomor WhatsApp kamu — tidak perlu password.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-text-secondary">
              Nama Lengkap
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Budi Santoso"
              className="w-full rounded-2xl border border-border-soft bg-surface px-4 py-3.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-text-secondary">
              Nomor WhatsApp
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08xxxxxxxxxx"
              className="w-full rounded-2xl border border-border-soft bg-surface px-4 py-3.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent outline-none"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-status-cancelled/10 px-4 py-3 text-sm text-status-cancelled">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={loading} className="mt-2">
            {loading ? "Memproses..." : "Lanjutkan"}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-text-tertiary">
          Jika nomor belum terdaftar, akun baru akan dibuat otomatis.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

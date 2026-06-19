"use client";

import { useEffect, useState, useCallback } from "react";
import { Staff } from "@/types";
import { Button } from "@/components/Button";
import { ImageUpload } from "@/components/ImageUpload";
import { Plus, X, Pencil } from "lucide-react";

export default function AdminBarberPage() {
  const [barbers, setBarbers] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Staff | "new" | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/barbers?includeInactive=true");
    const data = await res.json();
    setBarbers(data.barbers || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(b: Staff) {
    await fetch(`/api/barbers/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !b.is_active }),
    });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Kelola Barber</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Tambah akun barber baru atau atur status aktif.
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setEditing("new")}>
          Tambah Barber
        </Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {barbers.map((b) => (
          <div key={b.id} className="rounded-2xl border border-border-soft bg-surface p-4">
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-accent-soft font-display font-bold text-accent">
                {b.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.photo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  b.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <button
                onClick={() => setEditing(b)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-soft text-text-secondary"
              >
                <Pencil size={13} />
              </button>
            </div>
            <p className="mt-3 font-semibold text-sm">{b.name}</p>
            <p className="mt-0.5 text-xs text-text-secondary">@{b.username}</p>
            <button
              onClick={() => toggleActive(b)}
              className={`mt-3 w-full rounded-xl px-3 py-2 text-xs font-medium ${
                b.is_active
                  ? "bg-status-done/10 text-status-done"
                  : "bg-status-cancelled/10 text-status-cancelled"
              }`}
            >
              {b.is_active ? "Aktif" : "Nonaktif"} — klik untuk ubah
            </button>
          </div>
        ))}
        {barbers.length === 0 && !loading && (
          <p className="text-sm text-text-secondary">Belum ada barber.</p>
        )}
      </div>

      {editing && (
        <BarberForm
          barber={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function BarberForm({
  barber,
  onClose,
  onSaved,
}: {
  barber: Staff | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(barber?.name ?? "");
  const [username, setUsername] = useState(barber?.username ?? "");
  const [password, setPassword] = useState("");
  const [bio, setBio] = useState(barber?.bio ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(barber?.photo_url ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name || (!barber && !username)) {
      setError("Lengkapi data wajib.");
      return;
    }
    setSubmitting(true);
    try {
      const res = barber
        ? await fetch(`/api/barbers/${barber.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, bio, photo_url: photoUrl }),
          })
        : await fetch("/api/barbers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, username, password, bio, photo_url: photoUrl }),
          });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Gagal menyimpan.");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-border-soft bg-surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">
            {barber ? "Edit Barber" : "Tambah Barber"}
          </h2>
          <button onClick={onClose} className="text-text-secondary">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <ImageUpload
            value={photoUrl}
            onChange={setPhotoUrl}
            folder="barber"
            shape="circle"
            label="Foto profil"
          />
          <input
            placeholder="Nama barber"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
          {!barber && (
            <>
              <input
                placeholder="Username untuk login"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
              />
              <input
                type="password"
                placeholder="Password (default: barber123)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
              />
            </>
          )}
          <textarea
            placeholder="Bio singkat (opsional)"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            className="rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />

          {error && (
            <p className="rounded-xl bg-status-cancelled/10 px-3 py-2 text-xs text-status-cancelled">
              {error}
            </p>
          )}

          <Button type="submit" fullWidth disabled={submitting} className="mt-1">
            {submitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </form>
      </div>
    </div>
  );
}

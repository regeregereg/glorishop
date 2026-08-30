"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Staff, BarberPortfolio } from "@/types";
import { Button } from "@/components/Button";
import { ImageUpload } from "@/components/ImageUpload";
import { ErrorState } from "@/components/ErrorState";
import { Plus, X, Pencil, Images, Trash2, Loader2, ImagePlus } from "lucide-react";

export default function AdminBarberPage() {
  const [barbers, setBarbers] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<Staff | "new" | null>(null);
  const [portfolioFor, setPortfolioFor] = useState<Staff | null>(null);
  const [deleting, setDeleting] = useState<Staff | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch("/api/barbers?includeInactive=true");
      if (!res.ok) throw new Error("Gagal memuat data barber.");
      const data = await res.json();
      setBarbers(data.barbers || []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/barbers/${deleting.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(data.error || "Gagal menghapus barber.");
        return;
      }
      setBarbers((prev) => prev.filter((x) => x.id !== deleting.id));
      setDeleting(null);
    } catch {
      setDeleteError("Gagal menghapus barber. Periksa koneksi internet kamu.");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function toggleActive(b: Staff) {
    try {
      const res = await fetch(`/api/barbers/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !b.is_active }),
      });
      if (!res.ok) {
        alert("Gagal mengubah status barber.");
        return;
      }
      load();
    } catch {
      alert("Gagal mengubah status barber. Periksa koneksi internet kamu.");
    }
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

      {loadError && (
        <ErrorState
          className="mt-6"
          title="Gagal memuat data barber"
          message="Periksa koneksi internet kamu, lalu coba lagi."
          onRetry={load}
        />
      )}

      {loading && !loadError && (
        <p className="mt-8 text-sm text-text-secondary">Memuat...</p>
      )}

      {!loadError && !loading && (
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {barbers.map((b) => (
          <div key={b.id} className="rounded-2xl border border-border-soft bg-surface p-4">
            <div className="flex items-start justify-between">
              <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-accent-soft font-display font-bold text-accent">
                {b.photo_url ? (
                  <Image src={b.photo_url} alt="" fill sizes="48px" className="object-cover" />
                ) : (
                  b.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPortfolioFor(b)}
                  title="Kelola portofolio"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-soft text-text-secondary"
                >
                  <Images size={13} />
                </button>
                <button
                  onClick={() => setEditing(b)}
                  title="Edit barber"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-soft text-text-secondary"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => {
                    setDeleteError("");
                    setDeleting(b);
                  }}
                  title="Hapus barber"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-soft text-status-cancelled"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <p className="mt-3 font-semibold text-sm">{b.name}</p>
            <p className="mt-0.5 text-xs text-text-secondary">@{b.username}</p>
            <button
              onClick={() => toggleActive(b)}
              className={`mt-3 w-full rounded-xl px-3 py-2 text-xs font-semibold ${
                b.is_active
                  ? "bg-status-done/10 text-status-done"
                  : "bg-status-cancelled/10 text-status-cancelled"
              }`}
            >
              {b.is_active ? "Aktif" : "Nonaktif"} — klik untuk ubah
            </button>
          </div>
        ))}
        {barbers.length === 0 && (
          <p className="text-sm text-text-secondary">Belum ada barber.</p>
        )}
      </div>
      )}

      {editing && (
        <BarberForm
          barber={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}

      {portfolioFor && (
        <BarberPortfolioModal
          barber={portfolioFor}
          onClose={() => setPortfolioFor(null)}
        />
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-border-soft bg-surface p-6">
            <h2 className="font-display text-lg font-bold">Hapus Barber?</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Kamu akan menghapus <span className="font-semibold text-text-primary">{deleting.name}</span> secara
              permanen. Tindakan ini tidak bisa dibatalkan.
            </p>

            {deleteError && (
              <p className="mt-3 rounded-xl bg-status-cancelled/10 px-3 py-2 text-xs text-status-cancelled">
                {deleteError}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  setDeleting(null);
                  setDeleteError("");
                }}
                disabled={deleteBusy}
              >
                Batal
              </Button>
              <Button
                variant="danger"
                fullWidth
                onClick={handleDelete}
                disabled={deleteBusy}
              >
                {deleteBusy ? "Menghapus..." : "Hapus"}
              </Button>
            </div>
          </div>
        </div>
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
  // Jam istirahat — format input time HTML "HH:MM". Kolom Postgres `time`
  // biasanya balik sebagai "HH:MM:SS", jadi dipotong ke 5 karakter.
  const [breakStart, setBreakStart] = useState(barber?.break_start?.slice(0, 5) ?? "");
  const [breakEnd, setBreakEnd] = useState(barber?.break_end?.slice(0, 5) ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name || (!barber && !username)) {
      setError("Lengkapi data wajib.");
      return;
    }
    if ((breakStart && !breakEnd) || (!breakStart && breakEnd)) {
      setError("Isi jam mulai DAN jam selesai istirahat, atau kosongkan keduanya.");
      return;
    }
    if (breakStart && breakEnd && breakStart >= breakEnd) {
      setError("Jam selesai istirahat harus setelah jam mulai.");
      return;
    }
    setSubmitting(true);
    try {
      const res = barber
        ? await fetch(`/api/barbers/${barber.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              bio,
              photo_url: photoUrl,
              break_start: breakStart,
              break_end: breakEnd,
            }),
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

          {/* Jam istirahat — cuma muncul saat edit barber yang sudah ada
              (bukan waktu tambah baru), karena endpoint create belum
              menangani field ini; sekali barber dibuat, admin tinggal
              klik Edit lagi untuk mengaturnya. Begitu diisi, jam ini
              otomatis dilubangi tiap kali generate slot di halaman
              Kelola Slot — booking tidak akan pernah bisa masuk ke jam
              ini karena slotnya memang tidak pernah dibuat. */}
          {barber && (
            <div className="rounded-xl border border-border-soft bg-surface-2 p-3">
              <p className="mb-2 text-xs font-semibold text-text-secondary">
                Jam istirahat (opsional)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] text-text-tertiary">Mulai</label>
                  <input
                    type="time"
                    value={breakStart}
                    onChange={(e) => setBreakStart(e.target.value)}
                    className="w-full rounded-lg border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-text-tertiary">Selesai</label>
                  <input
                    type="time"
                    value={breakEnd}
                    onChange={(e) => setBreakEnd(e.target.value)}
                    className="w-full rounded-lg border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </div>
              </div>
              <p className="mt-1.5 text-[11px] text-text-tertiary">
                Slot di jam ini otomatis dilewati saat generate slot baru di halaman Kelola Slot.
              </p>
            </div>
          )}

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

function BarberPortfolioModal({
  barber,
  onClose,
}: {
  barber: Staff;
  onClose: () => void;
}) {
  const [photos, setPhotos] = useState<BarberPortfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/barbers/${barber.id}/portfolio`);
      if (!res.ok) throw new Error("Gagal memuat portofolio.");
      const data = await res.json();
      setPhotos(data.portfolio || []);
    } catch {
      setError("Gagal memuat portofolio. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [barber.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      setError("Format harus JPG, PNG, WEBP, atau AVIF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran file maksimal 5MB.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "portfolio");

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        setError(uploadData.error || "Gagal mengunggah foto.");
        return;
      }

      const saveRes = await fetch(`/api/barbers/${barber.id}/portfolio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_url: uploadData.url }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        setError(saveData.error || "Gagal menyimpan foto ke portofolio.");
        return;
      }

      setPhotos((prev) => [...prev, saveData.photo]);
    } catch {
      setError("Gagal mengunggah foto. Coba lagi.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete(photoId: string) {
    setDeletingId(photoId);
    setError("");
    try {
      const res = await fetch(`/api/barbers/${barber.id}/portfolio/${photoId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Gagal menghapus foto.");
        return;
      }
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-[var(--radius-card)] border border-border-soft bg-surface p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold">Portofolio</h2>
            <p className="mt-0.5 text-xs text-text-secondary">
              Hasil cukur karya {barber.name}
            </p>
          </div>
          <button onClick={onClose} className="text-text-secondary">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-status-cancelled/10 px-3 py-2">
            <p className="text-xs text-status-cancelled">{error}</p>
            {!loading && photos.length === 0 && (
              <button
                onClick={load}
                className="shrink-0 text-xs font-semibold text-status-cancelled underline"
              >
                Coba lagi
              </button>
            )}
          </div>
        )}

        <div className="mt-4 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={22} className="animate-spin text-text-secondary" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {photos.map((p) => (
                <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl border border-border-soft">
                  <Image src={p.photo_url} alt="" fill sizes="(max-width: 640px) 33vw, 160px" className="object-cover" />
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={deletingId === p.id}
                    aria-label="Hapus foto"
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-50"
                  >
                    {deletingId === p.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                </div>
              ))}

              <label
                className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-soft bg-surface-2 text-text-secondary/60 hover:border-accent/40 ${
                  uploading ? "pointer-events-none opacity-50" : ""
                }`}
              >
                {uploading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <ImagePlus size={20} />
                    <span className="text-[10px] font-semibold">Tambah foto</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {!loading && photos.length === 0 && (
            <p className="mt-2 text-center text-xs text-text-tertiary">
              Belum ada foto. Tambahkan foto pertama lewat kotak di atas.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

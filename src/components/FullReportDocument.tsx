"use client";

import { formatRupiah, formatDateShort } from "@/lib/utils";
import { BUSINESS_NAME, BUSINESS_FULL_ADDRESS } from "@/lib/contact";
import { AttendanceReportRow } from "@/components/AttendanceReportDocument";

export interface PopularServiceRow {
  name: string;
  count: number;
  revenue: number;
  commission: number;
}
export interface ProdukTerlarisRow {
  name: string;
  qty: number;
  revenue: number;
}
export interface BarberPerfRow {
  name: string;
  count: number;
  revenue: number;
  commission: number;
}
export interface DailyRevenueRow {
  date: string;
  total: number;
}

// Dokumen cetak "Laporan Lengkap" — gabungan semua bagian yang ada di
// halaman /admin/laporan (omset, layanan terpopuler, produk terlaris,
// performa barber, omset harian) DITAMBAH rekap absensi staff, jadi satu
// dokumen A4 yang bisa dicetak/di-download sekali jalan. Sebelumnya cuma
// bagian absensi yang bisa dicetak (lihat AttendanceReportDocument) — ini
// tidak diubah/dihapus, dokumen ini cuma tambahan di atasnya.
export function FullReportDocument({
  periodLabel,
  summary,
  dailyRevenue,
  popularServices,
  produkTerlaris,
  barberPerformance,
  workStartTime,
  attendance,
}: {
  periodLabel: string;
  summary: {
    totalOmset: number;
    totalOmsetLayanan: number;
    totalOmsetProduk: number;
    totalKomisi: number;
    totalTransaksi: number;
  };
  dailyRevenue: DailyRevenueRow[];
  popularServices: PopularServiceRow[];
  produkTerlaris: ProdukTerlarisRow[];
  barberPerformance: BarberPerfRow[];
  workStartTime: string;
  attendance: AttendanceReportRow[];
}) {
  const totalHadir = attendance.reduce((sum, r) => sum + r.hadir, 0);
  const totalTerlambat = attendance.reduce((sum, r) => sum + r.terlambat, 0);
  const totalTidakMasuk = attendance.reduce((sum, r) => sum + r.tidak_masuk, 0);

  return (
    <div
      id="full-report-print-area"
      className="bg-white text-black"
      style={{
        width: "190mm",
        margin: "0 auto",
        padding: "20mm 14mm",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "12px",
        lineHeight: 1.5,
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          borderBottom: "2px solid #000",
          paddingBottom: 12,
        }}
      >
        <div>
          <p style={{ fontSize: "20px", fontWeight: 800 }}>{BUSINESS_NAME}</p>
          <p style={{ marginTop: 2, color: "#444" }}>{BUSINESS_FULL_ADDRESS}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: "15px", fontWeight: 700 }}>LAPORAN LENGKAP</p>
          <p style={{ color: "#444" }}>{periodLabel}</p>
        </div>
      </div>

      {/* ── Ringkasan Omset ── */}
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <SummaryBox label="Total Omset" value={formatRupiah(summary.totalOmset)} />
        <SummaryBox label="Total Transaksi" value={String(summary.totalTransaksi)} />
        <SummaryBox label="Total Komisi Barber" value={formatRupiah(summary.totalKomisi)} />
        <SummaryBox
          label="Bagian Barbershop"
          value={formatRupiah(summary.totalOmset - summary.totalKomisi)}
        />
      </div>
      <p style={{ marginTop: 8, fontSize: "10px", color: "#666" }}>
        Omset Layanan {formatRupiah(summary.totalOmsetLayanan)} · Omset Produk{" "}
        {formatRupiah(summary.totalOmsetProduk)}
      </p>

      {/* ── Omset Harian ── */}
      <SectionTitle>Omset Harian</SectionTitle>
      <table style={{ width: "100%", marginTop: 8, borderCollapse: "collapse", fontSize: "11px" }}>
        <thead>
          <tr style={{ borderBottom: "1.5px solid #000", textAlign: "left" }}>
            <th style={thStyle}>Tanggal</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Omset</th>
          </tr>
        </thead>
        <tbody>
          {dailyRevenue.map((d) => (
            <tr key={d.date} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={tdStyle}>{formatDateShort(d.date)}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{formatRupiah(d.total)}</td>
            </tr>
          ))}
          {dailyRevenue.length === 0 && (
            <tr>
              <td colSpan={2} style={{ ...tdStyle, textAlign: "center", color: "#777" }}>
                Belum ada data pada rentang ini.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ── Layanan Terpopuler ── */}
      <SectionTitle>Layanan Terpopuler</SectionTitle>
      <table style={{ width: "100%", marginTop: 8, borderCollapse: "collapse", fontSize: "11px" }}>
        <thead>
          <tr style={{ borderBottom: "1.5px solid #000", textAlign: "left" }}>
            <th style={thStyle}>Layanan</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Dibooking</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Omset</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Komisi</th>
          </tr>
        </thead>
        <tbody>
          {popularServices.map((s) => (
            <tr key={s.name} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={tdStyle}>{s.name}</td>
              <td style={{ ...tdStyle, textAlign: "center" }}>{s.count}x</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{formatRupiah(s.revenue)}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{formatRupiah(s.commission)}</td>
            </tr>
          ))}
          {popularServices.length === 0 && (
            <tr>
              <td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: "#777" }}>
                Belum ada data.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ── Produk Terlaris ── */}
      <SectionTitle>Produk Terlaris</SectionTitle>
      <table style={{ width: "100%", marginTop: 8, borderCollapse: "collapse", fontSize: "11px" }}>
        <thead>
          <tr style={{ borderBottom: "1.5px solid #000", textAlign: "left" }}>
            <th style={thStyle}>Produk</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Terjual</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Omset</th>
          </tr>
        </thead>
        <tbody>
          {produkTerlaris.map((p) => (
            <tr key={p.name} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={tdStyle}>{p.name}</td>
              <td style={{ ...tdStyle, textAlign: "center" }}>{p.qty}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{formatRupiah(p.revenue)}</td>
            </tr>
          ))}
          {produkTerlaris.length === 0 && (
            <tr>
              <td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: "#777" }}>
                Belum ada data.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ── Performa Barber ── */}
      <SectionTitle>Performa Barber</SectionTitle>
      <table style={{ width: "100%", marginTop: 8, borderCollapse: "collapse", fontSize: "11px" }}>
        <thead>
          <tr style={{ borderBottom: "1.5px solid #000", textAlign: "left" }}>
            <th style={thStyle}>Barber</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Klien</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Omset</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Komisi</th>
          </tr>
        </thead>
        <tbody>
          {barberPerformance.map((b) => (
            <tr key={b.name} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={tdStyle}>{b.name}</td>
              <td style={{ ...tdStyle, textAlign: "center" }}>{b.count}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{formatRupiah(b.revenue)}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{formatRupiah(b.commission)}</td>
            </tr>
          ))}
          {barberPerformance.length === 0 && (
            <tr>
              <td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: "#777" }}>
                Belum ada data.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ── Rekap Absensi Staff ── */}
      <SectionTitle>Rekap Absensi Staff</SectionTitle>
      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <SummaryBox label="Total Staff" value={String(attendance.length)} />
        <SummaryBox label="Total Hadir" value={String(totalHadir)} />
        <SummaryBox label="Total Terlambat" value={String(totalTerlambat)} />
        <SummaryBox label="Total Tidak Masuk" value={String(totalTidakMasuk)} />
      </div>
      <p style={{ marginTop: 8, fontSize: "10px", color: "#666" }}>
        Jam masuk standar yang dipakai sebagai acuan keterlambatan: <strong>{workStartTime}</strong> WIB.
      </p>
      <table style={{ width: "100%", marginTop: 8, borderCollapse: "collapse", fontSize: "11px" }}>
        <thead>
          <tr style={{ borderBottom: "1.5px solid #000", textAlign: "left" }}>
            <th style={thStyle}>Nama</th>
            <th style={thStyle}>Peran</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Hadir</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Terlambat</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Tidak Masuk</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Total Jam Kerja</th>
          </tr>
        </thead>
        <tbody>
          {attendance.map((r) => (
            <tr key={r.staff_id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{r.name}</td>
              <td style={tdStyle}>{r.role === "admin" ? "Admin" : "Barber"}</td>
              <td style={{ ...tdStyle, textAlign: "center" }}>{r.hadir}</td>
              <td style={{ ...tdStyle, textAlign: "center" }}>{r.terlambat}</td>
              <td style={{ ...tdStyle, textAlign: "center" }}>{r.tidak_masuk}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{formatJamKerja(r.total_jam_kerja_menit)}</td>
            </tr>
          ))}
          {attendance.length === 0 && (
            <tr>
              <td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "#777" }}>
                Tidak ada data staff aktif.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <p style={{ marginTop: 24, fontSize: "10px", color: "#777" }}>
        Dicetak otomatis dari sistem admin {BUSINESS_NAME} pada{" "}
        {new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}.
      </p>
    </div>
  );
}

function formatJamKerja(menit: number): string {
  if (menit <= 0) return "0j";
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  return sisa === 0 ? `${jam}j` : `${jam}j ${sisa}m`;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        marginTop: 22,
        fontSize: "13px",
        fontWeight: 800,
        borderBottom: "1px solid #000",
        paddingBottom: 4,
      }}
    >
      {children}
    </p>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, border: "1px solid #ccc", borderRadius: 6, padding: "8px 10px" }}>
      <p style={{ fontSize: "9px", color: "#666", textTransform: "uppercase" }}>{label}</p>
      <p style={{ fontSize: "14px", fontWeight: 800, marginTop: 2 }}>{value}</p>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: "6px 8px" };
const tdStyle: React.CSSProperties = { padding: "6px 8px" };

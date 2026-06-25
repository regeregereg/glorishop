"use client";

import { BUSINESS_NAME, BUSINESS_FULL_ADDRESS } from "@/lib/contact";

export interface AttendanceReportRow {
  staff_id: string;
  name: string;
  role: "admin" | "barber";
  hadir: number;
  terlambat: number;
  tidak_masuk: number;
  total_jam_kerja_menit: number;
}

// Dokumen cetak rekap absensi — dirender dalam lebar A4 (sama seperti
// DailyReportDocument) karena isinya tabel per staff yang perlu ruang
// horizontal. Dipakai bersama PrintActions di halaman
// /admin/laporan-absensi.
export function AttendanceReportDocument({
  periodLabel,
  workStartTime,
  rows,
}: {
  periodLabel: string;
  workStartTime: string;
  rows: AttendanceReportRow[];
}) {
  const totalHadir = rows.reduce((sum, r) => sum + r.hadir, 0);
  const totalTerlambat = rows.reduce((sum, r) => sum + r.terlambat, 0);
  const totalTidakMasuk = rows.reduce((sum, r) => sum + r.tidak_masuk, 0);

  return (
    <div
      id="attendance-report-print-area"
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
          <p style={{ fontSize: "15px", fontWeight: 700 }}>REKAP ABSENSI STAFF</p>
          <p style={{ color: "#444" }}>{periodLabel}</p>
        </div>
      </div>

      {/* ── Ringkasan ── */}
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <SummaryBox label="Total Staff" value={String(rows.length)} />
        <SummaryBox label="Total Hadir" value={String(totalHadir)} />
        <SummaryBox label="Total Terlambat" value={String(totalTerlambat)} />
        <SummaryBox label="Total Tidak Masuk" value={String(totalTidakMasuk)} />
      </div>

      <p style={{ marginTop: 10, fontSize: "10px", color: "#666" }}>
        Jam masuk standar yang dipakai sebagai acuan keterlambatan: <strong>{workStartTime}</strong> WIB.
      </p>

      {/* ── Tabel detail per staff ── */}
      <table style={{ width: "100%", marginTop: 16, borderCollapse: "collapse", fontSize: "11px" }}>
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
          {rows.map((r) => (
            <tr key={r.staff_id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{r.name}</td>
              <td style={tdStyle}>{r.role === "admin" ? "Admin" : "Barber"}</td>
              <td style={{ ...tdStyle, textAlign: "center" }}>{r.hadir}</td>
              <td style={{ ...tdStyle, textAlign: "center" }}>{r.terlambat}</td>
              <td style={{ ...tdStyle, textAlign: "center" }}>{r.tidak_masuk}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{formatJamKerja(r.total_jam_kerja_menit)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
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

"use client";

import { Booking } from "@/types";
import { ReceiptData } from "@/lib/receipt";
import { formatRupiah } from "@/lib/utils";
import { BUSINESS_NAME, BUSINESS_FULL_ADDRESS } from "@/lib/contact";

export interface DailyReportRow {
  booking: Booking;
  receipt: ReceiptData;
}

// Laporan harian dirender selalu dalam lebar A4 (190mm konten) karena
// isinya tabel — thermal 58/80mm terlalu sempit untuk menampung kolom
// layanan + barber + harga secara terbaca. Beda dengan ReceiptDocument
// yang memang dirancang fleksibel untuk struk per-transaksi.
export function DailyReportDocument({
  dateLabel,
  rows,
  totalOmset,
  totalKomisi,
}: {
  dateLabel: string;
  rows: DailyReportRow[];
  totalOmset: number;
  totalKomisi: number;
}) {
  return (
    <div
      id="daily-report-print-area"
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #000", paddingBottom: 12 }}>
        <div>
          <p style={{ fontSize: "20px", fontWeight: 800 }}>{BUSINESS_NAME}</p>
          <p style={{ marginTop: 2, color: "#444" }}>{BUSINESS_FULL_ADDRESS}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: "15px", fontWeight: 700 }}>LAPORAN HARIAN</p>
          <p style={{ color: "#444" }}>{dateLabel}</p>
        </div>
      </div>

      {/* ── Ringkasan ── */}
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <SummaryBox label="Total Transaksi" value={String(rows.length)} />
        <SummaryBox label="Total Omset" value={formatRupiah(totalOmset)} />
        <SummaryBox label="Total Komisi Barber" value={formatRupiah(totalKomisi)} />
        <SummaryBox label="Bagian Barbershop" value={formatRupiah(totalOmset - totalKomisi)} />
      </div>

      {/* ── Tabel detail transaksi ── */}
      <table style={{ width: "100%", marginTop: 20, borderCollapse: "collapse", fontSize: "11px" }}>
        <thead>
          <tr style={{ borderBottom: "1.5px solid #000", textAlign: "left" }}>
            <th style={thStyle}>No. Struk</th>
            <th style={thStyle}>Jam</th>
            <th style={thStyle}>Pelanggan</th>
            <th style={thStyle}>Layanan</th>
            <th style={thStyle}>Barber</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ booking, receipt }) => (
            <tr key={booking.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={tdStyle}>{receipt.receiptNumber}</td>
              <td style={tdStyle}>{receipt.timeLabel}</td>
              <td style={tdStyle}>{receipt.customerName}</td>
              <td style={tdStyle}>{receipt.items.map((it) => it.name).join(", ")}</td>
              <td style={tdStyle}>{receipt.barberName}</td>
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>
                {formatRupiah(receipt.subtotal)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "#777" }}>
                Tidak ada transaksi selesai pada tanggal ini.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid #000" }}>
            <td colSpan={5} style={{ ...tdStyle, fontWeight: 800, textAlign: "right" }}>
              TOTAL
            </td>
            <td style={{ ...tdStyle, fontWeight: 800, textAlign: "right" }}>
              {formatRupiah(totalOmset)}
            </td>
          </tr>
        </tfoot>
      </table>

      <p style={{ marginTop: 24, fontSize: "10px", color: "#777" }}>
        Dicetak otomatis dari sistem admin {BUSINESS_NAME} pada{" "}
        {new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}.
      </p>
    </div>
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

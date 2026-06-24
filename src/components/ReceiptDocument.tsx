"use client";

import { ReceiptData, ReceiptPaperSize } from "@/lib/receipt";
import { formatRupiah } from "@/lib/utils";
import { BUSINESS_NAME, BUSINESS_FULL_ADDRESS, WHATSAPP_NUMBER } from "@/lib/contact";

// Struk dirender dengan palet PUTIH/HITAM (bukan dark theme app) karena ini
// dokumen yang akan diprint di atas kertas — kontras hitam-putih paling
// aman untuk semua jenis printer (thermal maupun inkjet/laser A4).

const WA_DISPLAY = "0" + WHATSAPP_NUMBER.slice(2);

// Lebar dokumen per ukuran kertas. Untuk thermal, satuannya mm asli (dipakai
// juga oleh CSS @page saat print). Untuk A4 dipakai lebar konten yang wajar
// di tengah halaman (bukan lebar penuh A4) supaya tetap terlihat seperti
// invoice, bukan teks memenuhi seluruh lebar kertas.
const WIDTH_BY_SIZE: Record<ReceiptPaperSize, string> = {
  thermal58: "58mm",
  thermal80: "80mm",
  a4: "190mm",
};

export function ReceiptDocument({
  data,
  paperSize,
}: {
  data: ReceiptData;
  paperSize: ReceiptPaperSize;
}) {
  const isThermal = paperSize !== "a4";

  return (
    <div
      id="receipt-print-area"
      className="bg-white text-black"
      style={{
        width: WIDTH_BY_SIZE[paperSize],
        margin: "0 auto",
        fontFamily: "'Courier New', Courier, monospace",
        padding: isThermal ? "10px 8px" : "28px 24px",
        fontSize: isThermal ? "11px" : "13px",
        lineHeight: 1.45,
      }}
    >
      {/* ── Header toko ── */}
      <div className="text-center">
        <p style={{ fontSize: isThermal ? "14px" : "18px", fontWeight: 800, letterSpacing: "0.02em" }}>
          {BUSINESS_NAME.toUpperCase()}
        </p>
        <p style={{ marginTop: 2 }}>{BUSINESS_FULL_ADDRESS}</p>
        <p>WA: {WA_DISPLAY}</p>
      </div>

      <Divider thermal={isThermal} />

      {/* ── Info transaksi ── */}
      <Row label="No. Struk" value={data.receiptNumber} />
      <Row label="Tanggal" value={`${data.dateLabel}, ${data.timeLabel}`} />
      <Row label="Pelanggan" value={data.customerName} />
      <Row label="Barber" value={data.barberName} />

      <Divider thermal={isThermal} />

      {/* ── Daftar layanan ── */}
      {data.items.map((item, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span>{item.name}</span>
          <span style={{ whiteSpace: "nowrap" }}>{formatRupiah(item.price)}</span>
        </div>
      ))}
      {data.items.length === 0 && <p>Tidak ada rincian layanan.</p>}

      <Divider thermal={isThermal} />

      {/* ── Total ── */}
      <Row label="Subtotal" value={formatRupiah(data.subtotal)} bold />
      {data.paidUpfront != null && (
        <>
          <Row label="Dibayar (DP/Lunas)" value={formatRupiah(data.paidUpfront)} />
          {data.remaining > 0 && <Row label="Sisa di tempat" value={formatRupiah(data.remaining)} />}
        </>
      )}
      <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: isThermal ? "13px" : "16px" }}>
        <span>TOTAL</span>
        <span>{formatRupiah(data.subtotal)}</span>
      </div>

      <Divider thermal={isThermal} />

      <Row label="Metode Bayar" value={data.paymentTypeLabel ?? "—"} />

      <Divider thermal={isThermal} />

      <div className="text-center" style={{ marginTop: 10 }}>
        <p>Terima kasih atas kepercayaan Anda 🙏</p>
        <p style={{ marginTop: 2 }}>Sampai jumpa lagi!</p>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontWeight: bold ? 700 : 400 }}>
      <span>{label}</span>
      <span style={{ textAlign: "right" }}>{value}</span>
    </div>
  );
}

function Divider({ thermal }: { thermal: boolean }) {
  return (
    <div
      style={{
        margin: "8px 0",
        borderTop: thermal ? "1px dashed #000" : "1px solid #000",
      }}
    />
  );
}

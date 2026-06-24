import { ReceiptPaperSize } from "@/lib/receipt";

// Lebar kertas dalam mm per ukuran — dipakai untuk menentukan ukuran
// halaman PDF supaya proporsinya sama dengan yang dilihat di preview/print.
const PAPER_WIDTH_MM: Record<ReceiptPaperSize, number> = {
  thermal58: 58,
  thermal80: 80,
  a4: 210,
};

/**
 * Render elemen DOM (id = elementId) menjadi gambar lewat html2canvas, lalu
 * bungkus jadi PDF satu halaman dengan jsPDF dan langsung trigger download
 * di browser. Tinggi halaman PDF otomatis menyesuaikan tinggi konten asli
 * (bukan dipotong ke ukuran kertas standar), supaya struk panjang (banyak
 * baris layanan) maupun laporan harian (banyak baris transaksi) tetap utuh
 * dalam SATU halaman tanpa terpotong di tengah.
 */
export async function downloadElementAsPdf(
  elementId: string,
  fileName: string,
  paperSize: ReceiptPaperSize
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Elemen #${elementId} tidak ditemukan.`);

  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  // Scale 3x supaya teks tetap tajam saat di-zoom/print ulang dari PDF,
  // terutama penting untuk struk thermal yang fontnya kecil (11px).
  const canvas = await html2canvas(element, {
    scale: 3,
    backgroundColor: "#ffffff",
    useCORS: true,
  });

  const imgData = canvas.toDataURL("image/png");
  const widthMm = PAPER_WIDTH_MM[paperSize];
  const heightMm = (canvas.height / canvas.width) * widthMm;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [widthMm, heightMm],
  });

  pdf.addImage(imgData, "PNG", 0, 0, widthMm, heightMm);
  pdf.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}

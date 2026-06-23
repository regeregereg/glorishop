"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Star, Check } from "lucide-react";
import { Service, Staff, Slot, ServiceCategory } from "@/types";
import {
  formatServiceListPrice,
  formatRupiah,
  formatTime,
  formatDateShort,
  toLocalDateString,
  totalServiceDuration,
  cn,
} from "@/lib/utils";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { PageSpinner } from "@/components/PageSpinner";
import { DownloadImageButton } from "@/components/DownloadImageButton";

// Flow disederhanakan dari 5 step jadi 2 step besar, supaya cocok dengan
// cara orang awam berpikir: "kapan saya bisa cukur, dan mau apa?" dulu,
// baru "siapa" (opsional) — bukan dipaksa pilih layanan & barber dulu
// sebelum tahu kapan tersedia.
//   "booking" — satu halaman gabungan: tanggal, jam, layanan, dan barber
//               (barber collapsed/opsional, default "Tanpa Preferensi")
//   "confirm" — ringkasan + pilih DP/Lunas + QRIS + upload bukti, semua
//               dalam satu alur scroll (sub-state createdBooking
//               membedakan "belum bayar" vs "menunggu verifikasi")
type Step = "booking" | "confirm";
type PaymentTypeChoice = "DP" | "FULL";

// Label kategori — konsisten dengan src/app/layanan/page.tsx. "product"
// (pomade, hair tonic, dst) sengaja tidak ditampilkan di sini karena
// booking ini untuk jasa, bukan jualan produk.
const SERVICE_CATEGORY_LABEL: Record<Exclude<ServiceCategory, "product">, string> = {
  haircut: "Haircut",
  treatment: "Treatment",
  colouring: "Colouring",
  home_service: "Home Service",
};
const SERVICE_CATEGORY_ORDER: Exclude<ServiceCategory, "product">[] = [
  "haircut",
  "treatment",
  "colouring",
  "home_service",
];

function BookingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tanggal & jam bisa datang dari kalender ketersediaan di Home
  // (?date=YYYY-MM-DD&time=HH:MM) — pelanggan sudah memilih jam kosong
  // di sana, jadi di sini jam itu "dikunci" dan tidak perlu dipilih
  // ulang. Pelanggan tetap bebas pilih layanan & barber seperti biasa;
  // kalau ternyata barber pilihannya tidak available di jam terkunci,
  // ada opsi "Ubah jam" untuk melepas kuncian.
  const initialDateParam = searchParams.get("date");
  const initialTimeParam = searchParams.get("time");

  const [step, setStep] = useState<Step>("booking");
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Staff[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const todayStr0 = toLocalDateString(new Date());
    return initialDateParam && initialDateParam >= todayStr0 ? initialDateParam : "";
  });
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    if (initialDateParam) {
      const parsed = new Date(initialDateParam + "T00:00:00");
      if (!isNaN(parsed.getTime())) {
        parsed.setDate(1);
        return parsed;
      }
    }
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [lockedTime, setLockedTime] = useState<string | null>(
    initialDateParam && initialTimeParam ? initialTimeParam : null
  );

  // Section "Pilih barber tertentu?" — collapsed by default. Pelanggan
  // awam yang tidak peduli siapa barbernya tidak perlu buka ini sama
  // sekali; "Tanpa Preferensi" otomatis berlaku selama section ini
  // tertutup.
  const [showBarberPicker, setShowBarberPicker] = useState(false);

  // Filter kategori untuk daftar layanan — "Semua" by default. Dengan 13
  // layanan, list 1 kolom bikin scroll sangat panjang; tab kategori +
  // grid 2 kolom membuat pelanggan bisa langsung loncat ke kategori yang
  // dicari tanpa scroll lewatin semuanya.
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<ServiceCategory | "all">("all");

  // Beberapa layanan bisa dipilih sekaligus (mis. Haircut + Creambath),
  // sama seperti memilih beberapa barang saat checkout. Dipakai sebagai Set
  // supaya gampang toggle on/off per kartu layanan, tapi urutan pilih
  // pelanggan tetap dijaga lewat selectedServiceOrder di bawah.
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [selectedServiceOrder, setSelectedServiceOrder] = useState<string[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<Staff | "any" | null>("any");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [paymentTypeChoice, setPaymentTypeChoice] = useState<PaymentTypeChoice>("DP");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState<{ id: string; name: string } | null | undefined>(undefined);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");

  // Error state untuk pemuatan data awal (sesi, layanan, barber) yang
  // wajib berhasil sebelum pelanggan bisa mulai booking. Kalau salah satu
  // gagal (mis. koneksi terputus), tampilkan layar error + tombol coba lagi
  // alih-alih membiarkan halaman macet kosong tanpa penjelasan.
  const [sessionError, setSessionError] = useState(false);
  const [servicesError, setServicesError] = useState(false);
  const [barbersError, setBarbersError] = useState(false);
  const [servicesLoaded, setServicesLoaded] = useState(false);
  const [barbersLoaded, setBarbersLoaded] = useState(false);
  const initError = sessionError || servicesError || barbersError;
  const initLoading = session === undefined || (!servicesLoaded && !servicesError) || (!barbersLoaded && !barbersError);

  // data setting publik (QRIS, dll) + booking yang baru dibuat (menunggu bukti transfer)
  const [paymentSettings, setPaymentSettings] = useState<{
    qris_image_url: string | null;
    payment_account_name: string | null;
    dp_percentage: string | null;
  } | null>(null);
  const [createdBooking, setCreatedBooking] = useState<{
    id: string;
    payment: { id: string; amount: number; payment_type: PaymentTypeChoice; expires_at: string } | null;
  } | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);

  // load session
  function loadSession() {
    setSessionError(false);
    fetch("/api/me", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Gagal memuat sesi.");
        return r.json();
      })
      .then((d) => setSession(d.user))
      .catch(() => setSessionError(true));
  }
  useEffect(() => {
    loadSession();
  }, []);

  // Cek apakah pelanggan ini masih punya booking yang menunggu pembayaran
  // (WAITING_PAYMENT). Ini menutup bug "macet di Pilih Layanan": kalau
  // pelanggan refresh halaman ini di tengah proses bayar, seluruh progress
  // di memori (step, createdBooking) hilang — padahal booking-nya sendiri
  // SUDAH tersimpan di database dan masih mengunci slot. Tanpa pengecekan
  // ini, UI seolah lupa total dan memulai dari awal lagi, padahal
  // seharusnya melanjutkan ke pembayaran booking yang sudah ada.
  // Redirect ke /booking/status/[id] (halaman yang sudah bisa menampilkan
  // QRIS + upload bukti untuk booking ID manapun) alih-alih membangun
  // ulang state pembayaran di sini.
  useEffect(() => {
    if (!session) return;
    // Kalau createdBooking sudah ada, pelanggan memang sedang aktif
    // menyelesaikan booking ini di halaman yang sama (bukan baru refresh)
    // — jangan ganggu dengan redirect.
    if (createdBooking) return;
    fetch(`/api/bookings?userId=${session.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const pending = (d?.bookings || []).find(
          (b: { status: string }) => b.status === "WAITING_PAYMENT"
        );
        if (pending) router.replace(`/booking/status/${pending.id}`);
      })
      .catch(() => {
        // Diamkan — kalau pengecekan ini gagal (mis. jaringan terputus),
        // biarkan pelanggan tetap bisa mulai booking baru seperti biasa,
        // jangan sampai justru memblokir pelanggan yang memang belum
        // punya booking aktif sama sekali.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // load setting pembayaran publik (QRIS, nama rekening, persentase DP)
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setPaymentSettings(d.settings || null))
      .catch(() => setPaymentSettings(null));
  }, []);

  // load services
  function loadServices() {
    setServicesError(false);
    fetch("/api/services")
      .then((r) => {
        if (!r.ok) throw new Error("Gagal memuat layanan.");
        return r.json();
      })
      .then((d) => {
        setServices(d.services || []);
        setServicesLoaded(true);
        const preselectId = searchParams.get("serviceId");
        if (preselectId) {
          const found = (d.services || []).find((s: Service) => s.id === preselectId);
          if (found) {
            setSelectedServiceIds(new Set([found.id]));
            setSelectedServiceOrder([found.id]);
          }
        }
      })
      .catch(() => setServicesError(true));
  }
  useEffect(() => {
    loadServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // load barbers
  function loadBarbers() {
    setBarbersError(false);
    fetch("/api/barbers")
      .then((r) => {
        if (!r.ok) throw new Error("Gagal memuat barber.");
        return r.json();
      })
      .then((d) => {
        setBarbers(d.barbers || []);
        setBarbersLoaded(true);
        const preselectBarberId = searchParams.get("barberId");
        if (preselectBarberId) {
          const found = (d.barbers || []).find((b: Staff) => b.id === preselectBarberId);
          if (found) {
            setSelectedBarber(found);
            setShowBarberPicker(true);
          }
        }
        // Restore barber dari pending booking jika ada
        try {
          const raw = sessionStorage.getItem("glori_pending_booking");
          if (raw) {
            const saved = JSON.parse(raw);
            if (saved.barberId && saved.barberId !== "any") {
              const match = (d.barbers || []).find((b: Staff) => b.id === saved.barberId);
              if (match) {
                setSelectedBarber(match);
                setShowBarberPicker(true);
              }
            }
          }
        } catch { /* abaikan */ }
      })
      .catch(() => setBarbersError(true));
  }
  useEffect(() => {
    loadBarbers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function retryInitialLoad() {
    if (sessionError) loadSession();
    if (servicesError) loadServices();
    if (barbersError) loadBarbers();
  }

  // generate semua tanggal di bulan yang sedang dilihat (viewMonth) untuk date picker
  useEffect(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = toLocalDateString(new Date());

    // Untuk bulan yang sedang berjalan, tanggal yang sudah lewat tidak
    // usah dimasukkan ke array sama sekali (bukan cuma di-disable) —
    // supaya date picker langsung mulai dari hari ini, tanpa pelanggan
    // harus geser melewati tanggal-tanggal mati duluan. Untuk bulan lain
    // (sudah pasti di masa depan, karena navigasi mundur dikunci ke bulan
    // ini), semua tanggal otomatis valid.
    const arr: string[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = toLocalDateString(new Date(year, month, day));
      if (dateStr >= todayStr) arr.push(dateStr);
    }
    setDates(arr);

    // kalau tanggal yang sedang dipilih bukan di bulan ini, pilih tanggal
    // pertama yang valid (hari ini kalau bulan ini, atau tanggal 1 kalau
    // bulan depan; tidak boleh memilih tanggal yang sudah lewat)
    setSelectedDate((prev) => {
      if (prev && arr.includes(prev)) return prev;
      return arr[0] || "";
    });
    setSelectedTime(null);
  }, [viewMonth]);

  function goToMonth(offset: number) {
    setViewMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + offset);
      next.setDate(1);
      return next;
    });
  }

  const isCurrentMonth =
    viewMonth.getFullYear() === new Date().getFullYear() &&
    viewMonth.getMonth() === new Date().getMonth();
  const monthLabel = viewMonth.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  // Muat slot begitu tanggal dipilih — tidak lagi terikat ke step
  // tertentu, karena di flow baru tanggal/jam dan layanan/barber semua
  // berada di satu halaman yang sama.
  function loadSlots() {
    if (!selectedDate) return;
    const barberId = selectedBarber && selectedBarber !== "any" ? selectedBarber.id : "";
    const url = barberId
      ? `/api/slots?barberId=${barberId}&date=${selectedDate}`
      : `/api/slots?date=${selectedDate}`;
    setSlotsLoading(true);
    setSlotsError("");
    fetch(url)
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error || `Gagal memuat slot (status ${r.status})`);
        }
        return r.json();
      })
      .then((d) => setSlots(d.slots || []))
      .catch((err) => {
        setSlots([]);
        setSlotsError(err.message || "Gagal memuat slot. Coba lagi.");
      })
      .finally(() => setSlotsLoading(false));
  }
  useEffect(() => {
    loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedBarber]);

  // Daftar objek Service lengkap dari id-id yang dipilih, urut sesuai urutan dipilih.
  const selectedServices = useMemo(
    () =>
      selectedServiceOrder
        .map((id) => services.find((s) => s.id === id))
        .filter((s): s is Service => !!s),
    [selectedServiceOrder, services]
  );

  // HOME SERVICE: layanan ke rumah yang wajib booking di muka dan hanya
  // bisa dikerjakan barber tertentu (diatur admin lewat service_barbers,
  // lihat supabase/migration_walkin_homeservice_commission.sql). Begitu
  // salah satu layanan ini terpilih, pelanggan WAJIB pilih barber spesifik
  // dari daftar yang diizinkan — opsi "Tanpa Preferensi" tidak berlaku.
  const homeServiceItems = useMemo(
    () => selectedServices.filter((s) => s.is_home_service_only || s.category === "home_service"),
    [selectedServices]
  );
  const requiresSpecificBarber = homeServiceItems.length > 0;

  // Barber yang boleh dipilih = irisan (intersection) dari daftar barber_ids
  // SEMUA layanan home service yang terpilih sekaligus — kalau pelanggan
  // pilih 2 layanan home service yang barbernya berbeda, hanya barber yang
  // menerima KEDUANYA yang valid dipilih.
  const allowedBarberIds = useMemo(() => {
    if (homeServiceItems.length === 0) return null;
    const idLists: string[][] = homeServiceItems.map((s) => s.barber_ids ?? []);
    const intersection = idLists.reduce<string[]>((acc, list, idx) => {
      if (idx === 0) return list;
      const listSet = new Set(list);
      return acc.filter((id) => listSet.has(id));
    }, []);
    return new Set(intersection);
  }, [homeServiceItems]);

  const eligibleBarbersForPicker = useMemo(() => {
    if (!allowedBarberIds) return barbers;
    return barbers.filter((b) => allowedBarberIds.has(b.id));
  }, [barbers, allowedBarberIds]);

  // Begitu layanan home service terpilih: paksa buka section pilih barber
  // (tidak bisa "Tanpa Preferensi" lagi), dan kalau barber yang sedang
  // terpilih ternyata tidak ada di daftar yang diizinkan, kosongkan dulu
  // pilihannya supaya pelanggan tidak salah pilih barber yang tidak
  // menerima layanan tersebut.
  useEffect(() => {
    if (!requiresSpecificBarber) return;
    setShowBarberPicker(true);
    setSelectedBarber((prev) => {
      if (prev === "any") return null;
      if (prev && allowedBarberIds && !allowedBarberIds.has(prev.id)) return null;
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requiresSpecificBarber, allowedBarberIds]);

  const totalDurationMin = useMemo(
    () => totalServiceDuration(selectedServices),
    [selectedServices]
  );

  // Kategori yang benar-benar punya layanan, urut sesuai SERVICE_CATEGORY_ORDER.
  // Tab kategori yang kosong tidak ditampilkan, supaya tidak ada tab mati.
  const availableCategories = useMemo(() => {
    const present = new Set(services.map((s) => s.category));
    return SERVICE_CATEGORY_ORDER.filter((c) => present.has(c));
  }, [services]);

  // Layanan yang ditampilkan sesuai tab kategori aktif. "all" menampilkan
  // semua, diurutkan sesuai sort_order dari database (urutan asli services).
  const filteredServices = useMemo(() => {
    if (serviceCategoryFilter === "all") return services;
    return services.filter((s) => s.category === serviceCategoryFilter);
  }, [services, serviceCategoryFilter]);

  // Berapa slot berurutan yang dibutuhkan untuk total durasi semua layanan
  // yang dipilih (slot dibuat per-blok waktu, mis. tiap 30 menit).
  const slotsNeededCount = useMemo(() => {
    if (selectedServices.length === 0 || slots.length === 0) return 1;
    const sample = slots[0];
    const slotLengthMin =
      timeToMinutes(sample.end_time) - timeToMinutes(sample.start_time) || 30;
    return Math.max(1, Math.ceil(totalDurationMin / slotLengthMin));
  }, [selectedServices.length, slots, totalDurationMin]);

  // PERFORMA: kelompokkan & urutkan slot per barber+tanggal SATU KALI saja
  // (bukan di tiap iterasi .map() saat render). Sebelumnya, mengecek
  // "apakah ada cukup slot berurutan setelah slot ini" dilakukan dengan
  // filter+sort ulang dari SELURUH daftar slot untuk SETIAP slot yang
  // ditampilkan — O(n²) dan terasa berat kalau slotnya banyak (banyak
  // barber/jam). Sekarang hasil pengelompokan ini disimpan di sini, dan
  // pengecekan ketersediaan tinggal cari index langsung (O(1) lookup),
  // sehingga total kerja jadi O(n log n) sekali per perubahan data, bukan
  // dihitung ulang dari nol setiap render.
  const sortedSlotsByBarberDate = useMemo(() => {
    const groups = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = `${s.barber_id}|${s.date}`;
      const arr = groups.get(key);
      if (arr) arr.push(s);
      else groups.set(key, [s]);
    }
    for (const arr of groups.values()) {
      arr.sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return groups;
  }, [slots]);

  // Set berisi id slot yang VALID dipilih (cukup slot berurutan setelahnya).
  // Dihitung sekali per perubahan slot/kebutuhan durasi, dipakai sebagai
  // lookup O(1) saat render tiap kartu slot — bukan dihitung ulang per kartu.
  const validSlotIds = useMemo(() => {
    const valid = new Set<string>();
    if (slotsNeededCount <= 1) {
      for (const s of slots) valid.add(s.id);
      return valid;
    }
    for (const [, sameBarberDate] of sortedSlotsByBarberDate) {
      for (let startIdx = 0; startIdx < sameBarberDate.length; startIdx++) {
        let count = 1;
        let i = startIdx;
        let ok = true;
        while (count < slotsNeededCount) {
          const current = sameBarberDate[i];
          const next = sameBarberDate[i + 1];
          if (!next || !next.is_available || next.start_time !== current.end_time) {
            ok = false;
            break;
          }
          count += 1;
          i += 1;
        }
        if (ok) valid.add(sameBarberDate[startIdx].id);
      }
    }
    return valid;
  }, [sortedSlotsByBarberDate, slots, slotsNeededCount]);

  // Daftar jam unik yang valid dipilih (cukup slot berurutan, dari
  // barber manapun bila mode "Tanpa Preferensi" — atau dari barber
  // spesifik bila section barber dibuka & dipilih). Ditampilkan sebagai
  // satu tombol per jam, BUKAN per barber, karena pelanggan awam pilih
  // jam dulu, baru (opsional) peduli siapa barbernya.
  const timeOptions = useMemo(() => {
    const map = new Map<string, Slot[]>(); // start_time -> daftar slot valid di jam itu
    for (const s of slots) {
      if (!s.is_available) continue;
      if (lockedTime && s.start_time !== lockedTime) continue;
      if (!validSlotIds.has(s.id)) continue;
      const arr = map.get(s.start_time);
      if (arr) arr.push(s);
      else map.set(s.start_time, [s]);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, slotsAtTime]) => ({ time, slotsAtTime }));
  }, [slots, validSlotIds, lockedTime]);

  // Begitu pelanggan tap satu jam, otomatis pilih satu slot konkret untuk
  // jam itu — barber pertama yang available kalau mode "Tanpa Preferensi"
  // (mis. sistem yang assign, bukan pelanggan bingung harus pilih siapa),
  // atau slot milik barber spesifik kalau section barber sedang dibuka.
  function handleSelectTime(time: string) {
    setSelectedTime((prev) => (prev === time ? null : time));
  }

  // Kalau jam datang terkunci dari kalender Home, langsung tandai
  // terpilih begitu jam itu valid — pelanggan sudah memilihnya di Home,
  // jadi tidak perlu tap ulang jam yang sama di sini.
  useEffect(() => {
    if (!lockedTime) return;
    if (timeOptions.some((t) => t.time === lockedTime)) {
      setSelectedTime(lockedTime);
    }
  }, [lockedTime, timeOptions]);

  useEffect(() => {
    if (!selectedTime) {
      setSelectedSlot(null);
      return;
    }
    const match = timeOptions.find((t) => t.time === selectedTime);
    if (!match) {
      // Jam yang sebelumnya dipilih sudah tidak valid lagi (mis. baru
      // saja penuh dibooking, atau barber yang dipilih tidak available
      // di jam ini) — kosongkan, jangan diam-diam pilih jam lain supaya
      // pelanggan tidak bingung kenapa pilihannya "berubah sendiri".
      setSelectedSlot(null);
      return;
    }
    setSelectedSlot(match.slotsAtTime[0]);
  }, [selectedTime, timeOptions]);

  function toggleService(service: Service) {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(service.id)) {
        next.delete(service.id);
        setSelectedServiceOrder((order) => order.filter((id) => id !== service.id));
      } else {
        next.add(service.id);
        setSelectedServiceOrder((order) => [...order, service.id]);
      }
      return next;
    });
  }

  // Pelanggan dianggap "siap lanjut" kalau sudah pilih minimal 1 layanan
  // DAN sudah pilih jam yang valid (selectedSlot otomatis terisi lewat
  // effect di atas begitu jam dipilih).
  const canProceedToConfirm =
    selectedServices.length > 0 &&
    !!selectedSlot &&
    (!requiresSpecificBarber || (!!selectedBarber && selectedBarber !== "any"));

  function goNext() {
    if (step === "booking" && canProceedToConfirm) setStep("confirm");
  }

  function goBack() {
    if (step === "confirm" && !createdBooking) setStep("booking");
    else {
      // Di step pertama ("booking"), atau di step "confirm" yang sudah
      // ada booking aktif (createdBooking, sedang menunggu pembayaran) —
      // keluar dari flow booking ke halaman asal. router.back() saja
      // tidak cukup diandalkan: kalau halaman ini diakses lewat refresh
      // manual, browser history Next.js bisa kehilangan jejak halaman
      // sebelumnya, membuat tombol back terasa "macet" (tidak melakukan
      // apa-apa). Fallback tegas ke Home kalau itu terjadi.
      if (window.history.length > 1) router.back();
      else router.push("/");
    }
  }

  // Restore pending booking state dari sessionStorage setelah login
  useEffect(() => {
    if (session === null || session === undefined) return;
    const raw = sessionStorage.getItem("glori_pending_booking");
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      if (saved.serviceIds?.length) {
        setSelectedServiceIds(new Set(saved.serviceIds));
        setSelectedServiceOrder(saved.serviceIds);
      }
      if (saved.barberId === "any") {
        setSelectedBarber("any");
      }
      if (saved.date) {
        const savedDate = new Date(saved.date);
        setViewMonth(new Date(savedDate.getFullYear(), savedDate.getMonth(), 1));
        setSelectedDate(saved.date);
      }
      // selectedSlot tidak disimpan langsung — begitu selectedTime diisi,
      // effect timeOptions/selectedSlot di atas akan resolve ulang slot
      // konkretnya dari data slots yang baru di-fetch (slot lama bisa
      // sudah tidak valid kalau pelanggan sempat lama login).
      if (saved.time) setSelectedTime(saved.time);
      if (saved.paymentType) setPaymentTypeChoice(saved.paymentType);
      sessionStorage.removeItem("glori_pending_booking");
    } catch {
      sessionStorage.removeItem("glori_pending_booking");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  function handleConfirm() {
    if (session === null) {
      // Simpan state booking ke sessionStorage sebelum redirect login
      sessionStorage.setItem(
        "glori_pending_booking",
        JSON.stringify({
          serviceIds: selectedServiceOrder,
          barberId: selectedBarber === "any" ? "any" : selectedBarber?.id ?? null,
          date: selectedDate,
          time: selectedTime,
          paymentType: paymentTypeChoice,
        })
      );
      router.push(`/login?next=/booking`);
      return;
    }
    handleCreateBooking();
  }

  async function handleCreateBooking() {
    if (selectedServices.length === 0 || !selectedSlot) return;
    // Layanan home service wajib barber spesifik yang memang menerima —
    // dicek lagi di sini sebagai jaga-jaga UI, validasi sebenarnya tetap
    // di server (POST /api/bookings).
    if (requiresSpecificBarber && (!selectedBarber || selectedBarber === "any")) {
      setError("Pilih barber tertentu dulu untuk layanan home service.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_ids: selectedServiceOrder,
          slot_id: selectedSlot.id,
          barber_id: selectedSlot.barber_id,
          payment_type: paymentTypeChoice,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal membuat booking.");
        return;
      }
      setCreatedBooking(data.booking);
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadProof() {
    if (!proofFile || !createdBooking) return;
    setUploadingProof(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", proofFile);
      formData.append("booking_id", createdBooking.id);
      const res = await fetch("/api/payments/upload-proof", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal mengunggah bukti transfer.");
        return;
      }
      setUploadDone(true);
      setTimeout(() => router.push("/booking/status"), 1200);
    } catch {
      setError("Gagal mengunggah bukti transfer. Coba lagi.");
    } finally {
      setUploadingProof(false);
    }
  }

  const barberForSlot = (barberId: string) => barbers.find((b) => b.id === barberId);

  if (initError) {
    return (
      <div className="min-h-screen bg-bg">
        <ErrorState
          fullScreen
          title="Gagal memuat halaman booking"
          message="Periksa koneksi internet kamu, lalu coba lagi."
          onRetry={retryInitialLoad}
        />
      </div>
    );
  }

  if (initLoading) {
    return <PageSpinner fullScreen label="Menyiapkan halaman booking..." />;
  }

  return (
    <div className="min-h-screen bg-bg pb-28">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border-soft bg-bg/90 px-5 py-4 backdrop-blur-lg">
        <button
          onClick={goBack}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border-soft text-text-secondary"
        >
          <ChevronLeft size={18} />
        </button>
        <h1 className="font-display text-lg font-bold">
          {step === "booking" && "Booking"}
          {step === "confirm" && (createdBooking ? "Pembayaran" : "Konfirmasi & Bayar")}
        </h1>
      </header>

      {/* Step indicator — cuma 2 step besar */}
      <div className="flex gap-1.5 px-5 pt-4">
        {(["booking", "confirm"] as Step[]).map((s) => (
          <div
            key={s}
            className={cn(
              "h-1 flex-1 rounded-full",
              s === step || (["booking", "confirm"] as Step[]).indexOf(s) < (["booking", "confirm"] as Step[]).indexOf(step)
                ? "bg-accent"
                : "bg-border-soft"
            )}
          />
        ))}
      </div>

      <div className="px-5 pt-5">
        {/* STEP: BOOKING — gabungan tanggal, jam, layanan, & barber
            (opsional) dalam satu halaman. Urutan tampilan ikut cara
            orang awam berpikir: "kapan saya bisa cukur?" dulu, baru
            "mau apa", baru (kalau peduli) "sama siapa". */}
        {step === "booking" && (
          <div className="flex flex-col gap-6">
            {/* Jam sudah dikunci dari kalender ketersediaan di Home —
                pelanggan tinggal pilih layanan & (opsional) barber.
                Tetap diberi opsi lepas kuncian. */}
            {lockedTime && (
              <div className="flex items-center justify-between rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3">
                <p className="text-xs text-text-primary">
                  Jam <span className="font-semibold">{formatTime(lockedTime)}</span> sudah
                  dipilih dari halaman utama.
                </p>
                <button
                  type="button"
                  onClick={() => setLockedTime(null)}
                  className="shrink-0 text-xs font-semibold text-accent underline"
                >
                  Ubah jam
                </button>
              </div>
            )}

            {/* 1. KAPAN — tanggal & jam */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                1. Pilih Tanggal
              </p>
              <div className="flex items-center justify-between">
                <p className="font-display text-sm font-semibold capitalize">{monthLabel}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => goToMonth(-1)}
                    disabled={isCurrentMonth}
                    aria-label="Bulan sebelumnya"
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border border-border-soft transition-colors",
                      isCurrentMonth
                        ? "cursor-not-allowed text-text-tertiary/40"
                        : "text-text-secondary hover:border-accent/40 hover:text-text-primary"
                    )}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => goToMonth(1)}
                    aria-label="Bulan berikutnya"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border-soft text-text-secondary transition-colors hover:border-accent/40 hover:text-text-primary"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Date picker horizontal scroll */}
              <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                {dates.map((d) => {
                  const dateObj = new Date(d + "T00:00:00");
                  const dayNum = dateObj.getDate();
                  const dayName = dateObj.toLocaleDateString("id-ID", { weekday: "short" });
                  const isSelected = d === selectedDate;
                  return (
                    <button
                      key={d}
                      onClick={() => {
                        setSelectedDate(d);
                        setSelectedTime(null);
                      }}
                      className={cn(
                        "flex shrink-0 flex-col items-center justify-center rounded-xl px-3.5 py-2.5 text-center transition-colors",
                        isSelected
                          ? "bg-accent text-black"
                          : "bg-surface border border-border-soft text-text-secondary hover:border-accent/40"
                      )}
                    >
                      <span className="text-sm font-semibold">{dayNum}</span>
                      <span className="mt-0.5 uppercase">{dayName}</span>
                    </button>
                  );
                })}
              </div>

              <p className="mb-3 mt-5 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                Pilih Jam
              </p>

              {slotsLoading && (
                <p className="py-8 text-center text-sm text-text-secondary">Memuat jam kosong...</p>
              )}

              {!slotsLoading && slotsError && (
                <div className="rounded-2xl border border-status-cancelled/30 bg-status-cancelled/10 px-4 py-4 text-center">
                  <p className="text-sm text-status-cancelled">{slotsError}</p>
                  <button
                    onClick={loadSlots}
                    className="mt-2 text-xs font-semibold text-accent underline"
                  >
                    Coba lagi
                  </button>
                </div>
              )}

              {!slotsLoading && !slotsError && timeOptions.length > 0 && (
                <div className="grid grid-cols-3 gap-2.5">
                  {timeOptions.map(({ time }) => (
                    <button
                      key={time}
                      onClick={() => handleSelectTime(time)}
                      className={cn(
                        "rounded-xl border px-3 py-3 text-center text-sm font-semibold transition-colors",
                        selectedTime === time
                          ? "border-accent bg-accent text-black"
                          : "border-border-soft bg-surface text-text-primary hover:border-accent/40"
                      )}
                    >
                      {formatTime(time)}
                    </button>
                  ))}
                </div>
              )}

              {!slotsLoading && !slotsError && slots.length === 0 && (
                <p className="py-8 text-center text-sm text-text-secondary">
                  Belum ada jam yang dibuka untuk tanggal ini. Silakan pilih tanggal lain
                  atau hubungi barbershop langsung.
                </p>
              )}

              {!slotsLoading && !slotsError && slots.length > 0 && timeOptions.length === 0 && (
                <p className="py-8 text-center text-sm text-text-secondary">
                  {lockedTime
                    ? `Jam ${formatTime(lockedTime)} baru saja penuh dibooking orang lain. Tap "Ubah jam" di atas untuk pilih jam lain.`
                    : "Semua jam di tanggal ini sudah penuh dibooking. Coba pilih tanggal lain."}
                </p>
              )}
            </div>

            {/* 2. APA — layanan, bisa pilih lebih dari satu. Tab kategori +
                grid 2 kolom (bukan list 1 kolom) supaya dengan 13 layanan
                pelanggan tidak perlu scroll panjang — bisa langsung loncat
                ke kategori yang dicari. */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                2. Pilih Layanan
              </p>

              {availableCategories.length > 1 && (
                <div className="-mx-5 mb-3 flex gap-1.5 overflow-x-auto px-5 pb-1">
                  <button
                    onClick={() => setServiceCategoryFilter("all")}
                    className={cn(
                      "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                      serviceCategoryFilter === "all"
                        ? "border-accent bg-accent text-black"
                        : "border-border-soft bg-surface text-text-secondary hover:border-accent/40"
                    )}
                  >
                    Semua
                  </button>
                  {availableCategories.map((c) => (
                    <button
                      key={c}
                      onClick={() => setServiceCategoryFilter(c)}
                      className={cn(
                        "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                        serviceCategoryFilter === c
                          ? "border-accent bg-accent text-black"
                          : "border-border-soft bg-surface text-text-secondary hover:border-accent/40"
                      )}
                    >
                      {SERVICE_CATEGORY_LABEL[c]}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                {filteredServices.map((s) => {
                  const checked = selectedServiceIds.has(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleService(s)}
                      className={cn(
                        "relative rounded-xl border bg-surface px-3 py-3 text-left transition-colors",
                        checked ? "border-accent" : "border-border-soft hover:border-accent/40"
                      )}
                    >
                      <div
                        className={cn(
                          "absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-md border-2 transition-colors",
                          checked ? "border-accent bg-accent text-black" : "border-border-soft"
                        )}
                      >
                        {checked && <Check size={10} strokeWidth={3} />}
                      </div>
                      <p className="pr-6 font-display text-[13px] font-semibold leading-tight">
                        {s.name}
                      </p>
                      <p className="mt-1.5 text-[11px] text-text-secondary">
                        {s.duration_minutes} menit
                      </p>
                      <p className="mt-1 font-display text-xs font-bold text-accent">
                        {formatServiceListPrice([s])}
                      </p>
                    </button>
                  );
                })}
                {services.length === 0 && (
                  <p className="col-span-2 py-6 text-center text-sm text-text-secondary">
                    Memuat layanan...
                  </p>
                )}
                {services.length > 0 && filteredServices.length === 0 && (
                  <p className="col-span-2 py-6 text-center text-sm text-text-secondary">
                    Belum ada layanan di kategori ini.
                  </p>
                )}
              </div>
              {selectedServices.length > 1 && (
                <p className="mt-3 text-xs text-text-tertiary">
                  {selectedServices.length} layanan dipilih • total {totalDurationMin} menit
                </p>
              )}
            </div>

            {/* 3. SAMA SIAPA — opsional, default "Tanpa Preferensi".
                Collapsed by default supaya pelanggan yang tidak peduli
                siapa barbernya tidak perlu berhenti di sini sama sekali.
                Kalau ada layanan home service terpilih, section ini WAJIB
                terbuka dan tidak bisa ditutup — pelanggan harus pilih
                barber spesifik dari daftar yang menerima layanan tersebut. */}
            <div>
              <button
                type="button"
                onClick={() => {
                  if (requiresSpecificBarber) return;
                  setShowBarberPicker((v) => !v);
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-border-soft bg-surface px-4 py-3.5 text-left"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {requiresSpecificBarber ? "Pilih barber (wajib untuk home service)" : "Pilih barber tertentu?"}
                  </p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {selectedBarber === "any"
                      ? "Saat ini: Tanpa Preferensi"
                      : `Saat ini: ${selectedBarber?.name ?? "Belum dipilih"}`}
                  </p>
                </div>
                {!requiresSpecificBarber && (
                  <ChevronRight
                    size={16}
                    className={cn(
                      "text-text-tertiary transition-transform",
                      showBarberPicker && "rotate-90"
                    )}
                  />
                )}
              </button>

              {requiresSpecificBarber && (
                <p className="mt-2 text-xs text-text-tertiary">
                  {homeServiceItems.map((s) => s.name).join(", ")} hanya bisa dikerjakan barber tertentu — pilih salah satu di bawah.
                </p>
              )}

              {showBarberPicker && (
                <div className="mt-3 flex flex-col gap-3">
                  {!requiresSpecificBarber && (
                    <button
                      onClick={() => {
                        setSelectedBarber("any");
                        setSelectedTime(null);
                      }}
                      className={cn(
                        "flex items-center gap-4 rounded-2xl border bg-surface px-4 py-4 text-left transition-colors",
                        selectedBarber === "any" ? "border-accent" : "border-border-soft hover:border-accent/40"
                      )}
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent font-display font-bold">
                        ?
                      </div>
                      <div>
                        <p className="font-display text-sm font-semibold">Tanpa Preferensi</p>
                        <p className="text-xs text-text-secondary">Sistem akan assign barber otomatis</p>
                      </div>
                    </button>
                  )}
                  {eligibleBarbersForPicker.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => {
                        setSelectedBarber(b);
                        setSelectedTime(null);
                      }}
                      className={cn(
                        "flex items-center gap-4 rounded-2xl border bg-surface px-4 py-4 text-left transition-colors",
                        selectedBarber !== "any" && selectedBarber?.id === b.id
                          ? "border-accent"
                          : "border-border-soft hover:border-accent/40"
                      )}
                    >
                      <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-accent-soft text-accent font-display font-bold">
                        {b.photo_url ? (
                          <Image src={b.photo_url} alt={b.name} fill sizes="48px" className="object-cover" />
                        ) : (
                          b.name.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-display text-sm font-semibold">{b.name}</p>
                        <p className="flex items-center gap-1 text-xs text-text-secondary">
                          <Star size={11} className="fill-accent text-accent" /> 4.9
                        </p>
                      </div>
                    </button>
                  ))}
                  {requiresSpecificBarber && eligibleBarbersForPicker.length === 0 && (
                    <p className="text-xs text-text-tertiary">
                      Belum ada barber yang menerima kombinasi layanan home service ini. Coba kurangi layanan home service yang dipilih, atau hubungi barbershop langsung.
                    </p>
                  )}
                  {!requiresSpecificBarber && (
                    <p className="text-xs text-text-tertiary">
                      Ganti barber bisa mengubah jam yang tersedia — kalau jam yang
                      sudah dipilih ternyata tidak cocok, pilih ulang jamnya di atas.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Ringkasan total — selalu kelihatan begitu ada yang dipilih,
                supaya tidak ada kejutan harga/durasi baru di step berikutnya. */}
            {(selectedServices.length > 0 || selectedSlot) && (
              <div className="rounded-2xl border border-border-soft bg-surface-2 px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-text-secondary">Estimasi Total</p>
                  <p className="font-display text-sm font-bold text-accent">
                    {selectedServices.length > 0 ? formatServiceListPrice(selectedServices) : "—"}
                  </p>
                </div>
                {selectedSlot && (
                  <p className="mt-1 text-xs text-text-tertiary">
                    {formatDateShort(selectedSlot.date)} • {formatTime(selectedSlot.start_time)}
                    {selectedServices.length > 0 && ` • ${totalDurationMin} menit`}
                  </p>
                )}
              </div>
            )}

            {error && (
              <p className="rounded-xl bg-status-cancelled/10 px-4 py-3 text-sm text-status-cancelled">
                {error}
              </p>
            )}
          </div>
        )}

        {/* STEP: CONFIRM & BAYAR — ringkasan, pilih DP/Lunas, lalu QRIS +
            upload bukti, semua dalam satu alur scroll. Sub-state
            createdBooking membedakan "belum bayar" vs "menunggu
            verifikasi", supaya pelanggan tidak perlu pindah-pindah
            halaman untuk dua hal yang sebenarnya berkaitan erat. */}
        {step === "confirm" && selectedServices.length > 0 && selectedSlot && (
          <div className="flex flex-col gap-4">
            {!createdBooking ? (
              <>
                <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-5">
                  <p className="text-xs text-text-secondary">
                    Layanan ({selectedServices.length})
                  </p>
                  <div className="mt-2 flex flex-col gap-2">
                    {selectedServices.map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-3">
                        <p className="font-display text-sm font-semibold">{s.name}</p>
                        <p className="shrink-0 text-xs font-semibold text-text-secondary">
                          {formatServiceListPrice([s])}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="my-4 h-px bg-border-soft" />

                  <p className="text-xs text-text-secondary">Barber</p>
                  <p className="font-display mt-1 text-sm font-semibold">
                    {selectedBarber === "any"
                      ? "Sesuai ketersediaan"
                      : barberForSlot(selectedSlot.barber_id)?.name ?? "—"}
                  </p>

                  <div className="my-4 h-px bg-border-soft" />

                  <p className="text-xs text-text-secondary">Tanggal & Waktu</p>
                  <p className="font-display mt-1 text-sm font-semibold">
                    {formatDateShort(selectedSlot.date)} • {formatTime(selectedSlot.start_time)}
                  </p>
                  <p className="mt-1 text-xs text-text-tertiary">
                    Estimasi durasi total: {totalDurationMin} menit
                  </p>

                  <div className="my-4 h-px bg-border-soft" />

                  <p className="text-xs text-text-secondary">Estimasi Total Harga</p>
                  <p className="font-display mt-1 text-base font-bold text-accent">
                    {formatServiceListPrice(selectedServices)}
                  </p>
                </div>

                {session === null && (
                  <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
                    Kamu perlu login untuk menyelesaikan booking ini.
                  </p>
                )}

                <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                  Jenis Pembayaran
                </p>

                {(() => {
                  const dpPercent = Number(paymentSettings?.dp_percentage ?? 50) || 50;
                  const basePrice = selectedServices.reduce((sum, s) => {
                    if (s.price != null) return sum + s.price;
                    if (s.price_min != null) return sum + s.price_min;
                    return sum;
                  }, 0);
                  const dpAmount = Math.ceil((basePrice * dpPercent) / 100);
                  return (
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => setPaymentTypeChoice("DP")}
                        className={cn(
                          "flex items-center justify-between rounded-2xl border bg-surface px-4 py-4 text-left transition-colors",
                          paymentTypeChoice === "DP" ? "border-accent" : "border-border-soft hover:border-accent/40"
                        )}
                      >
                        <div>
                          <p className="font-display text-sm font-semibold">DP {dpPercent}%</p>
                          <p className="mt-0.5 text-xs text-text-secondary">
                            Sisa dibayar di tempat setelah layanan selesai.
                          </p>
                        </div>
                        <p className="font-display text-sm font-bold text-accent">
                          {formatRupiah(dpAmount)}
                        </p>
                      </button>

                      <button
                        onClick={() => setPaymentTypeChoice("FULL")}
                        className={cn(
                          "flex items-center justify-between rounded-2xl border bg-surface px-4 py-4 text-left transition-colors",
                          paymentTypeChoice === "FULL" ? "border-accent" : "border-border-soft hover:border-accent/40"
                        )}
                      >
                        <div>
                          <p className="font-display text-sm font-semibold">Bayar Lunas</p>
                          <p className="mt-0.5 text-xs text-text-secondary">
                            Bayar penuh sekarang, tidak ada tagihan susulan.
                          </p>
                        </div>
                        <p className="font-display text-sm font-bold text-accent">
                          {formatRupiah(basePrice)}
                        </p>
                      </button>
                    </div>
                  );
                })()}

                <p className="text-xs text-text-tertiary">
                  Setelah lanjut, kamu akan diberi 30 menit untuk mengirim bukti transfer
                  sebelum slot ini dilepas kembali.
                </p>

                {error && (
                  <p className="rounded-xl bg-status-cancelled/10 px-4 py-3 text-sm text-status-cancelled">
                    {error}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-5 text-center">
                  <p className="text-xs text-text-secondary">Total yang harus dibayar</p>
                  <p className="font-display mt-1 text-2xl font-bold text-accent">
                    {formatRupiah(createdBooking.payment?.amount ?? 0)}
                  </p>
                  <p className="mt-1 text-xs text-text-tertiary">
                    {createdBooking.payment?.payment_type === "FULL" ? "Bayar Lunas" : "Down Payment (DP)"}
                  </p>
                </div>

                <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-border-soft bg-surface p-5">
                  {paymentSettings?.qris_image_url ? (
                    <>
                      <div className="relative h-56 w-56 overflow-hidden rounded-xl">
                        <Image
                          src={paymentSettings.qris_image_url}
                          alt="QRIS Glori Barbershop"
                          fill
                          sizes="224px"
                          className="object-contain"
                        />
                      </div>
                      <DownloadImageButton
                        src={paymentSettings.qris_image_url}
                        filename="QRIS-Glori-Barbershop.png"
                        label="Simpan QRIS"
                      />
                    </>
                  ) : (
                    <p className="py-10 text-center text-sm text-text-secondary">
                      QRIS belum diatur admin. Silakan hubungi barbershop langsung untuk
                      info pembayaran.
                    </p>
                  )}
                  <p className="text-xs text-text-secondary">
                    Scan QRIS di atas lewat e-wallet atau m-banking, lalu unggah bukti
                    transfer di bawah.
                  </p>
                </div>

                {!uploadDone ? (
                  <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-5">
                    <p className="mb-2 text-sm font-semibold text-text-secondary">
                      Unggah Bukti Transfer
                    </p>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
                      onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                      className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-xl file:border file:border-border-soft file:bg-surface-2 file:px-3.5 file:py-2 file:text-xs file:font-semibold file:text-text-primary"
                    />
                    {proofFile && (
                      <p className="mt-2 text-xs text-text-tertiary">{proofFile.name}</p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-[var(--radius-card)] border border-status-confirmed/30 bg-status-confirmed/10 px-4 py-5 text-center">
                    <p className="text-sm font-semibold text-status-confirmed">
                      Bukti transfer terkirim!
                    </p>
                    <p className="mt-1 text-xs text-text-secondary">
                      Admin akan memverifikasi pembayaranmu. Mengalihkan ke status booking...
                    </p>
                  </div>
                )}

                {error && (
                  <p className="rounded-xl bg-status-cancelled/10 px-4 py-3 text-sm text-status-cancelled">
                    {error}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Tombol "Lanjut" untuk step BOOKING — selalu kelihatan supaya
          pelanggan tahu langkah berikutnya, tapi disabled sampai jam +
          minimal 1 layanan sudah dipilih. Label menyesuaikan apa yang
          masih kurang, supaya jelas harus ngapain. */}
      {step === "booking" && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border-soft bg-surface/95 px-5 py-4 backdrop-blur-lg">
          <Button variant="order" size="lg" fullWidth onClick={goNext} disabled={!canProceedToConfirm}>
            {!selectedSlot
              ? "Pilih tanggal & jam dulu"
              : selectedServices.length === 0
              ? "Pilih layanan dulu"
              : "Lanjut ke Konfirmasi"}
          </Button>
        </div>
      )}

      {step === "confirm" && !createdBooking && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border-soft bg-surface/95 px-5 py-4 backdrop-blur-lg">
          <Button variant="order" size="lg" fullWidth onClick={handleConfirm} disabled={submitting}>
            {session === null
              ? "Login & Lanjutkan"
              : submitting
              ? "Memproses..."
              : "Bayar Sekarang"}
          </Button>
        </div>
      )}

      {step === "confirm" && createdBooking && !uploadDone && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border-soft bg-surface/95 px-5 py-4 backdrop-blur-lg">
          <Button variant="order" size="lg" fullWidth onClick={handleUploadProof} disabled={uploadingProof || !proofFile}>
            {uploadingProof ? "Mengunggah..." : "Kirim Bukti Transfer"}
          </Button>
        </div>
      )}
    </div>
  );
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default function BookingPage() {
  return (
    <Suspense>
      <BookingFlow />
    </Suspense>
  );
}

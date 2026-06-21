import { ComponentType } from "react";

interface NavGradientIconProps {
  icon: ComponentType<{ size?: number; strokeWidth?: number; stroke?: string }>;
  size?: number;
  strokeWidth?: number;
  maskId: string;
}

/**
 * Render sebuah lucide icon dengan gradient oranye-merah (sama seperti
 * .btn-order-gradient) menggunakan teknik SVG mask, bukan stroke gradient.
 * Stroke gradient langsung pecah/belang karena tiap <path> icon punya
 * bounding box gradient sendiri-sendiri; mask merender gradient sebagai
 * satu blok solid lalu memotongnya sesuai siluet icon, jadi mengalir mulus.
 */
export function NavGradientIcon({ icon: Icon, size = 20, strokeWidth = 2.4, maskId }: NavGradientIconProps) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <defs>
        <linearGradient id={`${maskId}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--accent-order-0)" />
          <stop offset="14%" stopColor="var(--accent-order-14)" />
          <stop offset="33%" stopColor="var(--accent-order-33)" />
          <stop offset="54%" stopColor="var(--accent-order-54)" />
          <stop offset="80%" stopColor="var(--accent-order-80)" />
          <stop offset="100%" stopColor="var(--accent-order-100)" />
        </linearGradient>
        <mask id={maskId}>
          <Icon size={size} strokeWidth={strokeWidth} stroke="white" />
        </mask>
      </defs>
      <rect width={size} height={size} fill={`url(#${maskId}-grad)`} mask={`url(#${maskId})`} />
    </svg>
  );
}

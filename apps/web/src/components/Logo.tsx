import Link from "next/link";

/** Belgi — chiqayotgan quyosh: har kuni yangi boshlanish. */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M4 22a12 12 0 0 1 24 0Z" fill="var(--logo-sun, var(--caramel))" />
      <rect x="2" y="24.5" width="28" height="2.5" rx="1.25" fill="currentColor" />
    </svg>
  );
}

export function Logo({ href = "/", className = "text-ink" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className="h-7 w-7" />
      <span className="font-serif text-[22px] font-semibold tracking-tight">Dailer</span>
    </Link>
  );
}

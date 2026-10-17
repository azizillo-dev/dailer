"use client";

import { ArrowLeft, Bot, Image as ImageIcon, LayoutDashboard, Quote, ScrollText, ShieldCheck, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { FormMessage } from "@/components/AuthShell";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errorText } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

// Admin panel faqat o'zbek tilida
const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Foydalanuvchilar", icon: Users },
  { href: "/admin/motivations", label: "Motivatsiyalar", icon: Quote },
  { href: "/admin/banners", label: "Bannerlar", icon: ImageIcon },
  { href: "/admin/challenges", label: "Challenge'lar", icon: Trophy },
  { href: "/admin/ai", label: "AI provayderlar", icon: Bot },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
];

function TwoFactorSetup({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [secret, setSecret] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState<string[] | null>(null);
  const [error, setError] = useState("");

  async function start() {
    setError("");
    try {
      const s = await api<{ secret: string; otpauth_url: string }>("/api/v1/auth/2fa/setup", { method: "POST", auth: true });
      setSecret(s.secret);
      setQr(await QRCode.toDataURL(s.otpauth_url, { margin: 1, width: 220, color: { dark: "#2b1d14", light: "#fffdf9" } }));
    } catch (err) {
      setError(errorText(err, t));
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const r = await api<{ backup_codes: string[] }>("/api/v1/auth/2fa/confirm", {
        method: "POST",
        auth: true,
        body: { code },
      });
      setBackup(r.backup_codes);
    } catch (err) {
      setError(errorText(err, t));
    }
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <ShieldCheck className="h-10 w-10 text-highlight" />
      <h1 className="mt-4 font-serif text-3xl">Ikki bosqichli himoya</h1>
      <p className="mt-3 text-ink-soft">
        Admin panelga kirish uchun 2FA majburiy. Google Authenticator, Microsoft Authenticator yoki 1Password ilovasini oching.
      </p>

      {backup ? (
        <div className="card mt-6 p-6">
          <p className="font-semibold">Zaxira kodlar — xavfsiz joyga saqlang:</p>
          <p className="mt-1 text-sm text-ink-soft">Telefon yo'qolsa, har bir kod bir marta ishlaydi.</p>
          <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-sm">
            {backup.map((c) => (
              <span key={c} className="rounded-lg bg-surface-2 px-3 py-2 text-center">
                {c}
              </span>
            ))}
          </div>
          <button className="btn-primary mt-6 w-full" onClick={onDone}>
            Saqladim, davom etish
          </button>
        </div>
      ) : secret ? (
        <form onSubmit={confirm} className="card mt-6 space-y-4 p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr && <img src={qr} alt="2FA QR kod" className="mx-auto rounded-xl" width={220} height={220} />}
          <p className="break-all text-center font-mono text-xs text-ink-faint">{secret}</p>
          <input
            className="field text-center font-mono text-lg tracking-[0.4em]"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
          {error && <FormMessage kind="error">{error}</FormMessage>}
          <button className="btn-primary w-full" disabled={code.length !== 6}>
            Tasdiqlash
          </button>
        </form>
      ) : (
        <>
          {error && (
            <div className="mt-4">
              <FormMessage kind="error">{error}</FormMessage>
            </div>
          )}
          <button className="btn-primary mt-6 w-full" onClick={start}>
            2FA ni sozlash
          </button>
        </>
      )}
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { me, loading, refreshMe } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isAdmin = me?.role === "admin" || me?.role === "super_admin";

  useEffect(() => {
    if (!loading && (!me || !isAdmin)) router.replace(me ? "/today" : "/login");
  }, [loading, me, isAdmin, router]);

  if (!me || !isAdmin) return null;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-line bg-surface md:sticky md:top-0 md:h-dvh md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-4 md:flex-col md:items-start md:px-5 md:py-6">
          <div className="flex items-center gap-2">
            <Logo href="/admin" />
            <span className="rounded-full bg-espresso px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-cream">Admin</span>
          </div>
          <Link href="/today" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-faint hover:text-ink md:hidden">
            <ArrowLeft className="h-3.5 w-3.5" /> Ilova
          </Link>
        </div>
        {me.has_2fa && (
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:px-3 md:pb-0">
            {NAV.map((n) => {
              const active = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
              const Icon = n.icon;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                    active ? "bg-surface-2 text-ink" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {n.label}
                </Link>
              );
            })}
          </nav>
        )}
        <Link
          href="/today"
          className="mx-5 mt-6 hidden items-center gap-1.5 text-xs font-semibold text-ink-faint hover:text-ink md:inline-flex"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Ilovaga qaytish
        </Link>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">
        {me.has_2fa ? children : <TwoFactorSetup onDone={refreshMe} />}
      </main>
    </div>
  );
}

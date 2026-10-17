"use client";

import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, API_URL, getTokens } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export type Banner = {
  id: string;
  kind: "ad" | "news" | "announcement" | "motivation";
  title: Record<string, string>;
  subtitle: Record<string, string>;
  cta: Record<string, string>;
  image_mobile_url: string | null;
  image_desktop_url: string | null;
  link_url: string | null;
};

const ROTATE_MS = 6000;
const SEEN_KEY = "dailer.banner.seen";

// Ko'rishlar to'planib, bir necha soniyada bir yuboriladi
const queue: { banner_id: string; event: "impression" | "click" }[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
function track(banner_id: string, event: "impression" | "click") {
  queue.push({ banner_id, event });
  if (event === "click") return flush();
  flushTimer ??= setTimeout(flush, 3000);
}
function flush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  if (!queue.length) return;
  const events = queue.splice(0, 50);
  if (queue.length) flushTimer = setTimeout(flush, 1000);
  // keepalive — sahifa yopilayotganda ham so'rov yetib boradi
  fetch(`${API_URL}/api/v1/banners/events`, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getTokens()?.access_token ?? ""}` },
    body: JSON.stringify({ events, platform: "web" }),
  }).catch(() => {});
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
}

function seenThisSession(id: string): boolean {
  try {
    const seen = new Set<string>(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]"));
    if (seen.has(id)) return true;
    seen.add(id);
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {}
  return false;
}

const tr = (v: Record<string, string>, lang: string) => v[lang] || v.uz || "";

export function BannerCarousel({ placement = "home_top" }: { placement?: string }) {
  const { lang, t } = useI18n();
  const router = useRouter();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [index, setIndex] = useState(0);
  const track$ = useRef<HTMLDivElement>(null);
  const paused = useRef(false);

  useEffect(() => {
    api<Banner[]>(`/api/v1/banners?placement=${placement}&platform=web`, { auth: true })
      .then(setBanners)
      .catch(() => {});
  }, [placement]);

  const go = useCallback((i: number) => {
    const el = track$.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }, []);

  // Avtomatik aylanish (foydalanuvchi ushlab turganda to'xtaydi)
  useEffect(() => {
    if (banners.length < 2) return;
    const id = setInterval(() => {
      if (!paused.current && document.visibilityState === "visible") go((index + 1) % banners.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [banners.length, index, go]);

  // Qaysi slayd ko'rinib turibdi — indeks va ko'rish hisobi
  useEffect(() => {
    const el = track$.current;
    if (!el || !banners.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            const i = Number((e.target as HTMLElement).dataset.index);
            setIndex(i);
            const b = banners[i];
            if (b && !seenThisSession(b.id)) track(b.id, "impression");
          }
        }
      },
      { root: el, threshold: [0.6] },
    );
    el.querySelectorAll("[data-index]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [banners]);

  useEffect(() => () => flush(), []);

  if (!banners.length) return null;

  function open(b: Banner) {
    track(b.id, "click");
    if (!b.link_url) return;
    if (b.link_url.startsWith("/")) router.push(b.link_url);
    else window.open(b.link_url, "_blank", "noopener,noreferrer");
  }

  return (
    <section
      className="animate-rise relative"
      aria-roledescription="carousel"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onTouchStart={() => (paused.current = true)}
      onTouchEnd={() => setTimeout(() => (paused.current = false), 4000)}
    >
      <div
        ref={track$}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-3xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {banners.map((b, i) => {
          const image = b.image_desktop_url || b.image_mobile_url;
          const subtitle = tr(b.subtitle, lang);
          const cta = tr(b.cta, lang);
          return (
            <div
              key={b.id}
              data-index={i}
              className="relative w-full shrink-0 snap-center"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${banners.length}`}
            >
              <button
                type="button"
                onClick={() => open(b)}
                className={`relative flex aspect-[16/9] w-full flex-col justify-end overflow-hidden rounded-3xl p-5 text-left text-cream sm:aspect-[21/8] sm:p-7 ${
                  b.link_url ? "cursor-pointer" : "cursor-default"
                } ${image ? "bg-espresso" : "bg-gradient-to-br from-coffee via-espresso to-espresso"}`}
              >
                {image && (
                  <picture>
                    {b.image_mobile_url && <source media="(max-width: 640px)" srcSet={b.image_mobile_url} />}
                    { }
                    <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" loading={i === 0 ? "eager" : "lazy"} />
                  </picture>
                )}
                {!image && (
                  <span className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-caramel/25 blur-2xl" aria-hidden />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-espresso/85 via-espresso/30 to-transparent" aria-hidden />
                <span className="relative">
                  {b.kind === "ad" && (
                    <span className="mb-2 inline-block rounded-full bg-cream/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                      {t("banner.ad")}
                    </span>
                  )}
                  <span className="block font-serif text-2xl leading-tight sm:text-3xl">{tr(b.title, lang)}</span>
                  {subtitle && <span className="mt-1.5 block max-w-xl text-sm text-cream/80">{subtitle}</span>}
                  {b.link_url && (
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-latte">
                      {cta || "→"} {cta && <ArrowUpRight className="h-4 w-4" />}
                    </span>
                  )}
                </span>
              </button>
            </div>
          );
        })}
      </div>
      {banners.length > 1 && (
        <div className="absolute bottom-3 right-4 flex gap-1.5">
          {banners.map((b, i) => (
            <button
              key={b.id}
              onClick={() => go(i)}
              aria-label={`${i + 1}`}
              aria-current={i === index}
              className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ${
                i === index ? "w-5 bg-cream" : "w-1.5 bg-cream/45"
              }`}
            />
          ))}
        </div>
      )}
      <span className="sr-only">
        {t("banner.prev")} / {t("banner.next")}
      </span>
    </section>
  );
}

import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { Providers } from "@/components/Providers";
import { Splash } from "@/components/Splash";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  axes: ["SOFT", "opsz"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "latin-ext", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Dailer — tartib bilan rivojlaning",
  description:
    "Kun tartibi, namoz vaqtlari, Pomodoro, AI maslahatchi va haftalik hisobotlar. Maqsadga yetish uchun 24/7 emas — tartib va davomiylik kerak.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "Dailer", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f0e6" },
    { media: "(prefers-color-scheme: dark)", color: "#1c130d" },
  ],
};

// Birinchi chizishdan oldin: mavzu, til va splash ko'rsatilganmi — miltillash bo'lmasin
const boot = `(function(){try{var d=document.documentElement;var t=localStorage.getItem('dailer.theme');if(t==='light'||t==='dark')d.dataset.theme=t;var l=localStorage.getItem('dailer.lang');if(l)d.lang=l;if(sessionStorage.getItem('dailer.splash'))d.dataset.splash='seen';else sessionStorage.setItem('dailer.splash','1');}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
      </head>
      <body className={`${fraunces.variable} ${manrope.variable} antialiased`}>
        <Providers>{children}</Providers>
        <Splash />
      </body>
    </html>
  );
}

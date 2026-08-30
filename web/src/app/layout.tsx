import type { Metadata } from "next";
import { Geist_Mono, Poppins } from "next/font/google";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

// Same pairing as the rest of the HxHunt family, so the sites read as one
// design language rather than unrelated projects.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "HxBugLabs | by HxHunt",
    template: "%s · HxBugLabs",
  },
  description:
    "Self-hosted, Docker-based labs for practicing bug bounty vulnerabilities and recon techniques. Browse the catalog, run every lab locally.",
  keywords: [
    "bug bounty",
    "security labs",
    "vulnerable web app",
    "docker",
    "appsec training",
    "penetration testing practice",
    "ctf",
  ],
  authors: [{ name: "HxHunt", url: "https://hxhunt.com" }],
  openGraph: {
    title: "HxBugLabs — Self-hosted bug bounty practice labs",
    description:
      "Docker-based labs for practicing bug bounty vulnerabilities and recon techniques, browsable in one catalog.",
    type: "website",
  },
};

/**
 * There is no inline theme-bootstrap script on purpose.
 *
 * CSS resolves the default through `prefers-color-scheme`, so almost nobody
 * sees a flash. Only someone who explicitly picked the opposite of their
 * system theme gets one frame of the other theme, and ThemeToggle corrects
 * it on hydration.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh flex flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

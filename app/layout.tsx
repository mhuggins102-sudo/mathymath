import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AchievementToastHost } from "@/components/AchievementToast";
import { SettingsHydrator } from "@/components/SettingsHydrator";

export const metadata: Metadata = {
  title: "mathymath — Number Wordle",
  description:
    "Guess the secret number. Pick your clue each round. A mathy daily puzzle.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0d",
};

// Inline pre-paint script: reads the saved settings blob and stamps the
// colorblind class on <html> before first paint. Prevents a red/green flash
// for colorblind-mode users on cold load. Kept tiny and defensive so a
// malformed localStorage value can never throw and block render.
const NO_FLASH_SCRIPT = `
try {
  var raw = window.localStorage.getItem("mathymath:settings");
  if (raw) {
    var s = JSON.parse(raw);
    if (s && s.colorblind) document.documentElement.classList.add("colorblind");
  }
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className="min-h-screen flex flex-col">
        <SettingsHydrator />
        {/* Permanent viewport-filling background layer. Body's own bg
         *  has historically cut off below the page content on tall
         *  desktop viewports despite min-height anchoring — Chrome
         *  paints only up to the content's natural height. The
         *  `fixed inset-0` technique (the same one our modals use,
         *  where the user confirms the bg paints edge-to-edge) sits
         *  behind everything via `-z-10` and is inert via
         *  `pointer-events-none`. */}
        <div
          aria-hidden
          className="fixed inset-0 -z-10 bg-background pointer-events-none"
        />
        <div
          className="portrait-only hidden fixed inset-0 z-50 bg-black/95 text-foreground items-center justify-center text-center px-6"
          aria-hidden
        >
          <p className="text-lg">Please rotate your phone to portrait.</p>
        </div>
        {children}
        <AchievementToastHost />
      </body>
    </html>
  );
}

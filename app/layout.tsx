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
// for colorblind-mode users on cold load. Also force-paints the page bg
// onto both html and body via inline style so the dark canvas is
// guaranteed regardless of CSS variable resolution, Tailwind cascade
// order, or any container-block quirks that have caused the bg cutoff on
// desktop. Inline style attributes win every specificity battle.
const NO_FLASH_SCRIPT = `
try {
  var raw = window.localStorage.getItem("mathymath:settings");
  if (raw) {
    var s = JSON.parse(raw);
    if (s && s.colorblind) document.documentElement.classList.add("colorblind");
  }
} catch (e) {}
try {
  var bg = "#0a0a0d";
  document.documentElement.style.backgroundColor = bg;
  document.documentElement.style.minHeight = "100dvh";
  // body may not exist yet when the head script runs; defer to DOMContentLoaded.
  var paintBody = function () {
    if (document.body) {
      document.body.style.backgroundColor = bg;
      document.body.style.minHeight = "100dvh";
    }
  };
  paintBody();
  document.addEventListener("DOMContentLoaded", paintBody);
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="antialiased bg-background">
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className="min-h-dvh flex flex-col bg-background">
        <SettingsHydrator />
        {/* Permanent viewport-filling background layer. Even with html/
         *  body bg set, Chrome desktop has historically painted the bg
         *  only up to body's intrinsic content height on tall viewports.
         *  This div uses the same `fixed inset-0 bg-background`
         *  technique our modals use, where the bg is confirmed to paint
         *  edge-to-edge. Inline style is belt-and-suspenders against
         *  any CSS-variable resolution issue. */}
        <div
          aria-hidden
          className="fixed inset-0 -z-10 bg-background pointer-events-none"
          style={{ backgroundColor: "#0a0a0d" }}
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

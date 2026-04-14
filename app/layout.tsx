import type { Metadata, Viewport } from "next";
import "./globals.css";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <SettingsHydrator />
        <div
          className="portrait-only hidden fixed inset-0 z-50 bg-black/95 text-foreground items-center justify-center text-center px-6"
          aria-hidden
        >
          <p className="text-lg">Please rotate your phone to portrait.</p>
        </div>
        {children}
      </body>
    </html>
  );
}

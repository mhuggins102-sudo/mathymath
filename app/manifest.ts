import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "mathymath",
    short_name: "mathymath",
    description:
      "A number-guessing Wordle. Pick your clue each round. New daily puzzle at UTC midnight.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0d",
    theme_color: "#0a0a0d",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}

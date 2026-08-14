// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import icon from "astro-icon";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://coworkingprilep.mk",
  integrations: [
    react(),
    icon(),
    sitemap({
      // Keep draft, coming-soon, and noindexed commerce pages out of the sitemap.
      filter: (page) =>
        !page.includes("/draft") &&
        !page.includes("/coming-soon") &&
        !page.includes("/pricing") &&
        !page.includes("/checkout"),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});

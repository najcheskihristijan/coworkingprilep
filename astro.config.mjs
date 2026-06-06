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
      // Keep draft + coming-soon out of the sitemap.
      filter: (page) =>
        !page.includes("/draft") && !page.includes("/coming-soon"),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});

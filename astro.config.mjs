// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://coworkingprilep.mk",
  integrations: [react()],
  redirects: {
    "/about": "/coming-soon",
    "/space": "/coming-soon",
    "/amenities": "/coming-soon",
    "/pricing": "/coming-soon",
    "/faq": "/coming-soon",
    "/contact": "/coming-soon",
  },
  vite: {
    plugins: [tailwindcss()],
  },
});

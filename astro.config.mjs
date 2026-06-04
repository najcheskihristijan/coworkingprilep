// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://coworkingprilep.mk",
  integrations: [react()],
  redirects: {
    "/about": "/",
    "/space": "/",
    "/amenities": "/",
    "/pricing": "/",
    "/faq": "/",
    "/contact": "/",
  },
  vite: {
    plugins: [tailwindcss()],
  },
});

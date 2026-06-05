// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import icon from "astro-icon";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://coworkingprilep.mk",
  integrations: [react(), icon()],
  vite: {
    plugins: [tailwindcss()],
  },
});

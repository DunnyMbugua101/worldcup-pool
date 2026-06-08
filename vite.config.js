import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: `base` must match your GitHub repository name, with the slashes.
// If your repo is github.com/yourname/worldcup-pool  ->  base: "/worldcup-pool/"
// If you rename the repo, change this to match or the page will load blank.
export default defineConfig({
  plugins: [react()],
  base: "/worldcup-pool/",
});

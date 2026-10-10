import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev-only config (there is intentionally no production build of the web app).
export default defineConfig({
	root: "web",
	// Load .env from the package root (root above is web/).
	envDir: import.meta.dirname,
	plugins: [react()],
	// RIVET_TOKEN (and optionally RIVET_ENDPOINT) from the shell / .env is
	// inlined into the client bundle via import.meta.env. This exposes the
	// admin token to the local browser only — fine for single-user localhost;
	// M4 AICL-88 scopes it.
	envPrefix: ["VITE_", "RIVET_"],
	server: {
		host: "127.0.0.1",
		port: 5190,
		// Same-origin proxy to the engine so the browser needs no CORS
		// preflight and the engine stays unconfigured. ws: true carries the
		// client's WebSocket upgrades.
		proxy: {
			"/rivet": {
				target: "http://localhost:6420",
				changeOrigin: true,
				ws: true,
				// The client's endpoint is <origin>/rivet; strip the prefix when
				// forwarding so engine routes line up.
				rewrite: (path) => path.replace(/^\/rivet/, ""),
			},
		},
	},
});

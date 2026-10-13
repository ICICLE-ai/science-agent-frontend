import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import serveStatic from "vite-plugin-serve-static";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const configuredCookie = mode === "development" ? (env.DEV_TAPIS_TOKEN || env.DEV_TAPIS_COOKIE || "").trim() : ""
  const value = configuredCookie.replace(/^Cookie:\s*/i, "").replace(/\\_/g, "_")
  const token = value.includes("=")
    ? value.split(";").map(part => part.trim()).find(part => /^(X-Tapis-Token|science_agent_tapis_token)=/i.test(part))?.split("=").slice(1).join("=") || ""
    : value
  const cookie = token ? `X-Tapis-Token=${token}` : ""
  if (/[\r\n]/.test(cookie)) throw new Error("DEV_TAPIS_COOKIE must be a single line")
  return {
  build: {
    chunkSizeWarningLimit: 1800,
  },
  plugins: [
    react(),
    {
      name: "development-tapis-cookie",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use((_request, response, next) => {
          if (cookie) response.setHeader("Set-Cookie", `${cookie}; Path=/; HttpOnly; SameSite=Lax`)
          next()
        })
      },
    },
    serveStatic([
      {
        pattern: /^\/storage\/(.*)/,
        resolve: (groups) => path.join("../backend/file_storage/", decodeURI(groups[1])),
      },
    ]),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5004',
        changeOrigin: true,
        ws: true,
        configure(proxy) {
          const attachCookie = (proxyRequest: import("node:http").ClientRequest) => {
            if (cookie) proxyRequest.setHeader("Cookie", cookie)
          }
          proxy.on("proxyReq", attachCookie)
          proxy.on("proxyReqWs", attachCookie)
        },
        //rewrite: path => path.replace(/^\/api/, ''),
      },

    },
  }
  }
})

// Sites allowed to show this app inside a frame (the command ops dashboard on
// monday.com). Override with a space- or comma-separated list, e.g.
// EMBED_ORIGINS="https://*.monday.com https://ops.example.com".
const DEFAULT_EMBED_ORIGINS = "https://monday.com https://*.monday.com https://*.monday.app";
const embedOrigins = (process.env.EMBED_ORIGINS || DEFAULT_EMBED_ORIGINS)
  .split(/[\s,]+/)
  .filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            // Only this app and the listed sites may frame it.
            key: "Content-Security-Policy",
            value: `frame-ancestors 'self' ${embedOrigins.join(" ")}`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;

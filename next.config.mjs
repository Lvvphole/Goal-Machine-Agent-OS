import { withSentryConfig } from "@sentry/nextjs";
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        "@anthropic-ai/sdk": "commonjs @anthropic-ai/sdk",
        "@instructor-ai/instructor": "commonjs @instructor-ai/instructor",
        openai: "commonjs openai",
      });
    }

    return config;
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  // Source-map upload disabled. To enable: add SENTRY_AUTH_TOKEN, SENTRY_ORG,
  // SENTRY_PROJECT env vars and remove this disabled line.
  hideSourceMaps: true,
});

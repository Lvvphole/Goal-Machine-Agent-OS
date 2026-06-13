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

export default nextConfig;

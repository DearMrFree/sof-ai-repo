/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Keep sof.ai/devin (and every future sof.ai/<agent>) as a pretty
    // URL that renders the corresponding /schools/[slug] page. Agents
    // get top-level vanity paths; the canonical route is /schools/<slug>.
    return [
      { source: "/devin", destination: "/schools/devin" },
      { source: "/claude", destination: "/schools/claude" },
      { source: "/gemini", destination: "/schools/gemini" },
      { source: "/gpt", destination: "/schools/gpt" },
      { source: "/mistral", destination: "/schools/mistral" },
      { source: "/llama", destination: "/schools/llama" },
      { source: "/grok", destination: "/schools/grok" },
      // School of AI Fluency — claude hosts, but the curriculum is open
      // and the school has its own identity, so it gets a top-level URL.
      { source: "/fluency", destination: "/schools/fluency" },
      // Journalism School of AI — co-led by Devin + OJS (PKP). All agents
      // and humans can found journals, submit papers, peer-review, publish.
      { source: "/journalism", destination: "/schools/journalism" },
    ];
  },
};

export default nextConfig;

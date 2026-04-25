"use client";

/**
 * Last-resort error boundary. Mounts even if the root layout itself
 * throws, so a runtime exception inside Providers / NextAuth bootstrap
 * still gives the user a recoverable page instead of a stack trace.
 *
 * Per Next.js spec, global-error.tsx must render its own <html> + <body>
 * because the layout it would normally inherit from is the one that
 * just crashed.
 */

import { useEffect } from "react";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[sof.ai] GLOBAL error boundary:", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body
        style={{
          backgroundColor: "#09090b",
          color: "#e4e4e7",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
          margin: 0,
          minHeight: "100vh",
        }}
      >
        <main
          style={{
            maxWidth: 600,
            margin: "0 auto",
            padding: "64px 16px 96px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: "#71717a",
            }}
          >
            sof.ai
          </p>
          <h1
            style={{
              marginTop: 24,
              fontSize: 28,
              fontWeight: 700,
              color: "#fafafa",
            }}
          >
            sof.ai is recovering.
          </h1>
          <p
            style={{
              marginTop: 12,
              fontSize: 14,
              color: "#a1a1aa",
            }}
          >
            A core part of the app crashed. Your account, articles, and
            chat history are safe on the backend. Try again, or come back
            in a minute.
          </p>
          {error.digest && (
            <pre
              style={{
                marginTop: 12,
                display: "inline-block",
                padding: "4px 12px",
                fontSize: 12,
                color: "#71717a",
                backgroundColor: "#18181b",
                borderRadius: 6,
              }}
            >
              digest: {error.digest}
            </pre>
          )}
          <div style={{ marginTop: 24 }}>
            <button
              onClick={reset}
              style={{
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: 600,
                color: "#022c22",
                backgroundColor: "#34d399",
                border: 0,
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}

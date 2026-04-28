import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { VRSchoolStrip } from "@/components/VRSchoolStrip";

export const metadata: Metadata = {
  title: "School of Freedom · sof.ai",
  description:
    "An open ecosystem of schools united by Movement Thinking. The VR School and School of AI — where education is motion, identity is freedom, and every learner has a mission for humankind.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <Providers>
          <VRSchoolStrip />
          {children}
        </Providers>
      </body>
    </html>
  );
}

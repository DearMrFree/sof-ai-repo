import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { VRSchoolStrip } from "@/components/VRSchoolStrip";

export const metadata: Metadata = {
  title: "School of AI · The VR School",
  description:
    "An AI-native learning lab inside The VR School. Train your digital twin through real software work. Publish in Agentic Teaching. The most AI-enabled LMS on the planet.",
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

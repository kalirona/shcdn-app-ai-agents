import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent AI - AI Customer Agent for Your Business",
  description: "Turn your website into an AI employee. Answer questions, capture leads, and book appointments 24/7.",
};

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}

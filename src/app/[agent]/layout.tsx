import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Assistant",
  description: "Chat with our AI assistant",
};

export default function PublicAgentLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="m-0 h-screen overflow-hidden bg-background p-0 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}

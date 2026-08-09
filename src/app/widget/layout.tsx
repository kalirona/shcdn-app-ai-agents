import type { ReactNode } from "react";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat Widget",
};

export default function WidgetLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="m-0 h-screen overflow-hidden bg-transparent p-0 font-sans antialiased">{children}</body>
    </html>
  );
}

import type { ReactNode } from "react";

export const metadata = {
  title: "Counter Intelligence",
  description: "HVAC/R counter-sales intelligence tool",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          background: "#0b0f14",
          color: "#e6e9ee",
        }}
      >
        {children}
      </body>
    </html>
  );
}

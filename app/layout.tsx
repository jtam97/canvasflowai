import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CanvasFlowAI",
  description: "Plan and execute data analysis pipelines visually with AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

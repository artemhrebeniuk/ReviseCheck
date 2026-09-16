import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReviseCheck x Commercial Offer Differential Auditor",
  description:
    "A deterministic differential auditor for commercial proposals, pinpointing substantive business modifications while guaranteeing zero false positives. Inspired by Abhay Singh x Appsmith design architecture.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Gabarito:wght@500;600;700;800;900&family=Geist+Mono:wght@400;500;600;700&family=Hanken+Grotesk:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased selection:bg-[#e21022]/30 selection:text-gray-900 overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}

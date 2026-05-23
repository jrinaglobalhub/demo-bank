import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JRINA Global Hub | Enterprise Banking Management System",
  description: "High-fidelity internal banking operations dashboard, Gold Loan calculators, and biometric customer verification portal by JRINA.",
  icons: {
    icon: "/favicon.ico",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full scroll-smooth">
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}

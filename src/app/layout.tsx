import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ToasterProvider from "@/components/ToasterProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavigationProgressProvider } from "@/components/NavigationProgress";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Carnival YSWS",
  description: "Carnival YSWS - Build an extension or plugin, get a grant to upgrade your dev setup!",
  openGraph: {
    type: "website",
    title: "Carnival YSWS",
    description:
      "Carnival YSWS - Build an extension or plugin, get a grant to upgrade your dev setup!",
    siteName: "Carnival YSWS",
  },
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased sparkles`}
      >
        <ToasterProvider />
        <TooltipProvider>
          <NavigationProgressProvider>{children}</NavigationProgressProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}

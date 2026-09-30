import type { Metadata } from "next";
import { Geist_Mono, Short_Stack } from "next/font/google";
import "./globals.css";
import SiteBanner from "@/components/SiteBanner";
import ToasterProvider from "@/components/ToasterProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavigationProgressProvider } from "@/components/NavigationProgress";

const shortStack = Short_Stack({
  variable: "--font-short-stack",
  weight: "400",
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
        className={`${shortStack.variable} ${geistMono.variable} antialiased sparkles`}
      >
        <ToasterProvider />
        <SiteBanner />
        <TooltipProvider>
          <NavigationProgressProvider>{children}</NavigationProgressProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "../providers/AuthProvider";
import { QueryProvider } from "../providers/QueryProvider";
import { Toaster } from "sonner";
import { ThemeProvider } from "../providers/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Benthel Asia School of Technology Inc. | CampusHub",
  description: "Benthel Asia School of Technology Inc. management dashboard",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>{children}</AuthProvider>
            <Toaster position="top-right" richColors />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

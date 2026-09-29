import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SidebarInset } from "@/components/ui/sidebar";
import { ShellProvider } from "@/components/shell/shell-provider";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { KeyboardNav } from "@/components/shell/keyboard-nav";
import { DepartmentScope } from "@/components/shell/department-scope";

// Self-hosted, so the presenter's machine never needs the network for a font.
const display = localFont({ src: "./fonts/bricolage-grotesque.woff2", variable: "--font-display", weight: "300 800", display: "swap" });
const sans = localFont({ src: "./fonts/ibm-plex-sans.woff2", variable: "--font-plex-sans", weight: "300 700", display: "swap" });
const mono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-400.woff2", weight: "400" },
    { path: "./fonts/ibm-plex-mono-500.woff2", weight: "500" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = { title: "AP demo suite", description: "Accounts payable demos" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ShellProvider>
          <AppSidebar />
          <SidebarInset>
            <DepartmentScope>
              <TopBar />
              <KeyboardNav />
              <div className="flex-1">{children}</div>
            </DepartmentScope>
          </SidebarInset>
        </ShellProvider>
      </body>
    </html>
  );
}

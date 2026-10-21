import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import ConvexClientProvider from "./ConvexClientProvider";
import { getClerkConfiguration } from "@/lib/auth/configuration.server";
import { authRoutes } from "@/lib/auth/routes";

const geistSans = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const geistMono = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Quilla | Smarter CSE preparation",
  description:
    "Quilla is designed to help Professional and Subprofessional Civil Service Examination candidates turn practice into focused, explainable progress.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { publishableKey } = getClerkConfiguration();
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClerkProvider
          publishableKey={publishableKey}
          signInUrl={authRoutes.signIn}
          signUpUrl={authRoutes.signUp}
          signInFallbackRedirectUrl={authRoutes.dashboard}
          signUpFallbackRedirectUrl={authRoutes.dashboard}
          afterSignOutUrl={authRoutes.home}
        >
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "PsychePrep - Master Your Mind",
  description: "Prepare for psychological assessments with confidence. Practice Word Association Tests, Situation Reaction Tests, and Thematic Apperception Tests.",
  keywords: ["psychology", "assessment", "WAT", "SRT", "TAT", "psychological testing", "mental preparation"],
  authors: [{ name: "PsychePrep Team" }],
  creator: "PsychePrep",
  publisher: "PsychePrep",
  robots: "index, follow",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://psycheprep.app",
    siteName: "PsychePrep",
    title: "PsychePrep - Master Your Mind",
    description: "Prepare for psychological assessments with confidence. Practice psychological tests and enhance your assessment skills.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PsychePrep - Psychological Assessment Practice",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PsychePrep - Master Your Mind",
    description: "Prepare for psychological assessments with confidence.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "mask-icon", url: "/safari-pinned-tab.svg", color: "#8b5cf6" },
    ],
  },
  manifest: "/site.webmanifest",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },
  verification: {
    // Add your verification tokens here if needed
    // google: "your-google-verification-token",
    // yandex: "your-yandex-verification-token",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        {/* Preload critical fonts */}
        <link
          rel="preload"
          href="/fonts/geist-sans.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/geist-mono.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        
        {/* Preconnect to external domains */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Additional meta tags for better performance */}
        <meta name="format-detection" content="telephone=no" />
        <meta name="msapplication-TileColor" content="#8b5cf6" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        
        {/* Security headers */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="Referrer-Policy" content="strict-origin-when-cross-origin" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen transition-colors duration-500 ease-in-out selection:bg-purple-500/20`}
        style={{
          fontFamily: 'var(--font-geist-sans, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
        }}
      >
        {/* Global background gradient overlay */}
        <div 
          className="fixed inset-0 pointer-events-none z-0 opacity-50"
          style={{
            background: `
              radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 80% 40%, rgba(139, 92, 246, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 50% 80%, rgba(236, 72, 153, 0.1) 0%, transparent 50%)
            `,
            animation: 'float 20s ease-in-out infinite',
            filter: 'blur(40px)',
          }}
        />
        
        {/* Main content container */}
        <div className="relative z-10 min-h-screen">
          {children}
        </div>

        {/* Global loading indicator (optional) */}
        <div id="global-loading" className="hidden fixed inset-0 bg-black/20 dark:bg-white/10 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="p-8 rounded-2xl bg-white/90 dark:bg-black/90 backdrop-blur-xl border border-black/10 dark:border-white/20 shadow-2xl">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 border-3 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
              <span className="text-lg font-medium" style={{ color: 'var(--foreground)' }}>Loading...</span>
            </div>
          </div>
        </div>

        <style jsx global>{`
          @keyframes float {
            0%, 100% { 
              transform: translateY(0px) rotate(0deg); 
            }
            33% { 
              transform: translateY(-20px) rotate(1deg); 
            }
            66% { 
              transform: translateY(-10px) rotate(-1deg); 
            }
          }
          
          /* Smooth focus transitions */
          *:focus {
            transition: all 0.2s ease;
          }
          
          /* Enhanced selection styling */
          ::selection {
            background: rgba(139, 92, 246, 0.2);
            color: var(--foreground);
          }
          
          ::-moz-selection {
            background: rgba(139, 92, 246, 0.2);
            color: var(--foreground);
          }
        `}</style>
      </body>
    </html>
  );
}
import type { Metadata, Viewport } from 'next';
import { Bodoni_Moda, IBM_Plex_Mono, Inter } from 'next/font/google';
import { Masthead } from '@/components/editorial/Masthead';
import { Footer } from '@/components/editorial/Footer';
import './globals.css';

const display = Bodoni_Moda({
  subsets: ['latin'],
  axes: ['opsz'],
  display: 'swap',
  variable: '--font-display',
  adjustFontFallback: false,
});
const sans = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-sans' });
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'DMFQ-A · Scheduler Lab', template: '%s · DMFQ-A' },
  description:
    'Dynamic Multilevel Feedback Queue scheduling with Aging: a tunable scheduling layer for CPUs, LLM inference serving and GPU clusters. Live, in-browser simulations on synthetic workloads.',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAF8F4' },
    { media: '(prefers-color-scheme: dark)', color: '#0E0E0E' },
  ],
};

// Applies a stored theme before first paint so there is no flash.
const themeScript = `try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-paper focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <Masthead />
        <main id="main" className="enter">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}

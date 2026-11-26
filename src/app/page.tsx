import { Aperture, ArrowUpRight, Film, Mail, Video, type LucideIcon } from 'lucide-react';
import Hero from '@/components/Hero';
import Leaderboard from '@/components/Leaderboard';
import AppLauncher from '@/components/AppLauncher';
import SkinPicker from '@/components/SkinPicker';
import EmailCard from '@/components/EmailCard';
import ThemeToggle from '@/components/ThemeToggle';
import Logo from '@/components/Logo';
import { SOCIALS } from '@/lib/site';

const SOCIAL_ICONS: Record<string, LucideIcon> = {
  youtube: Video,
  letterboxd: Film,
  instagram: Aperture,
  email: Mail,
};

export default function HomePage() {
  return (
    <>
      <header className="site-header">
        <a href="#top" className="brand">
          <Logo className="size-7" />
          <span>Cortaku</span>
        </a>
        <nav className="site-nav" aria-label="Sections">
          <a href="#arcade">Arcade</a>
          <a href="#apps">Apps</a>
          <a href="#elsewhere">Elsewhere</a>
        </nav>
        <div className="site-tools">
          <ThemeToggle />
        </div>
      </header>

      <main>
        <Hero />

        <section id="arcade" className="section">
          <div className="section-inner split">
            <div>
              <p className="eyebrow">The arcade</p>
              <h2>Meet Jumpbot!</h2>
              <ul className="howto">
                <li>Press <kbd>Space</kbd> or tap to jump; hold for higher airtime.</li>
                <li>Clear each zone for a new backdrop and faster pace.</li>
                <li>Compete on the Daily Run — one shared course, refreshed every 24 hours.</li>
              </ul>
              <h3 className="subhead">Robot skins</h3>
              <p className="lede lede-sm">Hit score milestones to unlock new colors. Equip one to customize your robot across every run.</p>
              <SkinPicker />
            </div>
            <Leaderboard />
          </div>
        </section>

        <section id="apps" className="section section-alt">
          <div className="section-inner">
            <p className="eyebrow">Home base</p>
            <h2>The self-hosted corner</h2>
            <p className="lede">Private services running on the Cortaku homelab. Login required—mostly for personal use.</p>
            <AppLauncher />
          </div>
        </section>

        <section id="elsewhere" className="section">
          <div className="section-inner">
            <p className="eyebrow">Elsewhere</p>
            <h2>Find me around the web</h2>
            <ul className="socials">
              {SOCIALS.map((social) => {
                if (social.id === 'email') return <li key={social.id}><EmailCard /></li>;
                const Icon = SOCIAL_ICONS[social.id];
                return (
                  <li key={social.id}>
                    <a href={social.url} className="social" target="_blank" rel="noopener noreferrer">
                      <Icon className="size-5" aria-hidden="true" />
                      <span className="social-title">{social.title}</span>
                      <span className="social-handle">{social.handle}</span>
                      <ArrowUpRight className="size-4 social-arrow" aria-hidden="true" />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span className="brand">
          <Logo className="size-5" />
          Cortaku
        </span>
        <span>Built with Next.js.</span>
      </footer>
    </>
  );
}

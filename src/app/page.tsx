import { Aperture, ArrowUpRight, Film, Mail, Video, type LucideIcon } from 'lucide-react';
import Hero from '@/components/Hero';
import Leaderboard from '@/components/Leaderboard';
import AppLauncher from '@/components/AppLauncher';
import SkinPicker from '@/components/SkinPicker';
import EmailCard from '@/components/EmailCard';
import CommandPalette from '@/components/CommandPalette';
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
          <a href="#scores">Scores</a>
          <a href="#apps">Apps</a>
          <a href="#elsewhere">Elsewhere</a>
        </nav>
        <div className="site-tools">
          <CommandPalette />
          <ThemeToggle />
        </div>
      </header>

      <main>
        <Hero />

        <section id="scores" className="section">
          <div className="section-inner split">
            <div>
              <p className="eyebrow">The arcade</p>
              <h2>One robot. One button. No mercy.</h2>
              <p className="lede">
                Jump the obstacles, outlast the speed-ups, and put your name on the board. It runs right here in the
                page, on a phone or a keyboard.
              </p>
              <ul className="howto">
                <li><kbd>Space</kbd> or tap to jump, hold to jump higher</li>
                <li>Every zone is a new scene, and each one is faster</li>
                <li>The daily run is one course for everyone, new each day</li>
              </ul>
              <h3 className="subhead">Robot skins</h3>
              <p className="lede lede-sm">Beat a score to unlock its colours. Pick one and the robot wears it everywhere.</p>
              <SkinPicker />
            </div>
            <Leaderboard />
          </div>
        </section>

        <section id="apps" className="section section-alt">
          <div className="section-inner">
            <p className="eyebrow">Home base</p>
            <h2>The self-hosted corner</h2>
            <p className="lede">Apps running on the Cortaku homelab. They need a login, so these are mostly for me.</p>
            <AppLauncher />
          </div>
        </section>

        <section id="elsewhere" className="section">
          <div className="section-inner">
            <p className="eyebrow">Elsewhere</p>
            <h2>Find me around the internet</h2>
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

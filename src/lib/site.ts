export const SITE_URL = 'https://www.cortaku.com';

/** Both values are public by design; row-level security decides what the key can do. */
export const SUPABASE_URL = 'https://giqylsntwontlxqrppto.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_gbvl5dHFQFgboRczPUcSPg_U25_ZHgc';

export const TAGLINE = 'Sakura, sprites, and sights.';

export type AppLink = {
  id: string;
  title: string;
  blurb: string;
  url: string;
  hue: 'pink' | 'green' | 'blue' | 'purple' | 'yellow';
};

export const APPS: AppLink[] = [
  { id: 'fitness', title: 'Fitness', blurb: 'Workout tracker', url: 'https://sparky.cortaku.com', hue: 'pink' },
  { id: 'mealie', title: 'Mealie', blurb: 'Recipes & meal plans', url: 'https://mealie.cortaku.com', hue: 'green' },
  { id: 'plex', title: 'Plex', blurb: 'Movies & TV', url: 'https://plex.cortaku.com/web/index.html', hue: 'blue' },
  { id: 'audiobooks', title: 'Audiobooks', blurb: 'Stories on tap', url: 'https://books.cortaku.com', hue: 'purple' },
  { id: 'photos', title: 'Photos', blurb: 'The camera roll', url: 'https://photos.cortaku.com', hue: 'yellow' },
  { id: 'music', title: 'Music', blurb: 'Tunes, self-hosted', url: 'https://music.cortaku.com', hue: 'pink' },
];

export const EMAIL = 'cortakustudios@gmail.com';
export const EMAIL_LINK = `mailto:${EMAIL}?subject=${encodeURIComponent('Hello from cortaku.com')}`;

export type SocialLink = { id: string; title: string; handle: string; url: string };

export const SOCIALS: SocialLink[] = [
  { id: 'youtube', title: 'YouTube', handle: '@cortaku', url: 'https://www.youtube.com/@cortaku' },
  { id: 'letterboxd', title: 'Letterboxd', handle: 'ScreenPeeper', url: 'https://letterboxd.com/ScreenPeeper/' },
  { id: 'instagram', title: 'Instagram', handle: '@cort.uwu', url: 'https://www.instagram.com/cort.uwu/' },
  { id: 'email', title: 'Email', handle: EMAIL, url: EMAIL_LINK },
];

/** Scene sets in public/game-assets/Backgrounds: 1 Fuji, 2 neon city, 3 railway, 4 bamboo forest. */
export const SCENE_COUNT = 4;
/** The scene the homepage and the game open with. */
export const DEFAULT_SCENE = 1;

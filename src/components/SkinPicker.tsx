'use client';

import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { SKINS, isUnlocked, loadSkinSheet } from '@/game/skins';
import { updateProfile, useProfile } from '@/game/profile';

/** Sprite-sheet URL per skin, filled in as each recolour finishes. */
function useSkinUrls(): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    for (const skin of SKINS) {
      loadSkinSheet(skin.id)
        .then((sheet) => { if (!cancelled) setUrls((prev) => ({ ...prev, [skin.id]: sheet.url })); })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, []);
  return urls;
}

/** Skins unlock as the best score climbs. */
export default function SkinPicker() {
  const profile = useProfile();
  const urls = useSkinUrls();

  return (
    <ul className="skins" data-ui aria-label="Robot skins">
      {SKINS.map((skin) => {
        const unlocked = isUnlocked(skin, profile);
        const selected = profile.skin === skin.id;
        const hidden = skin.secret && !unlocked;
        const title = unlocked
          ? skin.name
          : hidden ? 'A secret skin. Something on this page might be worth catching…' : `${skin.name}: score ${skin.unlockAt} to unlock`;
        return (
          <li key={skin.id}>
            <button
              type="button"
              className={`skin${hidden ? ' is-secret' : ''}`}
              aria-pressed={selected}
              disabled={!unlocked}
              title={title}
              aria-label={title}
              onClick={() => updateProfile({ skin: skin.id })}
            >
              <span className="skin-art" style={urls[skin.id] ? { backgroundImage: `url(${urls[skin.id]})` } : undefined} />
              <span className="skin-name">
                {unlocked ? skin.name : (
                  <>
                    <Lock className="skin-lock" aria-hidden="true" />
                    {hidden ? '???' : skin.unlockAt}
                  </>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// Until a visitor picks a theme, it follows their clock: night from 7 pm to 7 am.
// next-themes keeps the theme in localStorage['theme']; AUTO_KEY marks one this script chose.
const AUTO_KEY = 'cortaku.theme-auto';
export const NIGHT_FROM = 19;
export const NIGHT_UNTIL = 7;

/** Runs in <head> before next-themes reads storage, so the first paint is already right. */
export const THEME_BY_CLOCK_SCRIPT = `(function(){try{var s=localStorage;if(!s.getItem('theme')||s.getItem('${AUTO_KEY}')){var h=new Date().getHours();s.setItem('theme',h>=${NIGHT_FROM}||h<${NIGHT_UNTIL}?'dark':'light');s.setItem('${AUTO_KEY}','1')}}catch(e){}})()`;

/** Call when the visitor switches the theme themselves: from then on their choice sticks. */
export function themeChosen() {
  try {
    localStorage.removeItem(AUTO_KEY);
  } catch {
    // Storage blocked: nothing to forget.
  }
}

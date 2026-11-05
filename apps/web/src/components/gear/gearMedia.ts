export const GEAR_SLOTS = ['boots', 'gloves', 'shinguards'] as const;
export const GEAR_RARITIES = ['common', 'uncommon', 'rare', 'super-rare', 'epic', 'legendary'] as const;

/** Only our known catalog assets are migrated; custom uploads remain ordinary images. */
export function getGearMedia(src: string) {
  const path = src.replace(/^https?:\/\/[^/]+/, '').split(/[?#]/)[0];
  if (/^\/ui\/shop\/stamina-full-v1(?:-poster)?\.webp$/.test(path)) {
    return { animation: '/ui/shop/stamina-full-v1.webp', poster: '/ui/shop/stamina-full-v1-poster.webp' };
  }
  const match = path.match(/^\/(?:uploads\/gear|ui\/gear-v5)\/((boots|gloves|shinguards)-(common|uncommon|rare|super-rare|epic|legendary))(?:-poster)?\.(?:png|webp)$/);
  if (!match) return { animation: src, poster: src };
  const base = `/ui/gear-v5/${match[1]}`;
  return { animation: `${base}.webp`, poster: `${base}-poster.webp` };
}

import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GearSprite } from '../../../src/components/gear/GearSprite';
import { GEAR_RARITIES, GEAR_SLOTS, getGearMedia } from '../../../src/components/gear/gearMedia';

afterEach(cleanup);
describe('gear media', () => {
  it('replaces every catalog strip, including cached API-origin URLs, with a single animated image', () => {
    for (const slot of GEAR_SLOTS) for (const rarity of GEAR_RARITIES) {
      const slug = `${slot}-${rarity}`;
      expect(getGearMedia(`https://dev.masterlegends.online/uploads/gear/${slug}.png?v=4`)).toEqual({
        animation: `/ui/gear-v5/${slug}.webp`, poster: `/ui/gear-v5/${slug}-poster.webp`,
      });
    }
  });
  it('does not crop or replace custom equipment uploads', () => {
    const src = 'https://cdn.example.com/uploads/gear/custom.png';
    expect(getGearMedia(src)).toEqual({ animation: src, poster: src });
    const { container } = render(<GearSprite src={src} />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(src);
    expect(container.querySelector('img')?.style.objectFit).toBe('contain');
    expect(container.querySelector('[style*="background-size"]')).toBeNull();
  });
  it('renders one image with a reduced-motion poster, and falls back on animation failure', () => {
    const { container } = render(<GearSprite src="/uploads/gear/boots-common.png?v=4" />);
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(container.querySelector('source')?.getAttribute('media')).toBe('(prefers-reduced-motion: reduce)');
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/ui/gear-v5/boots-common.webp');
    fireEvent.error(img);
    expect(img.getAttribute('src')).toBe('/ui/gear-v5/boots-common-poster.webp');
  });
  it('can pause the animation and reports a missing poster to the card', () => {
    const onError = vi.fn();
    const { container } = render(<GearSprite src="/ui/gear-v5/gloves-rare.webp" animate={false} onError={onError} />);
    expect(container.querySelector('source')).toBeNull();
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/ui/gear-v5/gloves-rare-poster.webp');
    fireEvent.error(img);
    fireEvent.error(img);
    expect(onError).toHaveBeenCalled();
  });
});

it('renders the stamina consumable as one animated bottle with a reduced-motion poster', () => {
  const src = '/ui/shop/stamina-full-v1.webp';
  expect(getGearMedia(src)).toEqual({ animation: src, poster: '/ui/shop/stamina-full-v1-poster.webp' });
  const { container } = render(<GearSprite src={src} />);
  expect(container.querySelectorAll('img')).toHaveLength(1);
  expect(container.querySelector('img')?.getAttribute('src')).toBe(src);
  expect(container.querySelector('source')?.getAttribute('srcset')).toBe('/ui/shop/stamina-full-v1-poster.webp');
});

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { VestiarioTemplateDTO } from '@mll/shared';
import { VestiarioPage } from '../../../src/app/club/vestiario/page';
import { VestiarioBuilder } from '../../../src/components/admin/VestiarioBuilder';
import { StadiumBackgroundMedia } from '../../../src/components/stadium/StadiumBackgroundMedia';

const fixture = vi.hoisted(() => ({ view: {
  template: { id: 'default', name: 'Sala configurada', imageUrl: '/uploads/vestiario/saved-room.webp?v=9', backgroundType: 'image',
    slots: [{ id: 's001', label: 'GOL', role: 'GK', xPct: 78, yPct: 87 }] },
  assignments: {}, slots: [], bench: [], passiveRecoveryPerHour: 0, canClaimDailyRest: false, stadiumLvl: 1, ctLvl: 1,
} }));
vi.mock('../../../src/hooks/useApi', () => ({
  useClub: () => ({ data: {}, isLoading: false }),
  useVestiario: () => ({ data: fixture.view, isLoading: false, isError: false, refetch: vi.fn() }),
  useSaveLineup: () => ({ mutateAsync: vi.fn() }), useDailyRest: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('../../../src/hooks/useCtRealtime', () => ({ useCtRealtime: vi.fn() }));
vi.mock('react-i18next', async (importOriginal) => ({ ...await importOriginal<typeof import('react-i18next')>(), useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../../src/components/stadium/StadiumPlayerOverlay', () => ({ StadiumPlayerOverlay: () => null }));
vi.mock('../../../src/components/stadium/VestiarioSlotPicker', () => ({ VestiarioSlotPicker: () => null }));
vi.mock('../../../src/components/stadium/PlayerCardModal', () => ({ PlayerCardModal: () => null }));
vi.mock('../../../src/components/stadium/VestiarioRoster', () => ({ VestiarioRoster: () => null }));
vi.mock('../../../src/components/stadium/StadiumPlayfieldLayer', () => ({ StadiumPlayfieldLayer: () => null, lockerPace: () => ({ xPct: 50 }) }));

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('locker template synchronization', () => {
  it('uses the saved template background and exact slot coordinates in the club screen', () => {
    const { container, rerender } = render(<MemoryRouter><VestiarioPage /></MemoryRouter>);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(fixture.view.template.imageUrl);
    const marker = screen.getByRole('button', { name: 'Adicionar jogador em GOL' }).parentElement!;
    expect(marker.style.left).toBe('78%');
    expect(marker.style.top).toBe('87%');
    const old = fixture.view.template.imageUrl;
    fixture.view.template = { ...fixture.view.template, imageUrl: '/uploads/vestiario/another-room.webp' };
    rerender(<MemoryRouter><VestiarioPage /></MemoryRouter>);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/uploads/vestiario/another-room.webp');
    fixture.view.template = { ...fixture.view.template, imageUrl: old };
  });

  it('shows the same saved media in the editor and matches the actual image proportions', () => {
    const template = { ...fixture.view.template, active: true, isDefault: true, sortOrder: 0, updatedAt: '2026-11-03' } as VestiarioTemplateDTO;
    const { container } = render(<VestiarioBuilder initial={template} onSaved={vi.fn()} />);
    const image = screen.getByAltText('Campo do vestiário') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe(template.imageUrl);
    Object.defineProperties(image, { naturalWidth: { value: 1920 }, naturalHeight: { value: 1080 } });
    fireEvent.load(image);
    const canvas = container.querySelector('[role="presentation"]') as HTMLElement;
    expect(Number(canvas.style.aspectRatio)).toBeCloseTo(1920 / 1080);
  });

  it('reports the video aspect ratio so video templates have the same coordinate system', () => {
    const onAspectRatioChange = vi.fn();
    const { container } = render(<StadiumBackgroundMedia url="/uploads/vestiario/room.webm" backgroundType="video" onAspectRatioChange={onAspectRatioChange} />);
    const video = container.querySelector('video')!;
    Object.defineProperties(video, { videoWidth: { value: 1280 }, videoHeight: { value: 640 } });
    fireEvent.loadedMetadata(video);
    expect(onAspectRatioChange).toHaveBeenCalledWith(2);
  });
});

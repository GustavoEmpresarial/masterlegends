import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { STADIUM_SLOT_ROLES, type StadiumSlot, type StadiumTemplateDTO, type VestiarioTemplateDTO } from '@mll/shared';
import { VestiarioBuilder } from '../../../src/components/admin/VestiarioBuilder';
import { StadiumBuilder } from '../../../src/components/admin/StadiumBuilder';
import { ROLE_EMOJI, ROLE_LABEL, ROLE_ORDER, ROLE_STYLE, slotRoleOf } from '../../../src/components/admin/slotRolePresentation';

vi.mock('../../../src/lib/api/adminClient', () => ({ adminClient: { post: vi.fn(), patch: vi.fn() } }));
afterEach(cleanup);
const slots: StadiumSlot[] = STADIUM_SLOT_ROLES.map((role, index) => ({
  id: `slot-${role}`, label: `${role}-check`, role, xPct: 20 + index * 10, yPct: 50,
}));
const common = { id: 'template-check', name: 'Template com laterais', imageUrl: '/ui/test.webp', slots,
  active: true, isDefault: false, sortOrder: 0, updatedAt: '2026-11-03T00:00:00.000Z' };
const locker: VestiarioTemplateDTO = { ...common, backgroundType: 'image' };
const stadium: StadiumTemplateDTO = { ...common, priceUsdc: 0, farmBonusPct: 0, requireRareStarters: 0,
  requireMinOverwall: 0, requireOwnedTemplateId: null, requirementNote: null, createdAt: common.updatedAt };

describe('template editor slot roles', () => {
  it('can display and list every supported role, including LAT', () => {
    expect(ROLE_ORDER).toEqual([...STADIUM_SLOT_ROLES]);
    for (const role of STADIUM_SLOT_ROLES) {
      expect(ROLE_STYLE[role].bg).toBeTruthy();
      expect(ROLE_STYLE[role].ring).toBeTruthy();
      expect(ROLE_LABEL[role]).toBeTruthy();
      expect(ROLE_EMOJI[role]).toBeTruthy();
      expect(slotRoleOf({ role })).toBe(role);
    }
  });

  it.each([undefined, null, '', 'OLD_ROLE', 'toString', '__proto__'])('handles legacy role %s without mutating the slot', role => {
    const slot = { role } as unknown as StadiumSlot;
    expect(slotRoleOf(slot)).toBe('MID');
    expect(slot.role).toBe(role);
  });

  it.each(['locker', 'stadium'])('opens a %s template with laterals and lets the admin select one', editor => {
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, value: vi.fn() });
    const { container } = render(editor === 'locker'
      ? <VestiarioBuilder initial={locker} onSaved={vi.fn()} />
      : <StadiumBuilder initial={stadium} onSaved={vi.fn()} onCancel={vi.fn()} />);
    const canvas = container.querySelector('[role="presentation"]') as HTMLElement;
    for (const role of STADIUM_SLOT_ROLES) expect(within(canvas).getByText(`${role}-check`)).toBeTruthy();
    if (editor === 'locker') expect(screen.getByText('Lateral (1)')).toBeTruthy();
    fireEvent.pointerDown(within(canvas).getByText('LAT-check'), { pointerId: 1 });
    expect((screen.getByRole('option', { name: 'Lateral (LAT)' }) as HTMLOptionElement).selected).toBe(true);
    expect(screen.getByDisplayValue('LAT-check')).toBeTruthy();
  });

  it.each(['locker', 'stadium'])('keeps a %s template renderable with an unrecognized stored role', editor => {
    const oldSlots = [{ ...slots[0], role: 'OLD_ROLE' }] as unknown as StadiumSlot[];
    const { container } = render(editor === 'locker'
      ? <VestiarioBuilder initial={{ ...locker, slots: oldSlots }} onSaved={vi.fn()} />
      : <StadiumBuilder initial={{ ...stadium, slots: oldSlots }} onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(within(container.querySelector('[role="presentation"]') as HTMLElement).getByText('GK-check')).toBeTruthy();
    expect(oldSlots[0].role).toBe('OLD_ROLE');
  });
});

import { describe, it, expect } from 'vitest';
import * as shared from '../src/index.js';
import { ErrorCode } from '../src/errors.js';

describe('package exports', () => {
  it('re-exports errors and schemas', () => {
    expect(shared.ErrorCode).toBe(ErrorCode);
    expect(shared.registerSchema).toBeDefined();
    expect(shared.SocketEvent).toBeDefined();
  });

  it('exposes CT realtime socket events', () => {
    expect(shared.SocketEvent.CT_VIEW_INVALIDATE).toBe('ct:view-invalidate');
    expect(shared.SocketEvent.CT_STAMINA_UPDATE).toBe('ct:stamina-update');
    expect(shared.SocketEvent.CT_ROSTER_UPDATE).toBe('ct:roster-update');
  });
});

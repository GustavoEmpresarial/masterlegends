import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { AuthService } from '../../../src/modules/auth/auth.service.js';
import { AppError } from '../../../src/common/lib/errors.js';

function fakeRepo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    findByEmailOrUsername: vi.fn().mockResolvedValue(null),
    findByEmail: vi.fn().mockResolvedValue(null),
    findByUsername: vi.fn().mockResolvedValue(null),
    updateUsername: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      username: 'alice',
      password: 'hash',
      club: null,
    }),
    bumpFailedLogins: vi.fn().mockResolvedValue(undefined),
    clearFailedLogins: vi.fn().mockResolvedValue(undefined),
    createStarterPlayer: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

const fakeEmail = { send: vi.fn().mockResolvedValue(undefined) };
const fakeEmailVerification = { issue: vi.fn().mockResolvedValue('verify-token-hex') };
const fakePasswordReset = { issue: vi.fn(), consume: vi.fn() };

function createService(repo = fakeRepo()) {
  return new AuthService(repo, fakeEmail as any, fakeEmailVerification as any, fakePasswordReset as any);
}

describe('AuthService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects duplicate register', async () => {
    const repo = fakeRepo({ findByEmailOrUsername: vi.fn().mockResolvedValue({ id: 'x' }) });
    await expect(
      createService(repo).register({
        email: 'a@b.com',
        username: 'alice',
        password: 'supersecret',
        acceptTerms: true,
      }),
    ).rejects.toMatchObject({ code: 'AUTH_EMAIL_OR_USERNAME_TAKEN' });
  });

  it('does not link a referral when the signup IP belongs to the referrer', async () => {
    const repo = fakeRepo({
      findByReferralCode: vi.fn().mockResolvedValue({
        id: 'ref',
        email: 'ref@b.com',
        wallet: null,
        bannedAt: null,
      }),
      referrerIps: vi.fn().mockResolvedValue([{ ip: '1.2.3.4' }]),
      parentReferrerId: vi.fn().mockResolvedValue(null),
      recordRejectedReferral: vi.fn().mockResolvedValue(undefined),
      createReferral: vi.fn(),
      grantReferralRewardToReferrer: vi.fn(),
      setReferredBy: vi.fn(),
    });
    await createService(repo).register({
      email: 'a@b.com',
      username: 'alice',
      password: 'supersecret',
      acceptTerms: true,
      referralCode: 'REFCODE1',
    }, '1.2.3.4');
    expect(repo.recordRejectedReferral).toHaveBeenCalledWith(expect.objectContaining({ reason: 'duplicate_ip' }));
    expect(repo.createReferral).not.toHaveBeenCalled();
  });

  it('hashes password on register', async () => {
    const repo = fakeRepo();
    await createService(repo).register({
      email: 'a@b.com',
      username: 'alice',
      password: 'supersecret',
      acceptTerms: true,
    });
    const stored = repo.create.mock.calls[0][0].password;
    expect(await bcrypt.compare('supersecret', stored)).toBe(true);
  });

  it('rejects locked account', async () => {
    const hash = await bcrypt.hash('correct', 4);
    const repo = fakeRepo({
      findByEmail: vi.fn().mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        password: hash,
        lockedUntil: new Date(Date.now() + 60_000),
      }),
    });
    await expect(
      createService(repo).login({ email: 'a@b.com', password: 'correct' }),
    ).rejects.toMatchObject({ code: 'AUTH_ACCOUNT_LOCKED' });
  });

  it('logs in with valid credentials', async () => {
    const hash = await bcrypt.hash('correct', 4);
    const repo = fakeRepo({
      findByEmail: vi.fn().mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        username: 'alice',
        password: hash,
        emailVerifiedAt: new Date(),
        referralCode: 'ABC12345',
        club: { id: 'c1' },
      }),
    });
    const user = await createService(repo).login({ email: 'a@b.com', password: 'correct' });
    expect(user.hasClub).toBe(true);
    expect(repo.clearFailedLogins).toHaveBeenCalledWith('u1');
  });

  it('rejects login when email is not verified', async () => {
    const hash = await bcrypt.hash('correct', 4);
    const repo = fakeRepo({
      findByEmail: vi.fn().mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        username: 'alice',
        password: hash,
        emailVerifiedAt: null,
        referralCode: 'ABC12345',
      }),
    });
    await expect(
      createService(repo).login({ email: 'a@b.com', password: 'correct' }),
    ).rejects.toMatchObject({ code: 'AUTH_EMAIL_NOT_VERIFIED' });
    expect(repo.clearFailedLogins).toHaveBeenCalledWith('u1');
  });

  it('bumps failed logins on bad password', async () => {
    const hash = await bcrypt.hash('correct', 4);
    const repo = fakeRepo({
      findByEmail: vi.fn().mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        password: hash,
      }),
    });
    await expect(
      createService(repo).login({ email: 'a@b.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(AppError);
    expect(repo.bumpFailedLogins).toHaveBeenCalled();
  });

  it('returns me for existing user', async () => {
    const repo = fakeRepo({
      findById: vi.fn().mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        username: 'alice',
        club: null,
      }),
    });
    const user = await createService(repo).me('u1');
    expect(user.username).toBe('alice');
  });

  it('silently ignores password reset for unknown email', async () => {
    const repo = fakeRepo({ findByEmail: vi.fn().mockResolvedValue(null) });
    await createService(repo).startPasswordReset('missing@ex.com');
    expect(fakePasswordReset.issue).not.toHaveBeenCalled();
  });

  it('completes password reset', async () => {
    fakePasswordReset.consume = vi.fn().mockResolvedValue({ userId: 'u1' });
    const repo = fakeRepo({
      findById: vi.fn().mockResolvedValue({ id: 'u1', email: 'a@b.com', username: 'alice' }),
      updatePassword: vi.fn().mockResolvedValue(undefined),
    });
    const result = await createService(repo).completePasswordReset('tok', 'newpass1');
    expect(result.userId).toBe('u1');
    expect(repo.updatePassword).toHaveBeenCalled();
  });

  it('verifies email via token service', async () => {
    fakeEmailVerification.consume = vi.fn().mockResolvedValue({ userId: 'u1' });
    const result = await createService(fakeRepo()).verifyEmail('tok');
    expect(result.userId).toBe('u1');
  });

  describe('changePassword', () => {
    it('rejects when current password does not match', async () => {
      const hash = await bcrypt.hash('correct', 4);
      const repo = fakeRepo({
        findById: vi.fn().mockResolvedValue({
          id: 'u1',
          email: 'a@b.com',
          username: 'alice',
          password: hash,
        }),
        updatePassword: vi.fn().mockResolvedValue(undefined),
      });
      await expect(
        createService(repo).changePassword('u1', 'wrong', 'NewPass.1!'),
      ).rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
      expect(repo.updatePassword).not.toHaveBeenCalled();
    });

    it('updates password and sends notification email', async () => {
      const hash = await bcrypt.hash('correct', 4);
      const repo = fakeRepo({
        findById: vi.fn().mockResolvedValue({
          id: 'u1',
          email: 'a@b.com',
          username: 'alice',
          password: hash,
        }),
        updatePassword: vi.fn().mockResolvedValue(undefined),
      });
      await createService(repo).changePassword('u1', 'correct', 'NewPass.1!');
      expect(repo.updatePassword).toHaveBeenCalledWith('u1', expect.any(String));
      const newHash = repo.updatePassword.mock.calls[0][1];
      expect(await bcrypt.compare('NewPass.1!', newHash)).toBe(true);
      expect(fakeEmail.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'a@b.com', template: 'password-changed' }),
      );
    });

    it('rejects when user has no password (web3-only account)', async () => {
      const repo = fakeRepo({
        findById: vi.fn().mockResolvedValue({
          id: 'u1',
          email: 'a@b.com',
          username: 'alice',
          password: null,
        }),
      });
      await expect(
        createService(repo).changePassword('u1', 'anything', 'NewPass.1!'),
      ).rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
    });
  });

  describe('changeUsername', () => {
    it('rejects when new username is already taken by another user', async () => {
      const repo = fakeRepo({
        findById: vi.fn().mockResolvedValue({ id: 'u1', username: 'alice' }),
        findByUsername: vi.fn().mockResolvedValue({ id: 'u2', username: 'bob' }),
      });
      await expect(
        createService(repo).changeUsername('u1', 'Bob'),
      ).rejects.toMatchObject({ code: 'AUTH_EMAIL_OR_USERNAME_TAKEN' });
      expect(repo.updateUsername).not.toHaveBeenCalled();
    });

    it('noop when same username (case-insensitive)', async () => {
      const repo = fakeRepo({
        findById: vi.fn().mockResolvedValue({ id: 'u1', username: 'alice' }),
      });
      const out = await createService(repo).changeUsername('u1', 'ALICE');
      expect(out.username).toBe('alice');
      expect(repo.findByUsername).not.toHaveBeenCalled();
      expect(repo.updateUsername).not.toHaveBeenCalled();
    });

    it('updates when free; persists lowercased value', async () => {
      const repo = fakeRepo({
        findById: vi.fn().mockResolvedValue({ id: 'u1', username: 'alice' }),
        findByUsername: vi.fn().mockResolvedValue(null),
      });
      const out = await createService(repo).changeUsername('u1', 'NewName_42');
      expect(out.username).toBe('newname_42');
      expect(repo.updateUsername).toHaveBeenCalledWith('u1', 'newname_42');
    });

    it('allows reclaiming same username (self) even if findByUsername returns self', async () => {
      const repo = fakeRepo({
        findById: vi.fn().mockResolvedValue({ id: 'u1', username: 'alice' }),
        findByUsername: vi.fn().mockResolvedValue({ id: 'u1', username: 'newname' }),
      });
      const out = await createService(repo).changeUsername('u1', 'newname');
      expect(out.username).toBe('newname');
      expect(repo.updateUsername).toHaveBeenCalled();
    });

    it('throws USER_NOT_FOUND when user gone', async () => {
      const repo = fakeRepo({ findById: vi.fn().mockResolvedValue(null) });
      await expect(
        createService(repo).changeUsername('ghost', 'anything'),
      ).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
    });
  });
});

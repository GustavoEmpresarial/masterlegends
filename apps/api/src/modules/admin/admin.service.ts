import type { AdminRoleType } from '@mll/shared';
import { AppError, ErrorCode } from '../../common/lib/errors.js';
import {
  findAdminById,
  findAdminByLogin,
  verifyAdminPassword,
  type AdminConfigUser,
} from './admin.config.js';
import { Admin2faService } from './admin-2fa.service.js';

export interface AdminPublic {
  id: string;
  login: string;
  role: AdminRoleType;
}

export class AdminService {
  constructor(private readonly twoFa: Admin2faService) {}

  async validateCredentials(login: string, password: string): Promise<AdminConfigUser> {
    const admin = findAdminByLogin(login);
    if (!admin) {
      throw new AppError(ErrorCode.ADMIN_INVALID_CREDENTIALS, 401);
    }

    const valid = await verifyAdminPassword(password, admin.password);
    if (!valid) {
      throw new AppError(ErrorCode.ADMIN_INVALID_CREDENTIALS, 401);
    }

    return admin;
  }

  async startLogin(login: string, password: string) {
    const admin = await this.validateCredentials(login, password);
    return this.twoFa.createChallenge(admin);
  }

  async complete2fa(challengeId: string, code: string): Promise<AdminConfigUser> {
    const { adminId } = await this.twoFa.verify(challengeId, code);
    const admin = findAdminById(adminId);
    if (!admin) {
      throw new AppError(ErrorCode.ADMIN_2FA_INVALID, 401);
    }
    return admin;
  }

  toPublic(admin: AdminConfigUser): AdminPublic {
    return { id: admin.id, login: admin.login, role: admin.role };
  }
}

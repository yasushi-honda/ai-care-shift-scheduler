import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuditLogService } from '../auditLogService';
import { AuditLogAction } from '../../types';

describe('AuditLogService', () => {
  const mockUserId = 'test-user-123';
  const mockFacilityId = 'test-facility-456';

  beforeEach(() => {
    // Firebase Emulator接続設定
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  });

  afterEach(async () => {
    // テストデータのクリーンアップ
  });

  describe('logAction', () => {
    it('should create an audit log entry with all required fields', async () => {
      const result = await AuditLogService.logAction({
        userId: mockUserId,
        facilityId: mockFacilityId,
        action: AuditLogAction.CREATE,
        resourceType: 'staff',
        resourceId: 'staff-001',
        details: {
          staffName: '田中太郎',
          role: '管理者',
        },
        deviceInfo: {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
        result: 'success',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeTruthy();
        expect(typeof result.data).toBe('string'); // ログIDを返す
      }
    });

    it('should create an audit log entry for global actions (null facilityId)', async () => {
      const result = await AuditLogService.logAction({
        userId: mockUserId,
        facilityId: null,
        action: AuditLogAction.LOGIN,
        resourceType: 'user',
        resourceId: mockUserId,
        details: {},
        deviceInfo: {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
        result: 'success',
      });

      expect(result.success).toBe(true);
    });

    it('should create an audit log entry for failure cases', async () => {
      const result = await AuditLogService.logAction({
        userId: mockUserId,
        facilityId: mockFacilityId,
        action: AuditLogAction.UPDATE,
        resourceType: 'staff',
        resourceId: 'staff-001',
        details: {},
        deviceInfo: {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
        result: 'failure',
        errorMessage: 'Permission denied',
      });

      expect(result.success).toBe(true);
    });

    it('should return validation error for missing userId', async () => {
      const result = await AuditLogService.logAction({
        userId: '',
        facilityId: mockFacilityId,
        action: AuditLogAction.CREATE,
        resourceType: 'staff',
        resourceId: 'staff-001',
        details: {},
        deviceInfo: {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
        result: 'success',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should return validation error for missing resourceType', async () => {
      const result = await AuditLogService.logAction({
        userId: mockUserId,
        facilityId: mockFacilityId,
        action: AuditLogAction.CREATE,
        resourceType: '',
        resourceId: 'staff-001',
        details: {},
        deviceInfo: {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
        result: 'success',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('getAuditLogs', () => {
    it('should retrieve audit logs for a specific facility', async () => {
      // まず、ログを作成
      await AuditLogService.logAction({
        userId: mockUserId,
        facilityId: mockFacilityId,
        action: AuditLogAction.CREATE,
        resourceType: 'staff',
        resourceId: 'staff-001',
        details: {},
        deviceInfo: {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
        result: 'success',
      });

      const result = await AuditLogService.getAuditLogs({
        facilityId: mockFacilityId,
        limit: 10,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data.length).toBeGreaterThan(0);
      }
    });

    it('should filter audit logs by action', async () => {
      const result = await AuditLogService.getAuditLogs({
        facilityId: mockFacilityId,
        action: AuditLogAction.CREATE,
        limit: 10,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true);
        result.data.forEach(log => {
          expect(log.action).toBe(AuditLogAction.CREATE);
        });
      }
    });

    it('should filter audit logs by userId', async () => {
      const result = await AuditLogService.getAuditLogs({
        facilityId: mockFacilityId,
        userId: mockUserId,
        limit: 10,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true);
        result.data.forEach(log => {
          expect(log.userId).toBe(mockUserId);
        });
      }
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditLogService } from '../auditLogService';
import { AuditLogAction } from '../../../types';
import * as firestore from 'firebase/firestore';

// Firestoreモックのセットアップ
vi.mock('firebase/firestore');
vi.mock('../../../firebase', () => ({
  db: {},
  auth: {
    currentUser: {
      uid: 'test-user-123',
      email: 'test@example.com',
    },
  },
}));

describe('AuditLogService', () => {
  const mockUserId = 'test-user-123';
  const mockFacilityId = 'test-facility-456';

  beforeEach(async () => {
    vi.clearAllMocks();

    // auth.currentUserを設定（readonly対策）
    const { auth } = await import('../../../firebase');
    Object.defineProperty(auth, 'currentUser', {
      value: {
        uid: mockUserId,
        email: 'test@example.com',
      },
      writable: true,
      configurable: true,
    });
  });

  describe('logAction', () => {
    it('should create an audit log entry with all required fields', async () => {
      const mockDocRef = { id: 'log-123' };
      vi.mocked(firestore.addDoc).mockResolvedValue(mockDocRef as any);

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
        expect(result.data).toBe('log-123');
      }
      expect(firestore.addDoc).toHaveBeenCalled();
    });

    it('should create an audit log entry for global actions (null facilityId)', async () => {
      const mockDocRef = { id: 'log-456' };
      vi.mocked(firestore.addDoc).mockResolvedValue(mockDocRef as any);

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
      const mockDocRef = { id: 'log-789' };
      vi.mocked(firestore.addDoc).mockResolvedValue(mockDocRef as any);

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

    it('should return permission error for mismatched userId', async () => {
      const result = await AuditLogService.logAction({
        userId: '', // Empty userId doesn't match currentUser.uid
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
        expect(result.error.code).toBe('PERMISSION_DENIED');
        expect(result.error.message).toContain('他のユーザーのログを作成することはできません');
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
      // ログ作成のモック
      const mockDocRef = { id: 'log-999' };
      vi.mocked(firestore.addDoc).mockResolvedValue(mockDocRef as any);

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

      // ログ取得のモック
      const mockLogs = [
        {
          id: 'log-999',
          data: () => ({
            userId: mockUserId,
            facilityId: mockFacilityId,
            action: AuditLogAction.CREATE,
            resourceType: 'staff',
            resourceId: 'staff-001',
            timestamp: { toDate: () => new Date() },
            result: 'success',
          }),
        },
      ];
      const mockSnapshot = { docs: mockLogs, forEach: (cb: any) => mockLogs.forEach(cb) };
      vi.mocked(firestore.getDocs).mockResolvedValue(mockSnapshot as any);

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
      // ログ取得のモック（CREATE操作のみ）
      const mockLogs = [
        {
          id: 'log-1',
          data: () => ({
            userId: mockUserId,
            facilityId: mockFacilityId,
            action: AuditLogAction.CREATE,
            resourceType: 'staff',
            resourceId: 'staff-001',
            timestamp: { toDate: () => new Date() },
            result: 'success',
          }),
        },
        {
          id: 'log-2',
          data: () => ({
            userId: mockUserId,
            facilityId: mockFacilityId,
            action: AuditLogAction.CREATE,
            resourceType: 'staff',
            resourceId: 'staff-002',
            timestamp: { toDate: () => new Date() },
            result: 'success',
          }),
        },
      ];
      const mockSnapshot = { docs: mockLogs, forEach: (cb: any) => mockLogs.forEach(cb) };
      vi.mocked(firestore.getDocs).mockResolvedValue(mockSnapshot as any);

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
      // ログ取得のモック（特定ユーザーのみ）
      const mockLogs = [
        {
          id: 'log-1',
          data: () => ({
            userId: mockUserId,
            facilityId: mockFacilityId,
            action: AuditLogAction.READ,
            resourceType: 'schedule',
            resourceId: 'schedule-001',
            timestamp: { toDate: () => new Date() },
            result: 'success',
          }),
        },
        {
          id: 'log-2',
          data: () => ({
            userId: mockUserId,
            facilityId: mockFacilityId,
            action: AuditLogAction.UPDATE,
            resourceType: 'staff',
            resourceId: 'staff-001',
            timestamp: { toDate: () => new Date() },
            result: 'success',
          }),
        },
      ];
      const mockSnapshot = { docs: mockLogs, forEach: (cb: any) => mockLogs.forEach(cb) };
      vi.mocked(firestore.getDocs).mockResolvedValue(mockSnapshot as any);

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

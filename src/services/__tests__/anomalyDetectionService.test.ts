import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnomalyDetectionService } from '../anomalyDetectionService';
import { SecurityAlertService } from '../securityAlertService';
import { AuditLogAction, SecurityAlertType, SecurityAlertSeverity } from '../../../types';
import * as firestore from 'firebase/firestore';

// Firestoreモックのセットアップ
vi.mock('firebase/firestore');
vi.mock('../../../firebase', () => ({
  db: {},
  auth: {
    currentUser: {
      uid: 'test-admin-uid',
      email: 'admin@test.com',
    },
  },
}));

// SecurityAlertServiceのモック
vi.mock('../securityAlertService', () => ({
  SecurityAlertService: {
    createAlert: vi.fn(),
  },
}));

describe('AnomalyDetectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectBulkExport', () => {
    it('5分以内に10件以上のREAD操作があった場合、アラートを生成する', async () => {
      // 15件のREAD操作をモック（同一ユーザー）
      const mockLogs = Array.from({ length: 15 }, (_, i) => ({
        id: `log-${i}`,
        data: () => ({
          userId: 'user123',
          action: AuditLogAction.READ,
          timestamp: { toDate: () => new Date() },
        }),
      }));

      const mockSnapshot = { docs: mockLogs, forEach: (cb: any) => mockLogs.forEach(cb) };
      vi.mocked(firestore.getDocs).mockResolvedValue(mockSnapshot as any);

      await AnomalyDetectionService.detectBulkExport();

      expect(SecurityAlertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SecurityAlertType.BULK_EXPORT,
          severity: SecurityAlertSeverity.MEDIUM,
          userId: 'user123',
        })
      );
    });

    it('10件未満のREAD操作の場合、アラートを生成しない', async () => {
      // 5件のREAD操作をモック
      const mockLogs = Array.from({ length: 5 }, (_, i) => ({
        id: `log-${i}`,
        data: () => ({
          userId: 'user123',
          action: AuditLogAction.READ,
          timestamp: { toDate: () => new Date() },
        }),
      }));

      const mockSnapshot = { docs: mockLogs, forEach: (cb: any) => mockLogs.forEach(cb) };
      vi.mocked(firestore.getDocs).mockResolvedValue(mockSnapshot as any);

      await AnomalyDetectionService.detectBulkExport();

      expect(SecurityAlertService.createAlert).not.toHaveBeenCalled();
    });
  });

  describe('detectUnusualTimeAccess', () => {
    it('深夜時間帯（22時〜6時）のアクセスがあった場合、アラートを生成する', async () => {
      // 深夜23時のアクセスをモック
      const nightTime = new Date();
      nightTime.setHours(23, 0, 0, 0);

      const mockLogs = [
        {
          id: 'log-1',
          data: () => ({
            userId: 'user123',
            timestamp: { toDate: () => nightTime },
          }),
        },
      ];

      const mockSnapshot = { docs: mockLogs, forEach: (cb: any) => mockLogs.forEach(cb) };
      vi.mocked(firestore.getDocs).mockResolvedValue(mockSnapshot as any);

      await AnomalyDetectionService.detectUnusualTimeAccess();

      expect(SecurityAlertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SecurityAlertType.UNUSUAL_TIME_ACCESS,
          severity: SecurityAlertSeverity.LOW,
          userId: 'user123',
        })
      );
    });

    it('通常時間帯のアクセスの場合、アラートを生成しない', async () => {
      // 昼間14時のアクセスをモック
      const dayTime = new Date();
      dayTime.setHours(14, 0, 0, 0);

      const mockLogs = [
        {
          id: 'log-1',
          data: () => ({
            userId: 'user123',
            timestamp: { toDate: () => dayTime },
          }),
        },
      ];

      const mockSnapshot = { docs: mockLogs, forEach: (cb: any) => mockLogs.forEach(cb) };
      vi.mocked(firestore.getDocs).mockResolvedValue(mockSnapshot as any);

      await AnomalyDetectionService.detectUnusualTimeAccess();

      expect(SecurityAlertService.createAlert).not.toHaveBeenCalled();
    });
  });

  describe('detectMultipleAuthFailures', () => {
    it('15分以内に5回以上のログイン失敗があった場合、アラートを生成する', async () => {
      // 5件のログイン失敗をモック
      const mockLogs = Array.from({ length: 5 }, (_, i) => ({
        id: `log-${i}`,
        data: () => ({
          userId: 'user123',
          action: AuditLogAction.LOGIN,
          result: 'failure',
          timestamp: { toDate: () => new Date() },
        }),
      }));

      const mockSnapshot = { docs: mockLogs, forEach: (cb: any) => mockLogs.forEach(cb) };
      vi.mocked(firestore.getDocs).mockResolvedValue(mockSnapshot as any);

      await AnomalyDetectionService.detectMultipleAuthFailures();

      expect(SecurityAlertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SecurityAlertType.MULTIPLE_AUTH_FAILURES,
          severity: SecurityAlertSeverity.HIGH,
          userId: 'user123',
        })
      );
    });

    it('5回未満のログイン失敗の場合、アラートを生成しない', async () => {
      // 3件のログイン失敗をモック
      const mockLogs = Array.from({ length: 3 }, (_, i) => ({
        id: `log-${i}`,
        data: () => ({
          userId: 'user123',
          action: AuditLogAction.LOGIN,
          result: 'failure',
          timestamp: { toDate: () => new Date() },
        }),
      }));

      const mockSnapshot = { docs: mockLogs, forEach: (cb: any) => mockLogs.forEach(cb) };
      vi.mocked(firestore.getDocs).mockResolvedValue(mockSnapshot as any);

      await AnomalyDetectionService.detectMultipleAuthFailures();

      expect(SecurityAlertService.createAlert).not.toHaveBeenCalled();
    });
  });

  describe('detectUnauthorizedAccessAttempts', () => {
    it('15分以内に3回以上のPERMISSION_DENIEDエラーがあった場合、アラートを生成する', async () => {
      // 3件の権限エラーをモック
      const mockLogs = Array.from({ length: 3 }, (_, i) => ({
        id: `log-${i}`,
        data: () => ({
          userId: 'user123',
          result: 'failure',
          errorMessage: 'PERMISSION_DENIED: Access denied',
          timestamp: { toDate: () => new Date() },
        }),
      }));

      const mockSnapshot = { docs: mockLogs, forEach: (cb: any) => mockLogs.forEach(cb) };
      vi.mocked(firestore.getDocs).mockResolvedValue(mockSnapshot as any);

      await AnomalyDetectionService.detectUnauthorizedAccessAttempts();

      expect(SecurityAlertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SecurityAlertType.UNAUTHORIZED_ACCESS_ATTEMPT,
          severity: SecurityAlertSeverity.HIGH,
          userId: 'user123',
        })
      );
    });

    it('3回未満の権限エラーの場合、アラートを生成しない', async () => {
      // 2件の権限エラーをモック
      const mockLogs = Array.from({ length: 2 }, (_, i) => ({
        id: `log-${i}`,
        data: () => ({
          userId: 'user123',
          result: 'failure',
          errorMessage: 'PERMISSION_DENIED: Access denied',
          timestamp: { toDate: () => new Date() },
        }),
      }));

      const mockSnapshot = { docs: mockLogs, forEach: (cb: any) => mockLogs.forEach(cb) };
      vi.mocked(firestore.getDocs).mockResolvedValue(mockSnapshot as any);

      await AnomalyDetectionService.detectUnauthorizedAccessAttempts();

      expect(SecurityAlertService.createAlert).not.toHaveBeenCalled();
    });
  });

  describe('detectStorageThresholdExceeded', () => {
    it('監査ログが10,000件を超えた場合、アラートを生成する', async () => {
      // 10,001件のログをモック
      const mockLogs = Array.from({ length: 10001 }, (_, i) => ({ id: `log-${i}` }));
      const mockSnapshot = { size: 10001, docs: mockLogs };

      vi.mocked(firestore.getDocs).mockResolvedValue(mockSnapshot as any);

      await AnomalyDetectionService.detectStorageThresholdExceeded();

      expect(SecurityAlertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SecurityAlertType.STORAGE_THRESHOLD_EXCEEDED,
          severity: SecurityAlertSeverity.MEDIUM,
          userId: null,
          facilityId: null,
        })
      );
    });

    it('監査ログが10,000件以下の場合、アラートを生成しない', async () => {
      // 5,000件のログをモック
      const mockLogs = Array.from({ length: 5000 }, (_, i) => ({ id: `log-${i}` }));
      const mockSnapshot = { size: 5000, docs: mockLogs };

      vi.mocked(firestore.getDocs).mockResolvedValue(mockSnapshot as any);

      await AnomalyDetectionService.detectStorageThresholdExceeded();

      expect(SecurityAlertService.createAlert).not.toHaveBeenCalled();
    });
  });

  describe('runAllDetections', () => {
    it('すべての検知ロジックを並列実行する', async () => {
      vi.spyOn(AnomalyDetectionService, 'detectBulkExport').mockResolvedValue(undefined);
      vi.spyOn(AnomalyDetectionService, 'detectUnusualTimeAccess').mockResolvedValue(undefined);
      vi.spyOn(AnomalyDetectionService, 'detectMultipleAuthFailures').mockResolvedValue(undefined);
      vi.spyOn(AnomalyDetectionService, 'detectUnauthorizedAccessAttempts').mockResolvedValue(undefined);
      vi.spyOn(AnomalyDetectionService, 'detectStorageThresholdExceeded').mockResolvedValue(undefined);

      await AnomalyDetectionService.runAllDetections();

      expect(AnomalyDetectionService.detectBulkExport).toHaveBeenCalled();
      expect(AnomalyDetectionService.detectUnusualTimeAccess).toHaveBeenCalled();
      expect(AnomalyDetectionService.detectMultipleAuthFailures).toHaveBeenCalled();
      expect(AnomalyDetectionService.detectUnauthorizedAccessAttempts).toHaveBeenCalled();
      expect(AnomalyDetectionService.detectStorageThresholdExceeded).toHaveBeenCalled();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecurityAlertService } from '../securityAlertService';
import { SecurityAlertType, SecurityAlertSeverity, SecurityAlertStatus } from '../../../types';
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

describe('SecurityAlertService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAlert', () => {
    it('認証されていない場合、PERMISSION_DENIEDエラーを返す', async () => {
      // auth.currentUserをnullに設定
      const { auth } = await import('../../../firebase');
      vi.mocked(auth).currentUser = null;

      const result = await SecurityAlertService.createAlert({
        type: SecurityAlertType.BULK_EXPORT,
        severity: SecurityAlertSeverity.MEDIUM,
        userId: 'user123',
        facilityId: null,
        title: 'Test Alert',
        description: 'Test Description',
        metadata: {},
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('PERMISSION_DENIED');
      }
    });

    it('タイトルが空の場合、VALIDATION_ERRORを返す', async () => {
      // auth.currentUserを復元
      const { auth } = await import('../../../firebase');
      vi.mocked(auth).currentUser = {
        uid: 'test-admin-uid',
        email: 'admin@test.com',
      } as any;

      const result = await SecurityAlertService.createAlert({
        type: SecurityAlertType.BULK_EXPORT,
        severity: SecurityAlertSeverity.MEDIUM,
        userId: 'user123',
        facilityId: null,
        title: '',
        description: 'Test Description',
        metadata: {},
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('タイトル');
      }
    });

    it('正しいパラメータでアラートを作成できる', async () => {
      const { auth } = await import('../../../firebase');
      vi.mocked(auth).currentUser = {
        uid: 'test-admin-uid',
        email: 'admin@test.com',
      } as any;

      const mockDocRef = { id: 'alert-123' };
      vi.mocked(firestore.addDoc).mockResolvedValue(mockDocRef as any);

      const result = await SecurityAlertService.createAlert({
        type: SecurityAlertType.BULK_EXPORT,
        severity: SecurityAlertSeverity.MEDIUM,
        userId: 'user123',
        facilityId: 'facility-456',
        title: 'Test Alert',
        description: 'Test Description',
        metadata: { readCount: 15 },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('alert-123');
      }
      expect(firestore.addDoc).toHaveBeenCalled();
    });
  });

  describe('getAlerts', () => {
    it('認証されていない場合、PERMISSION_DENIEDエラーを返す', async () => {
      const { auth } = await import('../../../firebase');
      vi.mocked(auth).currentUser = null;

      const result = await SecurityAlertService.getAlerts({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('PERMISSION_DENIED');
      }
    });

    it('フィルター条件でアラートを取得できる', async () => {
      const { auth } = await import('../../../firebase');
      vi.mocked(auth).currentUser = {
        uid: 'test-admin-uid',
        email: 'admin@test.com',
      } as any;

      const mockAlerts = [
        {
          id: 'alert-1',
          type: SecurityAlertType.BULK_EXPORT,
          severity: SecurityAlertSeverity.HIGH,
          status: SecurityAlertStatus.NEW,
          userId: 'user123',
          facilityId: null,
          title: 'Alert 1',
          description: 'Description 1',
          metadata: {},
          detectedAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
          acknowledgedBy: null,
          acknowledgedAt: null,
          resolvedBy: null,
          resolvedAt: null,
          notes: null,
        },
      ];

      const mockSnapshot = {
        docs: mockAlerts.map((alert) => ({
          id: alert.id,
          data: () => alert,
        })),
      };

      vi.mocked(firestore.getDocs).mockResolvedValue(mockSnapshot as any);

      const result = await SecurityAlertService.getAlerts({
        status: SecurityAlertStatus.NEW,
        limit: 10,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].title).toBe('Alert 1');
      }
    });
  });

  describe('updateAlertStatus', () => {
    it('認証されていない場合、PERMISSION_DENIEDエラーを返す', async () => {
      const { auth } = await import('../../../firebase');
      vi.mocked(auth).currentUser = null;

      const result = await SecurityAlertService.updateAlertStatus(
        'alert-123',
        SecurityAlertStatus.ACKNOWLEDGED
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('PERMISSION_DENIED');
      }
    });

    it('存在しないアラートの場合、NOT_FOUNDエラーを返す', async () => {
      const { auth } = await import('../../../firebase');
      vi.mocked(auth).currentUser = {
        uid: 'test-admin-uid',
        email: 'admin@test.com',
      } as any;

      vi.mocked(firestore.getDoc).mockResolvedValue({
        exists: () => false,
      } as any);

      const result = await SecurityAlertService.updateAlertStatus(
        'non-existent-alert',
        SecurityAlertStatus.ACKNOWLEDGED
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('アラートステータスを更新できる', async () => {
      const { auth } = await import('../../../firebase');
      vi.mocked(auth).currentUser = {
        uid: 'test-admin-uid',
        email: 'admin@test.com',
      } as any;

      vi.mocked(firestore.getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({ status: SecurityAlertStatus.NEW }),
      } as any);

      vi.mocked(firestore.updateDoc).mockResolvedValue(undefined as any);

      const result = await SecurityAlertService.updateAlertStatus(
        'alert-123',
        SecurityAlertStatus.RESOLVED,
        'Test note'
      );

      expect(result.success).toBe(true);
      expect(firestore.updateDoc).toHaveBeenCalled();
    });
  });

  describe('addNotes', () => {
    it('認証されていない場合、PERMISSION_DENIEDエラーを返す', async () => {
      const { auth } = await import('../../../firebase');
      vi.mocked(auth).currentUser = null;

      const result = await SecurityAlertService.addNotes('alert-123', 'Test note');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('PERMISSION_DENIED');
      }
    });

    it('メモを追加できる', async () => {
      const { auth } = await import('../../../firebase');
      vi.mocked(auth).currentUser = {
        uid: 'test-admin-uid',
        email: 'admin@test.com',
      } as any;

      vi.mocked(firestore.updateDoc).mockResolvedValue(undefined as any);

      const result = await SecurityAlertService.addNotes('alert-123', 'Important note');

      expect(result.success).toBe(true);
      expect(firestore.updateDoc).toHaveBeenCalled();
    });
  });
});

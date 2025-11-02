import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScheduleService } from '../scheduleService';
import { Schedule, StaffSchedule, GeneratedShift, assertResultError } from '../../../types';
import * as firestore from 'firebase/firestore';

// Firestoreモックのセットアップ
vi.mock('firebase/firestore');
vi.mock('../../../firebase', () => ({
  db: {},
  auth: {
    currentUser: {
      uid: 'test-user-id',
      email: 'test@example.com',
    },
  },
}));

describe('ScheduleService', () => {
  const mockFacilityId = 'test-facility-123';
  const mockTargetMonth = '2025-01';
  const mockUserId = 'test-user-123';

  const mockStaffSchedules: StaffSchedule[] = [
    {
      staffId: 'staff-1',
      staffName: '山田太郎',
      monthlyShifts: [
        { date: '2025-01-01', shiftType: '日勤' },
        { date: '2025-01-02', shiftType: '休' },
      ] as GeneratedShift[],
    },
    {
      staffId: 'staff-2',
      staffName: '佐藤花子',
      monthlyShifts: [
        { date: '2025-01-01', shiftType: '夜勤' },
        { date: '2025-01-02', shiftType: '日勤' },
      ] as GeneratedShift[],
    },
  ];

  const mockScheduleData: Omit<Schedule, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> = {
    targetMonth: mockTargetMonth,
    staffSchedules: mockStaffSchedules,
    version: 1,
    status: 'draft',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveSchedule', () => {
    it('should create a new schedule and return schedule ID', async () => {
      const mockDocRef = { id: 'schedule-123' };
      vi.mocked(firestore.addDoc).mockResolvedValue(mockDocRef as any);

      const result = await ScheduleService.saveSchedule(
        mockFacilityId,
        mockUserId,
        mockScheduleData
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeTruthy();
        expect(typeof result.data).toBe('string');
        expect(result.data).toBe('schedule-123');
      }
      expect(firestore.addDoc).toHaveBeenCalled();
    });

    it('should return validation error for empty targetMonth', async () => {
      const invalidSchedule = { ...mockScheduleData, targetMonth: '' };
      const result = await ScheduleService.saveSchedule(
        mockFacilityId,
        mockUserId,
        invalidSchedule
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        assertResultError(result);
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should return validation error for empty facilityId', async () => {
      const result = await ScheduleService.saveSchedule(
        '',
        mockUserId,
        mockScheduleData
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        assertResultError(result);
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should return validation error for empty userId', async () => {
      const result = await ScheduleService.saveSchedule(
        mockFacilityId,
        '',
        mockScheduleData
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        assertResultError(result);
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should include createdAt, updatedAt timestamps and creator info', async () => {
      const mockDocRef = { id: 'schedule-456' };
      vi.mocked(firestore.addDoc).mockResolvedValue(mockDocRef as any);

      const result = await ScheduleService.saveSchedule(
        mockFacilityId,
        mockUserId,
        mockScheduleData
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(firestore.addDoc).toHaveBeenCalled();
        // addDocに渡されたデータを確認
        const addDocCall = vi.mocked(firestore.addDoc).mock.calls[0];
        const docData = addDocCall[1];

        expect(docData).toHaveProperty('createdAt');
        expect(docData).toHaveProperty('updatedAt');
        expect(docData).toHaveProperty('createdBy', mockUserId);
        expect(docData).toHaveProperty('updatedBy', mockUserId);
        expect(docData).toHaveProperty('version', 1);
        expect(docData).toHaveProperty('status', 'draft');
      }
    });

    it('should save staffSchedules data correctly', async () => {
      const mockDocRef = { id: 'schedule-789' };
      vi.mocked(firestore.addDoc).mockResolvedValue(mockDocRef as any);

      const result = await ScheduleService.saveSchedule(
        mockFacilityId,
        mockUserId,
        mockScheduleData
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(firestore.addDoc).toHaveBeenCalled();
        // addDocに渡されたデータを確認
        const addDocCall = vi.mocked(firestore.addDoc).mock.calls[0];
        const docData = addDocCall[1] as Schedule;

        expect(docData.staffSchedules).toBeDefined();
        expect(Array.isArray(docData.staffSchedules)).toBe(true);
        expect(docData.staffSchedules.length).toBe(2);
        expect(docData.staffSchedules[0].staffId).toBe('staff-1');
        expect(docData.staffSchedules[0].staffName).toBe('山田太郎');
        expect(docData.staffSchedules[0].monthlyShifts.length).toBe(2);
      }
    });
  });

  describe('subscribeToSchedules', () => {
    it('should call callback with schedule list when data changes', async () => {
      const mockScheduleList = [
        {
          id: 'schedule-1',
          ...mockScheduleData,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: mockUserId,
          updatedBy: mockUserId,
        },
      ];

      const mockUnsubscribe = vi.fn();
      vi.mocked(firestore.onSnapshot).mockImplementation((query, callback: any) => {
        // 即座にコールバックを呼び出す
        callback({
          docs: mockScheduleList.map(schedule => ({
            id: schedule.id,
            data: () => schedule,
          })),
        });
        return mockUnsubscribe;
      });

      let callbackCalled = false;
      const callback = vi.fn((schedules: Schedule[]) => {
        expect(Array.isArray(schedules)).toBe(true);
        callbackCalled = true;
      });

      const unsubscribe = ScheduleService.subscribeToSchedules(
        mockFacilityId,
        mockTargetMonth,
        callback
      );

      // コールバックが呼ばれたことを確認
      expect(callbackCalled).toBe(true);

      // クリーンアップ
      unsubscribe();
    });

    it('should return unsubscribe function', () => {
      const mockUnsubscribe = vi.fn();
      vi.mocked(firestore.onSnapshot).mockReturnValue(mockUnsubscribe);

      const callback = vi.fn();
      const unsubscribe = ScheduleService.subscribeToSchedules(
        mockFacilityId,
        mockTargetMonth,
        callback
      );

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should filter schedules by targetMonth', async () => {
      // スケジュール作成のモック
      const mockDocRef1 = { id: 'schedule-2025-01' };
      const mockDocRef2 = { id: 'schedule-2025-02' };

      vi.mocked(firestore.addDoc)
        .mockResolvedValueOnce(mockDocRef1 as any)
        .mockResolvedValueOnce(mockDocRef2 as any);

      // まずテスト用のスケジュールを作成
      const schedule1 = { ...mockScheduleData, targetMonth: '2025-01' };
      const schedule2 = { ...mockScheduleData, targetMonth: '2025-02' };

      await ScheduleService.saveSchedule(mockFacilityId, mockUserId, schedule1);
      await ScheduleService.saveSchedule(mockFacilityId, mockUserId, schedule2);

      // 2025-01のスケジュールのみをモック（フィルタリング済み）
      const mockFilteredSchedules = [
        {
          id: 'schedule-2025-01',
          ...schedule1,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: mockUserId,
          updatedBy: mockUserId,
        },
      ];

      const mockUnsubscribe = vi.fn();
      vi.mocked(firestore.onSnapshot).mockImplementation((query, callback: any) => {
        // フィルタリングされた結果を返す
        callback({
          docs: mockFilteredSchedules.map(schedule => ({
            id: schedule.id,
            data: () => schedule,
          })),
        });
        return mockUnsubscribe;
      });

      // 2025-01のスケジュールのみを購読
      const callback = vi.fn((schedules: Schedule[]) => {
        if (schedules.length > 0) {
          // すべてのスケジュールが2025-01であることを確認
          schedules.forEach(schedule => {
            expect(schedule.targetMonth).toBe('2025-01');
          });
        }
      });

      const unsubscribe = ScheduleService.subscribeToSchedules(
        mockFacilityId,
        '2025-01',
        callback
      );

      // コールバックが呼ばれたことを確認
      expect(callback).toHaveBeenCalled();

      // クリーンアップ
      unsubscribe();
    });
  });

  describe('updateSchedule', () => {
    const mockScheduleId = 'schedule-123';
    const mockUpdates = { staffSchedules: mockStaffSchedules };

    it('should update schedule successfully', async () => {
      const mockDocSnapshot = {
        exists: () => true,
        data: () => mockScheduleData,
      };
      vi.mocked(firestore.getDoc).mockResolvedValue(mockDocSnapshot as any);
      vi.mocked(firestore.updateDoc).mockResolvedValue(undefined);

      const result = await ScheduleService.updateSchedule(
        mockFacilityId,
        mockScheduleId,
        mockUserId,
        mockUpdates
      );

      expect(result.success).toBe(true);
      expect(firestore.updateDoc).toHaveBeenCalled();
    });

    it('should return validation error for empty facilityId', async () => {
      const result = await ScheduleService.updateSchedule(
        '',
        mockScheduleId,
        mockUserId,
        mockUpdates
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        assertResultError(result);
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should return validation error for empty scheduleId', async () => {
      const result = await ScheduleService.updateSchedule(
        mockFacilityId,
        '',
        mockUserId,
        mockUpdates
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        assertResultError(result);
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should return validation error for empty userId', async () => {
      const result = await ScheduleService.updateSchedule(
        mockFacilityId,
        mockScheduleId,
        '',
        mockUpdates
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        assertResultError(result);
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should return NOT_FOUND error when schedule does not exist', async () => {
      const mockDocSnapshot = {
        exists: () => false,
      };
      vi.mocked(firestore.getDoc).mockResolvedValue(mockDocSnapshot as any);

      const result = await ScheduleService.updateSchedule(
        mockFacilityId,
        mockScheduleId,
        mockUserId,
        mockUpdates
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        assertResultError(result);
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('should return PERMISSION_DENIED error when permission denied', async () => {
      const mockDocSnapshot = {
        exists: () => true,
        data: () => mockScheduleData,
      };
      vi.mocked(firestore.getDoc).mockResolvedValue(mockDocSnapshot as any);
      vi.mocked(firestore.updateDoc).mockRejectedValue({ code: 'permission-denied' });

      const result = await ScheduleService.updateSchedule(
        mockFacilityId,
        mockScheduleId,
        mockUserId,
        mockUpdates
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        assertResultError(result);
        expect(result.error.code).toBe('PERMISSION_DENIED');
      }
    });

    it('should return FIRESTORE_ERROR when Firestore error occurs', async () => {
      const mockDocSnapshot = {
        exists: () => true,
        data: () => mockScheduleData,
      };
      vi.mocked(firestore.getDoc).mockResolvedValue(mockDocSnapshot as any);
      vi.mocked(firestore.updateDoc).mockRejectedValue(new Error('Firestore error'));

      const result = await ScheduleService.updateSchedule(
        mockFacilityId,
        mockScheduleId,
        mockUserId,
        mockUpdates
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        assertResultError(result);
        expect(result.error.code).toBe('FIRESTORE_ERROR');
      }
    });
  });

  describe('confirmSchedule', () => {
    const mockScheduleId = 'schedule-123';

    it('should confirm schedule successfully', async () => {
      const mockScheduleSnapshot = {
        exists: () => true,
        data: () => ({
          ...mockScheduleData,
          status: 'draft',
          version: 1,
          createdBy: mockUserId,
        }),
      };

      vi.mocked(firestore.runTransaction).mockImplementation(async (db, callback: any) => {
        const mockTransaction = {
          get: vi.fn().mockResolvedValue(mockScheduleSnapshot),
          set: vi.fn(),
          update: vi.fn(),
        };
        await callback(mockTransaction);
      });

      const result = await ScheduleService.confirmSchedule(
        mockFacilityId,
        mockScheduleId,
        mockUserId
      );

      expect(result.success).toBe(true);
    });

    it('should return validation error for empty facilityId', async () => {
      const result = await ScheduleService.confirmSchedule(
        '',
        mockScheduleId,
        mockUserId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        assertResultError(result);
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should return validation error for empty scheduleId', async () => {
      const result = await ScheduleService.confirmSchedule(
        mockFacilityId,
        '',
        mockUserId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        assertResultError(result);
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should return validation error for empty userId', async () => {
      const result = await ScheduleService.confirmSchedule(
        mockFacilityId,
        mockScheduleId,
        ''
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        assertResultError(result);
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should return NOT_FOUND error when schedule does not exist', async () => {
      vi.mocked(firestore.runTransaction).mockImplementation(async (db, callback: any) => {
        const mockTransaction = {
          get: vi.fn().mockResolvedValue({ exists: () => false }),
          set: vi.fn(),
          update: vi.fn(),
        };
        await callback(mockTransaction);
      });

      const result = await ScheduleService.confirmSchedule(
        mockFacilityId,
        mockScheduleId,
        mockUserId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        assertResultError(result);
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('should return CONFLICT error when status is not draft', async () => {
      const mockScheduleSnapshot = {
        exists: () => true,
        data: () => ({
          ...mockScheduleData,
          status: 'confirmed',
          version: 1,
          createdBy: mockUserId,
        }),
      };

      vi.mocked(firestore.runTransaction).mockImplementation(async (db, callback: any) => {
        const mockTransaction = {
          get: vi.fn().mockResolvedValue(mockScheduleSnapshot),
          set: vi.fn(),
          update: vi.fn(),
        };
        await callback(mockTransaction);
      });

      const result = await ScheduleService.confirmSchedule(
        mockFacilityId,
        mockScheduleId,
        mockUserId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        assertResultError(result);
        expect(result.error.code).toBe('CONFLICT');
      }
    });
  });

  describe('getVersionHistory', () => {
    const mockScheduleId = 'schedule-123';

    it('should get version history successfully', async () => {
      const mockVersions = [
        {
          id: 'v2',
          data: () => ({
            versionNumber: 2,
            targetMonth: mockTargetMonth,
            staffSchedules: mockStaffSchedules,
            createdAt: new Date(),
            createdBy: mockUserId,
            changeDescription: '確定',
            previousVersion: 1,
          }),
        },
        {
          id: 'v1',
          data: () => ({
            versionNumber: 1,
            targetMonth: mockTargetMonth,
            staffSchedules: mockStaffSchedules,
            createdAt: new Date(),
            createdBy: mockUserId,
            changeDescription: '初版',
            previousVersion: 0,
          }),
        },
      ];

      vi.mocked(firestore.getDocs).mockResolvedValue({
        docs: mockVersions,
      } as any);

      const result = await ScheduleService.getVersionHistory(
        mockFacilityId,
        mockScheduleId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data.length).toBe(2);
      }
    });

    it('should return validation error for empty facilityId', async () => {
      const result = await ScheduleService.getVersionHistory(
        '',
        mockScheduleId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        assertResultError(result);
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should return validation error for empty scheduleId', async () => {
      const result = await ScheduleService.getVersionHistory(
        mockFacilityId,
        ''
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        assertResultError(result);
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should return PERMISSION_DENIED error when permission denied', async () => {
      vi.mocked(firestore.getDocs).mockRejectedValue({ code: 'permission-denied' });

      const result = await ScheduleService.getVersionHistory(
        mockFacilityId,
        mockScheduleId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        assertResultError(result);
        expect(result.error.code).toBe('PERMISSION_DENIED');
      }
    });

    it('should return FIRESTORE_ERROR when Firestore error occurs', async () => {
      vi.mocked(firestore.getDocs).mockRejectedValue(new Error('Firestore error'));

      const result = await ScheduleService.getVersionHistory(
        mockFacilityId,
        mockScheduleId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        assertResultError(result);
        expect(result.error.code).toBe('FIRESTORE_ERROR');
      }
    });
  });

  describe('restoreVersion', () => {
    const mockScheduleId = 'schedule-123';
    const mockVersionNumber = 1;

    it('should restore version successfully', async () => {
      const mockVersionSnapshot = {
        exists: () => true,
        data: () => ({
          versionNumber: 1,
          targetMonth: mockTargetMonth,
          staffSchedules: mockStaffSchedules,
          createdAt: new Date(),
          createdBy: mockUserId,
          changeDescription: '初版',
          previousVersion: 0,
        }),
      };

      const mockScheduleSnapshot = {
        exists: () => true,
        data: () => ({
          ...mockScheduleData,
          version: 2,
          createdBy: mockUserId,
        }),
      };

      vi.mocked(firestore.runTransaction).mockImplementation(async (db, callback: any) => {
        const mockTransaction = {
          get: vi.fn()
            .mockResolvedValueOnce(mockVersionSnapshot)
            .mockResolvedValueOnce(mockScheduleSnapshot),
          set: vi.fn(),
          update: vi.fn(),
        };
        await callback(mockTransaction);
      });

      const result = await ScheduleService.restoreVersion(
        mockFacilityId,
        mockScheduleId,
        mockVersionNumber,
        mockUserId
      );

      expect(result.success).toBe(true);
    });

    it('should return validation error for empty facilityId', async () => {
      const result = await ScheduleService.restoreVersion(
        '',
        mockScheduleId,
        mockVersionNumber,
        mockUserId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        assertResultError(result);
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should return validation error for empty scheduleId', async () => {
      const result = await ScheduleService.restoreVersion(
        mockFacilityId,
        '',
        mockVersionNumber,
        mockUserId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        assertResultError(result);
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should return validation error for empty userId', async () => {
      const result = await ScheduleService.restoreVersion(
        mockFacilityId,
        mockScheduleId,
        mockVersionNumber,
        ''
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        assertResultError(result);
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should return NOT_FOUND error when version does not exist', async () => {
      vi.mocked(firestore.runTransaction).mockImplementation(async (db, callback: any) => {
        const mockTransaction = {
          get: vi.fn().mockResolvedValue({ exists: () => false }),
          set: vi.fn(),
          update: vi.fn(),
        };
        await callback(mockTransaction);
      });

      const result = await ScheduleService.restoreVersion(
        mockFacilityId,
        mockScheduleId,
        mockVersionNumber,
        mockUserId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        assertResultError(result);
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('should return NOT_FOUND error when schedule does not exist', async () => {
      const mockVersionSnapshot = {
        exists: () => true,
        data: () => ({
          versionNumber: 1,
          targetMonth: mockTargetMonth,
          staffSchedules: mockStaffSchedules,
          createdAt: new Date(),
          createdBy: mockUserId,
          changeDescription: '初版',
          previousVersion: 0,
        }),
      };

      vi.mocked(firestore.runTransaction).mockImplementation(async (db, callback: any) => {
        const mockTransaction = {
          get: vi.fn()
            .mockResolvedValueOnce(mockVersionSnapshot)
            .mockResolvedValueOnce({ exists: () => false }),
          set: vi.fn(),
          update: vi.fn(),
        };
        await callback(mockTransaction);
      });

      const result = await ScheduleService.restoreVersion(
        mockFacilityId,
        mockScheduleId,
        mockVersionNumber,
        mockUserId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        assertResultError(result);
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });
});

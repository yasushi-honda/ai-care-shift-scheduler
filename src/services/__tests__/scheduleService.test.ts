import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { ScheduleService } from '../scheduleService';
import { Schedule, StaffSchedule, GeneratedShift } from '../../../types';
import { db } from '../../../firebase';

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
    // Firebase Emulator接続設定
    // Note: Firebase Emulatorは localhost:8080 で起動している必要があります
    // 起動コマンド: firebase emulators:start --only firestore
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  });

  afterEach(async () => {
    // テストデータのクリーンアップ
    // 作成したスケジュールドキュメントは次回テスト前にクリアされます
  });

  describe('saveSchedule', () => {
    it('should create a new schedule and return schedule ID', async () => {
      const result = await ScheduleService.saveSchedule(
        mockFacilityId,
        mockUserId,
        mockScheduleData
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeTruthy();
        expect(typeof result.data).toBe('string');
      }
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
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should include createdAt, updatedAt timestamps and creator info', async () => {
      const result = await ScheduleService.saveSchedule(
        mockFacilityId,
        mockUserId,
        mockScheduleData
      );

      expect(result.success).toBe(true);
      if (result.success) {
        // Firestoreからドキュメントを取得
        const scheduleDocRef = doc(db, `facilities/${mockFacilityId}/schedules/${result.data}`);
        const scheduleDoc = await getDoc(scheduleDocRef);
        const data = scheduleDoc.data();

        expect(data?.createdAt).toBeInstanceOf(Timestamp);
        expect(data?.updatedAt).toBeInstanceOf(Timestamp);
        expect(data?.createdBy).toBe(mockUserId);
        expect(data?.updatedBy).toBe(mockUserId);
        expect(data?.version).toBe(1);
        expect(data?.status).toBe('draft');
      }
    });

    it('should save staffSchedules data correctly', async () => {
      const result = await ScheduleService.saveSchedule(
        mockFacilityId,
        mockUserId,
        mockScheduleData
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const scheduleDocRef = doc(db, `facilities/${mockFacilityId}/schedules/${result.data}`);
        const scheduleDoc = await getDoc(scheduleDocRef);
        const data = scheduleDoc.data();

        expect(data?.staffSchedules).toBeDefined();
        expect(Array.isArray(data?.staffSchedules)).toBe(true);
        expect(data?.staffSchedules.length).toBe(2);
        expect(data?.staffSchedules[0].staffId).toBe('staff-1');
        expect(data?.staffSchedules[0].staffName).toBe('山田太郎');
        expect(data?.staffSchedules[0].monthlyShifts.length).toBe(2);
      }
    });
  });

  describe('subscribeToSchedules', () => {
    it('should call callback with schedule list when data changes', (done) => {
      const callback = vi.fn((schedules: Schedule[]) => {
        expect(Array.isArray(schedules)).toBe(true);
        done();
      });

      const unsubscribe = ScheduleService.subscribeToSchedules(
        mockFacilityId,
        mockTargetMonth,
        callback
      );

      // クリーンアップ
      setTimeout(() => unsubscribe(), 100);
    });

    it('should return unsubscribe function', () => {
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
      // まずテスト用のスケジュールを作成
      const schedule1 = { ...mockScheduleData, targetMonth: '2025-01' };
      const schedule2 = { ...mockScheduleData, targetMonth: '2025-02' };

      await ScheduleService.saveSchedule(mockFacilityId, mockUserId, schedule1);
      await ScheduleService.saveSchedule(mockFacilityId, mockUserId, schedule2);

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

      // クリーンアップ
      setTimeout(() => unsubscribe(), 200);
    });
  });
});

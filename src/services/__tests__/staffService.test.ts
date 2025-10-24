import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { StaffService } from '../staffService';
import { Staff, Role, Qualification, TimeSlotPreference } from '../../../types';
import { db } from '../../../firebase';

describe('StaffService', () => {
  const mockFacilityId = 'test-facility-123';
  const mockStaffData: Omit<Staff, 'id' | 'createdAt' | 'updatedAt'> = {
    name: '山田太郎',
    role: Role.CareWorker,
    qualifications: [Qualification.CertifiedCareWorker, Qualification.DriversLicense],
    weeklyWorkCount: { hope: 4, must: 3 },
    maxConsecutiveWorkDays: 5,
    availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
    unavailableDates: [],
    timeSlotPreference: TimeSlotPreference.Any,
    isNightShiftOnly: false,
  };

  beforeEach(() => {
    // Firebase Emulator接続設定
    // Note: Firebase Emulatorは localhost:8080 で起動している必要があります
    // 起動コマンド: firebase emulators:start --only firestore
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  });

  afterEach(async () => {
    // テストデータのクリーンアップ
    // 作成したスタッフドキュメントは次回テスト前にクリアされます
    // 必要に応じて明示的な削除処理を追加
  });

  describe('createStaff', () => {
    it('should create a new staff member and return staff ID', async () => {
      const result = await StaffService.createStaff(mockFacilityId, mockStaffData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeTruthy();
        expect(typeof result.data).toBe('string');
      }
    });

    it('should return validation error for empty name', async () => {
      const invalidStaff = { ...mockStaffData, name: '' };
      const result = await StaffService.createStaff(mockFacilityId, invalidStaff);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should include createdAt and updatedAt timestamps', async () => {
      const result = await StaffService.createStaff(mockFacilityId, mockStaffData);

      expect(result.success).toBe(true);
      if (result.success) {
        // Firestoreからドキュメントを取得
        const staffDocRef = doc(db, `facilities/${mockFacilityId}/staff/${result.data}`);
        const staffDoc = await getDoc(staffDocRef);
        const data = staffDoc.data();

        expect(data?.createdAt).toBeInstanceOf(Timestamp);
        expect(data?.updatedAt).toBeInstanceOf(Timestamp);
      }
    });
  });

  describe('subscribeToStaffList', () => {
    it('should call callback with staff list when data changes', (done) => {
      const callback = vi.fn((staffList: Staff[]) => {
        expect(Array.isArray(staffList)).toBe(true);
        done();
      });

      const unsubscribe = StaffService.subscribeToStaffList(mockFacilityId, callback);

      // クリーンアップ
      setTimeout(() => unsubscribe(), 100);
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = StaffService.subscribeToStaffList(mockFacilityId, callback);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('updateStaff', () => {
    it('should update staff information', async () => {
      // まずスタッフを作成
      const createResult = await StaffService.createStaff(mockFacilityId, mockStaffData);
      expect(createResult.success).toBe(true);

      if (createResult.success) {
        const staffId = createResult.data;

        // 更新
        const updates = { name: '山田花子' };
        const updateResult = await StaffService.updateStaff(mockFacilityId, staffId, updates);

        expect(updateResult.success).toBe(true);
      }
    });

    it('should return NOT_FOUND error for non-existent staff', async () => {
      const result = await StaffService.updateStaff(mockFacilityId, 'non-existent-id', { name: 'Test' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('should update updatedAt timestamp', async () => {
      // まずスタッフを作成
      const createResult = await StaffService.createStaff(mockFacilityId, mockStaffData);
      expect(createResult.success).toBe(true);

      if (createResult.success) {
        const staffId = createResult.data;

        // 少し待機
        await new Promise(resolve => setTimeout(resolve, 100));

        // 更新
        const updates = { name: '山田花子' };
        await StaffService.updateStaff(mockFacilityId, staffId, updates);

        // updatedAtが更新されていることを確認
        const staffDocRef = doc(db, `facilities/${mockFacilityId}/staff/${staffId}`);
        const staffDoc = await getDoc(staffDocRef);
        const data = staffDoc.data();

        expect(data?.updatedAt).toBeInstanceOf(Timestamp);
        expect(data?.name).toBe('山田花子');
      }
    });
  });

  describe('deleteStaff', () => {
    it('should delete staff successfully', async () => {
      // まずスタッフを作成
      const createResult = await StaffService.createStaff(mockFacilityId, mockStaffData);
      expect(createResult.success).toBe(true);

      if (createResult.success) {
        const staffId = createResult.data;

        // 削除
        const deleteResult = await StaffService.deleteStaff(mockFacilityId, staffId);

        expect(deleteResult.success).toBe(true);
      }
    });

    it('should return NOT_FOUND error for non-existent staff', async () => {
      const result = await StaffService.deleteStaff(mockFacilityId, 'non-existent-id');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });
});

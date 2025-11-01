import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StaffService } from '../staffService';
import { Staff, Role, Qualification, TimeSlotPreference } from '../../../types';
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
    vi.clearAllMocks();
  });

  describe('createStaff', () => {
    it('should create a new staff member and return staff ID', async () => {
      const mockDocRef = { id: 'staff-123' };
      vi.mocked(firestore.addDoc).mockResolvedValue(mockDocRef as any);

      const result = await StaffService.createStaff(mockFacilityId, mockStaffData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeTruthy();
        expect(typeof result.data).toBe('string');
        expect(result.data).toBe('staff-123');
      }
      expect(firestore.addDoc).toHaveBeenCalled();
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
      const mockDocRef = { id: 'staff-456' };

      vi.mocked(firestore.addDoc).mockResolvedValue(mockDocRef as any);

      const result = await StaffService.createStaff(mockFacilityId, mockStaffData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(firestore.addDoc).toHaveBeenCalled();
        // タイムスタンプの存在を確認（serverTimestamp()が呼ばれている）
        const addDocCall = vi.mocked(firestore.addDoc).mock.calls[0];
        const docData = addDocCall[1];
        expect(docData).toHaveProperty('createdAt');
        expect(docData).toHaveProperty('updatedAt');
      }
    });
  });

  describe('subscribeToStaffList', () => {
    it('should call callback with staff list when data changes', async () => {
      const mockStaffList = [
        {
          id: 'staff-1',
          ...mockStaffData,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockUnsubscribe = vi.fn();
      vi.mocked(firestore.onSnapshot).mockImplementation((query, callback: any) => {
        // 即座にコールバックを呼び出す
        callback({
          docs: mockStaffList.map(staff => ({
            id: staff.id,
            data: () => staff,
          })),
        });
        return mockUnsubscribe;
      });

      let callbackCalled = false;
      const callback = vi.fn((staffList: Staff[]) => {
        expect(Array.isArray(staffList)).toBe(true);
        callbackCalled = true;
      });

      const unsubscribe = StaffService.subscribeToStaffList(mockFacilityId, callback);

      // コールバックが呼ばれたことを確認
      expect(callbackCalled).toBe(true);

      // クリーンアップ
      unsubscribe();
    });

    it('should return unsubscribe function', () => {
      const mockUnsubscribe = vi.fn();
      vi.mocked(firestore.onSnapshot).mockReturnValue(mockUnsubscribe);

      const callback = vi.fn();
      const unsubscribe = StaffService.subscribeToStaffList(mockFacilityId, callback);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('updateStaff', () => {
    it('should update staff information', async () => {
      // まずスタッフを作成
      const mockDocRef = { id: 'staff-789' };
      vi.mocked(firestore.addDoc).mockResolvedValue(mockDocRef as any);

      const createResult = await StaffService.createStaff(mockFacilityId, mockStaffData);
      expect(createResult.success).toBe(true);

      if (createResult.success) {
        const staffId = createResult.data;

        // 更新のモック
        vi.mocked(firestore.getDoc).mockResolvedValue({
          exists: () => true,
          data: () => ({ ...mockStaffData }),
        } as any);
        vi.mocked(firestore.updateDoc).mockResolvedValue(undefined);

        // 更新
        const updates = { name: '山田花子' };
        const updateResult = await StaffService.updateStaff(mockFacilityId, staffId, updates);

        expect(updateResult.success).toBe(true);
        expect(firestore.updateDoc).toHaveBeenCalled();
      }
    });

    it('should return NOT_FOUND error for non-existent staff', async () => {
      // 存在しないドキュメントのモック
      vi.mocked(firestore.getDoc).mockResolvedValue({
        exists: () => false,
      } as any);

      const result = await StaffService.updateStaff(mockFacilityId, 'non-existent-id', { name: 'Test' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('should update updatedAt timestamp', async () => {
      // まずスタッフを作成
      const mockDocRef = { id: 'staff-999' };
      vi.mocked(firestore.addDoc).mockResolvedValue(mockDocRef as any);

      const createResult = await StaffService.createStaff(mockFacilityId, mockStaffData);
      expect(createResult.success).toBe(true);

      if (createResult.success) {
        const staffId = createResult.data;

        // 更新前の状態をモック
        vi.mocked(firestore.getDoc).mockResolvedValue({
          exists: () => true,
          data: () => ({ ...mockStaffData }),
        } as any);
        vi.mocked(firestore.updateDoc).mockResolvedValue(undefined);

        // 更新
        const updates = { name: '山田花子' };
        await StaffService.updateStaff(mockFacilityId, staffId, updates);

        // updatedAtが更新されていることを確認
        expect(firestore.updateDoc).toHaveBeenCalled();
        const updateDocCall = vi.mocked(firestore.updateDoc).mock.calls[0];
        const updateData = updateDocCall[1];
        expect(updateData).toHaveProperty('updatedAt');
        expect(updateData).toHaveProperty('name', '山田花子');
      }
    });
  });

  describe('deleteStaff', () => {
    it('should delete staff successfully', async () => {
      // まずスタッフを作成
      const mockDocRef = { id: 'staff-del-1' };
      vi.mocked(firestore.addDoc).mockResolvedValue(mockDocRef as any);

      const createResult = await StaffService.createStaff(mockFacilityId, mockStaffData);
      expect(createResult.success).toBe(true);

      if (createResult.success) {
        const staffId = createResult.data;

        // 削除のモック
        vi.mocked(firestore.getDoc).mockResolvedValue({
          exists: () => true,
          data: () => ({ ...mockStaffData }),
        } as any);
        vi.mocked(firestore.deleteDoc).mockResolvedValue(undefined);

        // 削除
        const deleteResult = await StaffService.deleteStaff(mockFacilityId, staffId);

        expect(deleteResult.success).toBe(true);
        expect(firestore.deleteDoc).toHaveBeenCalled();
      }
    });

    it('should return NOT_FOUND error for non-existent staff', async () => {
      // 存在しないドキュメントのモック
      vi.mocked(firestore.getDoc).mockResolvedValue({
        exists: () => false,
      } as any);

      const result = await StaffService.deleteStaff(mockFacilityId, 'non-existent-id');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });
});

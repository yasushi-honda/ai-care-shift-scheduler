/**
 * Cloud Functions統合テスト: AIシフト生成API
 * TDD: Red → Green → Refactor
 */

import request from 'supertest';
import {
  STANDARD_STAFF_LIST,
  STANDARD_REQUIREMENTS,
  STANDARD_LEAVE_REQUESTS,
  LARGE_STAFF_LIST,
  EXTRA_LARGE_STAFF_LIST,
  MOCK_VERTEX_AI_RESPONSE,
  INVALID_TEST_DATA,
} from '../fixtures/test-data';

describe('AI Shift Generation API - Integration Tests', () => {
  const CLOUD_FUNCTION_URL =
    process.env.CLOUD_FUNCTION_URL ||
    'https://us-central1-ai-care-shift-scheduler.cloudfunctions.net/generateShift';

  describe('Setup Test', () => {
    it('should have Cloud Function URL configured', () => {
      expect(CLOUD_FUNCTION_URL).toBeDefined();
      expect(CLOUD_FUNCTION_URL).toContain('cloudfunctions.net');
      console.log(`Testing against: ${CLOUD_FUNCTION_URL}`);
    });
  });

  describe('Health Check', () => {
    it('should fail with METHOD_NOT_ALLOWED for GET request', async () => {
      // Red: まだCloud Functionsは GET をサポートしていない想定
      const response = await request(CLOUD_FUNCTION_URL).get('/');

      // 405 Method Not Allowed が返ることを期待
      expect(response.status).toBe(405);
    });
  });

  describe('Test Fixtures', () => {
    it('should have 5 standard staff members', () => {
      expect(STANDARD_STAFF_LIST).toHaveLength(5);
      expect(STANDARD_STAFF_LIST[0].id).toBe('test-staff-001');
      expect(STANDARD_STAFF_LIST[0].name).toBe('テスト太郎');
    });

    it('should have standard requirements for November 2025', () => {
      expect(STANDARD_REQUIREMENTS.targetMonth).toBe('2025-11');
      expect(STANDARD_REQUIREMENTS.timeSlots).toHaveLength(4);
      expect(STANDARD_REQUIREMENTS.requirements['早番'].totalStaff).toBe(2);
    });

    it('should have standard leave requests', () => {
      expect(STANDARD_LEAVE_REQUESTS['test-staff-001']).toBeDefined();
      expect(STANDARD_LEAVE_REQUESTS['test-staff-001']['2025-11-10']).toBeDefined();
    });

    it('should have 20 staff in large staff list', () => {
      expect(LARGE_STAFF_LIST).toHaveLength(20);
    });

    it('should have 50 staff in extra large staff list', () => {
      expect(EXTRA_LARGE_STAFF_LIST).toHaveLength(50);
    });

    it('should have mock Vertex AI response', () => {
      expect(MOCK_VERTEX_AI_RESPONSE.schedule).toHaveLength(5);
      expect(MOCK_VERTEX_AI_RESPONSE.schedule[0].staffId).toBe('test-staff-001');
    });
  });

  /**
   * Task 2.1: 基本的なシフト生成機能をテストする
   * TDD Red Phase: 実際のAI生成が動作するか検証
   */
  describe('Task 2.1: Basic Shift Generation', () => {
    it('should return HTTP 200 and success: true for valid request', async () => {
      const response = await request(CLOUD_FUNCTION_URL)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({
          staffList: STANDARD_STAFF_LIST,
          requirements: STANDARD_REQUIREMENTS,
          leaveRequests: STANDARD_LEAVE_REQUESTS,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return schedule array in response', async () => {
      const response = await request(CLOUD_FUNCTION_URL)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({
          staffList: STANDARD_STAFF_LIST,
          requirements: STANDARD_REQUIREMENTS,
          leaveRequests: STANDARD_LEAVE_REQUESTS,
        });

      expect(response.body).toHaveProperty('schedule');
      expect(response.body.schedule).toBeInstanceOf(Array);
    });

    it('should generate shifts for all 5 staff members', async () => {
      const response = await request(CLOUD_FUNCTION_URL)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({
          staffList: STANDARD_STAFF_LIST,
          requirements: STANDARD_REQUIREMENTS,
          leaveRequests: STANDARD_LEAVE_REQUESTS,
        });

      expect(response.body.schedule).toHaveLength(5);
    });

    it('should have staffId, staffName, and monthlyShifts for each staff', async () => {
      const response = await request(CLOUD_FUNCTION_URL)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({
          staffList: STANDARD_STAFF_LIST,
          requirements: STANDARD_REQUIREMENTS,
          leaveRequests: STANDARD_LEAVE_REQUESTS,
        });

      response.body.schedule.forEach((staff: any) => {
        expect(staff).toHaveProperty('staffId');
        expect(staff).toHaveProperty('staffName');
        expect(staff).toHaveProperty('monthlyShifts');
        expect(staff.monthlyShifts).toBeInstanceOf(Array);
      });
    });

    it('should have shifts for all days in the target month (30 days in Nov 2025)', async () => {
      const response = await request(CLOUD_FUNCTION_URL)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({
          staffList: STANDARD_STAFF_LIST,
          requirements: STANDARD_REQUIREMENTS,
          leaveRequests: STANDARD_LEAVE_REQUESTS,
        });

      response.body.schedule.forEach((staff: any) => {
        expect(staff.monthlyShifts).toHaveLength(30);
        staff.monthlyShifts.forEach((shift: any) => {
          expect(shift).toHaveProperty('date');
          expect(shift).toHaveProperty('shiftType');
        });
      });
    });
  });

  /**
   * Task 2.2: Firestoreへのデータ保存を検証する（間接的検証）
   * scheduleIdとmetadataの存在により、Firestore保存を検証
   * Note: 冪等性の詳細テストはTask 4で実施
   */
  describe('Task 2.2: Firestore Data Persistence (Indirect Verification)', () => {
    it('should return scheduleId indicating successful Firestore save', async () => {
      const response = await request(CLOUD_FUNCTION_URL)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({
          staffList: STANDARD_STAFF_LIST,
          requirements: STANDARD_REQUIREMENTS,
          leaveRequests: STANDARD_LEAVE_REQUESTS,
        });

      // scheduleIdの検証（FirestoreドキュメントID）
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('scheduleId');
      expect(response.body.scheduleId).toBeTruthy();
      expect(typeof response.body.scheduleId).toBe('string');
      expect(response.body.scheduleId.length).toBeGreaterThan(0);
    });

    it('should return metadata with model and tokensUsed', async () => {
      const response = await request(CLOUD_FUNCTION_URL)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({
          staffList: STANDARD_STAFF_LIST,
          requirements: STANDARD_REQUIREMENTS,
          leaveRequests: STANDARD_LEAVE_REQUESTS,
        });

      // metadataの検証
      expect(response.body).toHaveProperty('metadata');
      expect(response.body.metadata).toHaveProperty('generatedAt');
      expect(response.body.metadata).toHaveProperty('model');
      expect(response.body.metadata).toHaveProperty('tokensUsed');

      // generatedAtがISO 8601形式であることを確認
      expect(response.body.metadata.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      // モデル名の検証
      expect(response.body.metadata.model).toBe('gemini-2.5-flash-lite');

      // トークン数が正の整数であることを確認
      expect(typeof response.body.metadata.tokensUsed).toBe('number');
      expect(response.body.metadata.tokensUsed).toBeGreaterThan(0);
    });

    it('should generate unique scheduleId for each request', async () => {
      // 1回目のリクエスト
      const firstResponse = await request(CLOUD_FUNCTION_URL)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({
          staffList: STANDARD_STAFF_LIST,
          requirements: STANDARD_REQUIREMENTS,
          leaveRequests: STANDARD_LEAVE_REQUESTS,
        });

      expect(firstResponse.status).toBe(200);
      const firstScheduleId = firstResponse.body.scheduleId;

      // 2回目のリクエスト（少し異なる休暇申請）
      const modifiedLeaveRequests = {
        'test-staff-003': {
          '2025-11-20': 'PaidLeave',
        },
      };

      const secondResponse = await request(CLOUD_FUNCTION_URL)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({
          staffList: STANDARD_STAFF_LIST,
          requirements: STANDARD_REQUIREMENTS,
          leaveRequests: modifiedLeaveRequests,
        });

      // 異なるデータなので異なるscheduleIdが生成される
      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body.scheduleId).toBeTruthy();
      expect(secondResponse.body.scheduleId).not.toBe(firstScheduleId);
    });
  });

  /**
   * Task 3.1: 不正な入力に対するバリデーションをテストする
   * TDD Red Phase: バリデーションエラーが適切に返されることを検証
   */
  describe('Task 3.1: Input Validation', () => {
    it('should return error for empty staffList', async () => {
      const response = await request(CLOUD_FUNCTION_URL)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({
          staffList: INVALID_TEST_DATA.emptyStaffList,
          requirements: STANDARD_REQUIREMENTS,
          leaveRequests: STANDARD_LEAVE_REQUESTS,
        });

      // 400または500エラーが返ることを期待
      expect([400, 500]).toContain(response.status);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain('staffList');
    });

    it('should return "staffList is required" for undefined staffList', async () => {
      const response = await request(CLOUD_FUNCTION_URL)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({
          staffList: INVALID_TEST_DATA.undefinedStaffList,
          requirements: STANDARD_REQUIREMENTS,
          leaveRequests: STANDARD_LEAVE_REQUESTS,
        });

      expect([400, 500]).toContain(response.status);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain('staffList is required');
    });

    it('should return "requirements with targetMonth is required" for undefined requirements', async () => {
      const response = await request(CLOUD_FUNCTION_URL)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({
          staffList: STANDARD_STAFF_LIST,
          requirements: INVALID_TEST_DATA.undefinedRequirements,
          leaveRequests: STANDARD_LEAVE_REQUESTS,
        });

      expect([400, 500]).toContain(response.status);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain('requirements');
      expect(response.body.error).toContain('targetMonth');
    });

    it('should return error for missing targetMonth', async () => {
      const response = await request(CLOUD_FUNCTION_URL)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({
          staffList: STANDARD_STAFF_LIST,
          requirements: INVALID_TEST_DATA.missingTargetMonth,
          leaveRequests: STANDARD_LEAVE_REQUESTS,
        });

      expect([400, 500]).toContain(response.status);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain('targetMonth');
    });
  });

  /**
   * Task 3.2: サイズ制限とリソース保護をテストする
   * us-central1デプロイバージョンは上限100名（古い実装）
   */
  describe('Task 3.2: Resource Protection', () => {
    it('should return error for oversized staffList (201 staff)', async () => {
      const response = await request(CLOUD_FUNCTION_URL)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({
          staffList: INVALID_TEST_DATA.oversizedStaffList,
          requirements: STANDARD_REQUIREMENTS,
          leaveRequests: STANDARD_LEAVE_REQUESTS,
        });

      // 現在の実装では500エラーが返される（バリデーションエラーがcatchで捕捉）
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      // us-central1バージョンは上限100名
      expect(response.body.error).toMatch(/100|staff|exceed/i);
    });

    it('should include error message about staff limit', async () => {
      const response = await request(CLOUD_FUNCTION_URL)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({
          staffList: INVALID_TEST_DATA.oversizedStaffList,
          requirements: STANDARD_REQUIREMENTS,
          leaveRequests: STANDARD_LEAVE_REQUESTS,
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.toLowerCase()).toContain('staff');
    });
  });

  /**
   * Task 3.3: エラーレスポンス形式を検証する
   * セキュリティ：スタックトレース非表示、適切なエラー情報のみ返却
   */
  describe('Task 3.3: Error Response Format', () => {
    it('should return success: false for validation errors', async () => {
      const response = await request(CLOUD_FUNCTION_URL)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({
          staffList: INVALID_TEST_DATA.emptyStaffList,
          requirements: STANDARD_REQUIREMENTS,
          leaveRequests: STANDARD_LEAVE_REQUESTS,
        });

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(false);
    });

    it('should not include stack trace in error response', async () => {
      const response = await request(CLOUD_FUNCTION_URL)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({
          staffList: INVALID_TEST_DATA.undefinedStaffList,
          requirements: STANDARD_REQUIREMENTS,
          leaveRequests: STANDARD_LEAVE_REQUESTS,
        });

      // スタックトレースが含まれていないことを確認
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body.error).toBeDefined();
      expect(response.body.error).not.toMatch(/at .+:\d+:\d+/); // スタックトレース形式
    });

    it('should return appropriate error message without internal details', async () => {
      const response = await request(CLOUD_FUNCTION_URL)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({
          staffList: INVALID_TEST_DATA.oversizedStaffList,
          requirements: STANDARD_REQUIREMENTS,
          leaveRequests: STANDARD_LEAVE_REQUESTS,
        });

      expect(response.body.error).toBeDefined();
      expect(typeof response.body.error).toBe('string');
      // 内部実装の詳細が含まれていないことを確認
      expect(response.body.error).not.toMatch(/\w+Error:/); // "TypeError:", "ReferenceError:"などが含まれない
    });
  });

  /**
   * Task 4.1: 同一入力での冪等性をテストする
   * 同じリクエストを2回送信し、2回目がキャッシュから返されることを検証
   */
  describe('Task 4.1: Idempotency with Same Input', () => {
    it('should return cached result for identical second request', async () => {
      // 1回目のリクエスト（新規生成）
      const firstResponse = await request(CLOUD_FUNCTION_URL)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({
          staffList: STANDARD_STAFF_LIST,
          requirements: STANDARD_REQUIREMENTS,
          leaveRequests: STANDARD_LEAVE_REQUESTS,
        });

      expect(firstResponse.status).toBe(200);
      expect(firstResponse.body.success).toBe(true);
      const firstScheduleId = firstResponse.body.scheduleId;

      // 2回目のリクエスト（同じ内容：キャッシュヒット期待）
      const secondResponse = await request(CLOUD_FUNCTION_URL)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({
          staffList: STANDARD_STAFF_LIST,
          requirements: STANDARD_REQUIREMENTS,
          leaveRequests: STANDARD_LEAVE_REQUESTS,
        });

      // 同じscheduleIdが返されることを確認
      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body.success).toBe(true);
      expect(secondResponse.body.scheduleId).toBe(firstScheduleId);
    });

    it('should include metadata.cached: true for cached response', async () => {
      // 1回目のリクエスト
      await request(CLOUD_FUNCTION_URL)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({
          staffList: STANDARD_STAFF_LIST,
          requirements: STANDARD_REQUIREMENTS,
          leaveRequests: STANDARD_LEAVE_REQUESTS,
        });

      // 2回目のリクエスト（キャッシュヒット）
      const secondResponse = await request(CLOUD_FUNCTION_URL)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({
          staffList: STANDARD_STAFF_LIST,
          requirements: STANDARD_REQUIREMENTS,
          leaveRequests: STANDARD_LEAVE_REQUESTS,
        });

      // キャッシュヒットのメタデータを確認
      expect(secondResponse.body.metadata).toBeDefined();
      expect(secondResponse.body.metadata.cached).toBe(true);
      expect(secondResponse.body.metadata.cacheHit).toBe(true);
    });

    it('should return exactly same schedule data for cached request', async () => {
      // 1回目のリクエスト
      const firstResponse = await request(CLOUD_FUNCTION_URL)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({
          staffList: STANDARD_STAFF_LIST,
          requirements: STANDARD_REQUIREMENTS,
          leaveRequests: STANDARD_LEAVE_REQUESTS,
        });

      const firstSchedule = firstResponse.body.schedule;

      // 2回目のリクエスト（キャッシュヒット）
      const secondResponse = await request(CLOUD_FUNCTION_URL)
        .post('/')
        .set('Content-Type', 'application/json')
        .send({
          staffList: STANDARD_STAFF_LIST,
          requirements: STANDARD_REQUIREMENTS,
          leaveRequests: STANDARD_LEAVE_REQUESTS,
        });

      const secondSchedule = secondResponse.body.schedule;

      // scheduleデータが完全に一致することを確認
      expect(secondSchedule).toEqual(firstSchedule);
    });
  });
});

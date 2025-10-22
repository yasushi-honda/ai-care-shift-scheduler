
// import { GoogleGenAI, Type } from "@google/genai";
import type { Staff, ShiftRequirement, StaffSchedule, LeaveRequest } from '../types';

// ⚠️ 注意: ブラウザから直接 Gemini API を呼び出すのはセキュリティリスクです
// 本番環境では Cloud Functions 経由で呼び出します
// const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const formatLeaveRequestsForPrompt = (leaveRequests: LeaveRequest, staffList: Staff[]): string => {
  const staffMap = new Map(staffList.map(s => [s.id, s.name]));
  const requestsByStaff: { [staffName: string]: string[] } = {};

  for (const staffId in leaveRequests) {
    const staffName = staffMap.get(staffId);
    if (!staffName) continue;

    if (!requestsByStaff[staffName]) {
      requestsByStaff[staffName] = [];
    }

    const requests = leaveRequests[staffId];
    for (const date in requests) {
      requestsByStaff[staffName].push(`${date} (${requests[date]})`);
    }
  }

  return Object.entries(requestsByStaff)
    .map(([staffName, dates]) => `- ${staffName}: ${dates.join(', ')}`)
    .join('\n');
};

export const generateShiftSchedule = async (
  staffList: Staff[],
  requirements: ShiftRequirement,
  leaveRequests: LeaveRequest
): Promise<StaffSchedule[]> => {
  // ⚠️ 現在、AIシフト生成機能は Cloud Functions 未実装のため利用できません
  // 代わりに「デモシフト作成」ボタンをご利用ください

  throw new Error(
    "AIシフト生成機能は現在実装中です。\n\n" +
    "【理由】\n" +
    "- セキュリティのため、Gemini API は Cloud Functions 経由で呼び出す必要があります\n" +
    "- ブラウザから直接 API を呼び出すと、APIキーが露出してしまいます\n\n" +
    "【代替手段】\n" +
    "画面下部の「デモシフト作成」ボタンをご利用ください。\n" +
    "ランダムなシフトが生成され、機能をお試しいただけます。\n\n" +
    "【今後の実装予定】\n" +
    "Cloud Functions によるシフト生成APIを実装予定です。"
  );
};


import { GoogleGenAI, Type } from "@google/genai";
import type { Staff, ShiftRequirement, StaffSchedule, LeaveRequest } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
  const [year, month] = requirements.targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  
  const formattedLeaveRequests = formatLeaveRequestsForPrompt(leaveRequests, staffList);

  const prompt = `
  あなたは介護・福祉事業所向けのAIシフト自動作成アシスタントです。
  以下のスタッフ情報、事業所のシフト要件、休暇希望に基づいて、${requirements.targetMonth}の1ヶ月分の最適なシフト表をJSON形式で生成してください。

  # スタッフ情報
  ${JSON.stringify(staffList, null, 2)}

  # 事業所のシフト要件
  - 対象月: ${requirements.targetMonth}
  - 時間帯区分: ${JSON.stringify(requirements.timeSlots, null, 2)}
  - 各時間帯の必要人員体制: ${JSON.stringify(requirements.requirements, null, 2)}

  # 休暇希望
  スタッフから以下の休暇希望が提出されています。
  ${formattedLeaveRequests || "今月の休暇希望はありません。"}

  # シフト生成の制約条件
  ## 【絶対条件】
  - 各日付・各時間帯で、事業所が設定した「必要な人員体制（人数、役職、資格）」を必ず満たしてください。
  - スタッフが「勤務できない日」として設定した日には、シフトを割り当てないでください。
  - スタッフから提出された「有給休暇」の希望は、必ず休日（「休」）として割り当ててください。
  - スタッフの「連続勤務の上限」を超えないようにシフトを組んでください。
  - isNightShiftOnlyがtrueに設定されているスタッフには、「夜勤」以外の勤務シフトを割り当てないでください。ただし、休日の割り当ては可能です。
  - 「夜勤」シフトの翌日は必ず「明け休み」とし、翌々日は必ず「休」（公休）としてください。この2日間は他の勤務シフトを割り当てないでください。
  - 1日の勤務が終わってから次の勤務が始まるまで、最低8時間以上の休息時間を確保してください。
  
  ## 【努力目標】
  - スタッフの「希望休」や「研修」の希望日も、可能な限り休日または該当シフトを割り当ててください。
  - スタッフが希望する「週の勤務回数」にできるだけ近づけてください。
  - 特定のスタッフに勤務が偏らないよう、できるだけ公平に割り振ってください。
  - 勤務可能な時間帯の希望（日勤のみ、夜勤のみなど）を尊重してください。

  # 出力形式
  - 必ず以下のJSONスキーマに従った有効なJSONオブジェクトのみを出力してください。説明文などは一切含めないでください。
  - staffIdは、入力されたスタッフ情報のIDと一致させてください。
  - monthlyShifts配列には、対象月の日数(${daysInMonth}日)分のデータを必ず含めてください。
  - shiftTypeには、定義された時間帯区分名（例：「早番」、「日勤」）または休日を示す「休」、夜勤明けの休みを示す「明け休み」を入れてください。
`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      schedule: {
        type: Type.ARRAY,
        description: "全スタッフの月間スケジュール",
        items: {
          type: Type.OBJECT,
          properties: {
            staffId: {
              type: Type.STRING,
              description: "スタッフの一意のID"
            },
            staffName: {
              type: Type.STRING,
              description: "スタッフ名"
            },
            monthlyShifts: {
              type: Type.ARRAY,
              description: "そのスタッフの1ヶ月分のシフト",
              items: {
                type: Type.OBJECT,
                properties: {
                  date: {
                    type: Type.STRING,
                    description: "日付 (YYYY-MM-DD)"
                  },
                  shiftType: {
                    type: Type.STRING,
                    description: "シフト区分 ('早番', '日勤', '遅番', '夜勤', '休', '明け休み')"
                  }
                },
                required: ["date", "shiftType"]
              }
            }
          },
          required: ["staffId", "staffName", "monthlyShifts"]
        }
      }
    },
    required: ["schedule"]
  };

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.5,
      },
    });

    const jsonString = result.text.trim();
    const parsedResult = JSON.parse(jsonString);
    
    // Basic validation
    if (!parsedResult.schedule || !Array.isArray(parsedResult.schedule)) {
        throw new Error("Invalid response format from AI: 'schedule' array not found.");
    }

    return parsedResult.schedule as StaffSchedule[];
  } catch (error) {
    console.error("Error generating shift schedule:", error);
    throw new Error("AIによるシフト生成に失敗しました。要件が複雑すぎるか、APIエラーが発生した可能性があります。");
  }
};

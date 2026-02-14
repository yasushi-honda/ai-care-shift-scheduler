"""
Firebase Cloud Functions エントリポイント: solverGenerateShift

Firebase Functions Python (2nd gen) 用のエントリポイント。
既存の solver.service.SolverService を呼び出す。

ローカルテスト用の Flask版は solver/main.py に保持。
"""

import json

from firebase_functions import https_fn, options

from solver.service import SolverService


@https_fn.on_request(
    memory=options.MemoryOption.GB_1,
    timeout_sec=60,
    region="asia-northeast1",
)
def solverGenerateShift(req: https_fn.Request) -> https_fn.Response:
    """CP-SAT Solverによるシフト生成エンドポイント"""

    if req.method == "OPTIONS":
        return https_fn.Response("", status=204, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST",
            "Access-Control-Allow-Headers": "Content-Type",
        })

    if req.method != "POST":
        return https_fn.Response(
            json.dumps({"success": False, "error": "Method Not Allowed", "errorType": "METHOD_ERROR", "details": {}}),
            status=405,
            headers={"Content-Type": "application/json"},
        )

    data = req.get_json(silent=True)
    if data is None:
        return https_fn.Response(
            json.dumps({"success": False, "error": "リクエストボディが不正です", "errorType": "VALIDATION_ERROR", "details": {}}),
            status=400,
            headers={"Content-Type": "application/json"},
        )

    missing = [f for f in ("staffList", "skeleton", "requirements") if f not in data]
    if missing:
        return https_fn.Response(
            json.dumps({
                "success": False,
                "error": f"必須フィールドが不足: {', '.join(missing)}",
                "errorType": "VALIDATION_ERROR",
                "details": {"missingFields": missing},
            }),
            status=400,
            headers={"Content-Type": "application/json"},
        )

    result = SolverService.solve(
        staff_list=data["staffList"],
        skeleton=data["skeleton"],
        requirements=data["requirements"],
        leave_requests=data.get("leaveRequests", {}),
    )

    if result["success"]:
        status = 200
    elif result.get("errorType") == "INFEASIBLE":
        status = 422
    else:
        status = 500

    return https_fn.Response(
        json.dumps(result),
        status=status,
        headers={"Content-Type": "application/json"},
    )

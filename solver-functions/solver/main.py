"""
Cloud Function エンドポイント: solverGenerateShift

POST /solverGenerateShift
- リクエスト: SolverRequest (staffList, skeleton, requirements, leaveRequests)
- レスポンス: SolverResponse or SolverErrorResponse
"""

from flask import Flask, jsonify, request

from solver.service import SolverService, UnifiedSolverService

app = Flask(__name__)


@app.route("/solverGenerateShift", methods=["POST"])
def solver_generate_shift():
    """CP-SAT Solverによるシフト生成エンドポイント"""
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({
            "success": False,
            "error": "リクエストボディが不正です",
            "errorType": "VALIDATION_ERROR",
            "details": {},
        }), 400

    # 必須フィールドの検証
    missing = []
    for field in ("staffList", "skeleton", "requirements"):
        if field not in data:
            missing.append(field)
    if missing:
        return jsonify({
            "success": False,
            "error": f"必須フィールドが不足: {', '.join(missing)}",
            "errorType": "VALIDATION_ERROR",
            "details": {"missingFields": missing},
        }), 400

    result = SolverService.solve(
        staff_list=data["staffList"],
        skeleton=data["skeleton"],
        requirements=data["requirements"],
        leave_requests=data.get("leaveRequests", {}),
    )

    if result["success"]:
        return jsonify(result), 200
    elif result.get("errorType") == "INFEASIBLE":
        return jsonify(result), 422
    else:
        return jsonify(result), 500


@app.route("/solverUnifiedGenerate", methods=["POST"])
def solver_unified_generate():
    """統合Solver: Phase 1-3を1回の求解で完結"""
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({
            "success": False,
            "error": "リクエストボディが不正です",
            "errorType": "VALIDATION_ERROR",
            "details": {},
        }), 400

    missing = [f for f in ("staffList", "requirements") if f not in data]
    if missing:
        return jsonify({
            "success": False,
            "error": f"必須フィールドが不足: {', '.join(missing)}",
            "errorType": "VALIDATION_ERROR",
            "details": {"missingFields": missing},
        }), 400

    result = UnifiedSolverService.solve(
        staff_list=data["staffList"],
        requirements=data["requirements"],
        leave_requests=data.get("leaveRequests", {}),
    )

    if result["success"]:
        return jsonify(result), 200
    elif result.get("errorType") == "INFEASIBLE":
        return jsonify(result), 422
    else:
        return jsonify(result), 500

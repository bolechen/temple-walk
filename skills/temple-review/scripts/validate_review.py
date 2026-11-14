#!/usr/bin/env python3
"""Validate review evidence consistency. Does not execute tests, publish, or prove quality."""
import argparse
import hashlib
import json
import re
from pathlib import Path

SHA = re.compile(r"[0-9a-f]{40}\Z")
DIGEST = re.compile(r"[0-9a-f]{64}\Z")
STATUSES = {"pass", "partial", "fail", "blocked"}


def validate(report, root):
    errors = []
    if not isinstance(report, dict):
        return ["report must be an object"]
    if report.get("schema_version") != "1.0":
        errors.append("unsupported schema_version")
    if not report.get("run_id"):
        errors.append("run_id required")
    source = report.get("source", {})
    if not isinstance(source, dict):
        source = {}
    commit = source.get("reviewed_commit")
    for field in ("reviewed_commit", "observed_head"):
        if not isinstance(source.get(field), str) or not SHA.fullmatch(source[field]):
            errors.append("source." + field + " must be a full SHA")
    if not source.get("repository") or not source.get("ref"):
        errors.append("source repository and ref required")
    if report.get("change_kind") not in {"docs", "code", "ui", "performance", "security", "no_change"}:
        errors.append("invalid change_kind")
    if report.get("run_status") not in {"completed", "blocked", "no_change"}:
        errors.append("invalid run_status")
    checks, artifacts, issues = (report.get(k) for k in ("checks", "artifacts", "issues"))
    for name, value in (("checks", checks), ("artifacts", artifacts), ("issues", issues)):
        if not isinstance(value, list):
            errors.append(name + " must be an array")
    if errors and not all(isinstance(x, list) for x in (checks, artifacts, issues)):
        return errors
    if report.get("run_status") == "no_change":
        if report.get("verdict") != "no_change" or report.get("change_kind") != "no_change":
            errors.append("no_change must be explicit in status, kind and verdict")
        if checks or artifacts or issues:
            errors.append("no_change must not introduce new checks, evidence or issues")
    elif not checks and report.get("verdict") != "blocked":
        errors.append("non-blocked review requires checks")
    environment = report.get("environment", {})
    if not isinstance(environment, dict):
        errors.append("environment must be an object")
        environment = {}
    root = root.resolve()
    by_id = {}
    for n, a in enumerate(artifacts):
        if not isinstance(a, dict) or not a.get("id") or a.get("id") in by_id:
            errors.append(f"artifact {n}: missing/duplicate id")
            continue
        by_id[a["id"]] = a
        if not a.get("type") or not a.get("mode") or not a.get("created_at"):
            errors.append(f"artifact {n}: type, mode and created_at required")
        if a.get("type") != "generated_reference" and not SHA.fullmatch(str(a.get("commit", ""))):
            errors.append(f"artifact {n}: commit required")
        if a.get("file"):
            p = (root / a["file"]).resolve()
            if not p.is_relative_to(root):
                errors.append(f"artifact {n}: path escapes evidence root")
                continue
            if not p.is_file():
                errors.append(f"artifact {n}: missing local file")
            elif not DIGEST.fullmatch(str(a.get("sha256", ""))) or hashlib.sha256(p.read_bytes()).hexdigest() != a["sha256"]:
                errors.append(f"artifact {n}: SHA-256 mismatch")
        elif not a.get("url"):
            errors.append(f"artifact {n}: file or URL required")
    ids = set()
    for n, check in enumerate(checks):
        if not isinstance(check, dict) or not check.get("id") or check.get("id") in ids:
            errors.append(f"check {n}: missing/duplicate id")
            continue
        ids.add(check["id"])
        if check.get("status") not in STATUSES:
            errors.append(f"check {n}: invalid status")
        if not check.get("criterion") or not check.get("reason") or not check.get("scope"):
            errors.append(f"check {n}: criterion, reason and scope required")
        refs = check.get("evidence_ids", [])
        if not isinstance(refs, list):
            errors.append(f"check {n}: evidence_ids must be an array")
            continue
        if any(x not in by_id for x in refs):
            errors.append(f"check {n}: unknown evidence id")
        if check.get("status") == "pass":
            evidence = [by_id[x] for x in refs if x in by_id]
            applicable = [a for a in evidence if a.get("commit") == commit and a.get("file") and a.get("type") != "generated_reference"]
            if check.get("commit") != commit or not applicable:
                errors.append(f"check {n}: pass requires current-commit local evidence")
            if check.get("scope") in {"runtime", "visual"} and not any(a.get("type") in {"runtime_screenshot", "runtime_video", "test_log", "trace"} for a in applicable):
                errors.append(f"check {n}: no runtime evidence")
            if check.get("scope") == "visual" and not any(a.get("type") == "runtime_screenshot" for a in applicable):
                errors.append(f"check {n}: visual pass needs an actual runtime screenshot")
            if check.get("scope") == "performance" and not any(a.get("type") == "performance_data" for a in applicable):
                errors.append(f"check {n}: performance pass needs raw performance data")
            if check.get("scope") == "runtime" and not any(a.get("mode") == "user_input" for a in applicable):
                errors.append(f"check {n}: user runtime acceptance cannot use diagnostics only")
            if check.get("scope") == "performance" and environment.get("target_device") is not True:
                errors.append(f"check {n}: performance acceptance requires target device")
    issue_ids = set()
    for n, issue in enumerate(issues):
        if not isinstance(issue, dict) or not issue.get("id") or issue.get("id") in issue_ids:
            errors.append(f"issue {n}: missing/duplicate id")
            continue
        issue_ids.add(issue["id"])
        if issue.get("state") not in {"open", "fixed_pending_retest", "verified_closed"} or issue.get("severity") not in {"blocker", "major", "minor", "info"}:
            errors.append(f"issue {n}: invalid state or severity")
        if not issue.get("finding") or not issue.get("recommendation"):
            errors.append(f"issue {n}: finding and recommendation required")
        if issue.get("state") == "verified_closed":
            refs = issue.get("retest_evidence_ids", [])
            if not refs or any(x not in by_id or by_id[x].get("commit") != commit for x in refs):
                errors.append(f"issue {n}: closing needs current retest evidence")
    verdict = report.get("verdict")
    if verdict not in {"accepted", "not_accepted", "partial", "blocked", "no_change"}:
        errors.append("invalid verdict")
    if verdict == "accepted":
        if not checks or any(not isinstance(c, dict) or c.get("status") != "pass" for c in checks):
            errors.append("accepted requires every declared check to pass")
        if any(isinstance(i, dict) and i.get("severity") in {"blocker", "major"} and i.get("state") != "verified_closed" for i in issues):
            errors.append("accepted cannot retain unresolved blocker/major issues")
        if report.get("run_status") != "completed":
            errors.append("accepted requires completed run")
    publish = report.get("publish", {})
    if not isinstance(publish, dict):
        errors.append("publish must be an object")
        publish = {}
    if publish.get("status") == "succeeded" and (not publish.get("requested") or not publish.get("url") or not publish.get("site_version") or not SHA.fullmatch(str(publish.get("hosting_commit", "")))):
        errors.append("successful publication requires authorization flag, URL, version and hosting SHA")
    return errors


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("report", type=Path)
    p.add_argument("--root", type=Path)
    a = p.parse_args()
    try:
        report = json.loads(a.report.read_text(encoding="utf-8-sig"))
        errors = validate(report, a.root or a.report.parent)
    except (OSError, ValueError, TypeError, KeyError, AttributeError) as e:
        print("INVALID: " + type(e).__name__)
        return 1
    if errors:
        print("INVALID\n" + "\n".join(errors))
        return 1
    print("VALID: evidence consistency only; not a quality certification")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

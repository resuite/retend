#!/usr/bin/env python3
import os
import re
import sys
import argparse

JSX_ATTR_PATTERN = r"<\w[^>]*?\s\w+\s*=\s*\{"
JSX_CHILD_PATTERN = r"\w>\s*\{"

RULES = [
    (
        r"(?:" + JSX_ATTR_PATTERN + r"|" + JSX_CHILD_PATTERN + r")[^{}]*\.\s*get\(",
        "Critical: .get() called in JSX. Pass Cell directly.",
        "ERROR",
    ),
    (
        r"(?:"
        + JSX_ATTR_PATTERN
        + r"|"
        + JSX_CHILD_PATTERN
        + r")[^{}]*(?:\?(?![?.\[])[^:]*:|&&|\|\|)",
        "Critical: Inline logic (?, &&, ||) in JSX. Use If() or Switch().",
        "ERROR",
    ),
    (
        r"(?:" + JSX_ATTR_PATTERN + r"|" + JSX_CHILD_PATTERN + r")[^{}]*\.\s*map\s*\(",
        "Critical: .map() used in JSX. Use For() for granular reactivity.",
        "ERROR",
    ),
    (
        r"derivedAsync\s*\([\s\S]{0,50}?=>[\s\S]{0,200}?\w+\s*\.\s*get\s*\(",
        "Critical: Direct .get() in derivedAsync. Use get(cell) param.",
        "ERROR",
    ),
    (
        r"Cell\.source\(\s*(?:true|false|null)\s*\)[^;]{0,200}?\bfetch\s*\(",
        "Warning: Manual loading/data cells alongside fetch. Use derivedAsync or task.",
        "WARNING",
    ),
    (
        r"\buse(?:State|Effect|Memo|Callback|Ref|Context)\s*\(",
        "Critical: React hook used. Use Cells/onSetup/listen.",
        "ERROR",
    ),
    (
        r"^\s*(?:import\s+[^;]+\s+from\s*['\"]react(?:-dom)?|const\s+[^=]+=\s*require\(['\"]react(?:-dom))",
        "Critical: React import found. Retend is a separate framework.",
        "ERROR",
    ),
    (
        r"onSetup\(\s*\(\)\s*=>\s*\{[^}]*\.listen\s*\(",
        "Critical: .listen() wrapped in onSetup. Call directly in component body.",
        "ERROR",
    ),
    (
        r"\bwindow\.location\b",
        "Critical: Manual navigation. Use router.navigate().",
        "ERROR",
    ),
    (r"\bhtmlFor\s*=", "Style: Use 'for' instead of 'htmlFor'.", "STYLE"),
    (
        r'class\s*=\s*\{\s*\[\s*(?:(?:["\'][^"\']*?["\'])\s*(?:,\s*["\'][^"\']*?["\']\s*)*)\s*\]\s*\}',
        "Style: Array syntax for static classes. Use simple string (class=\"a b\").",
        "STYLE",
    ),
    (
        r"<button\b(?![^>]*\btype\s*=)[^>]*>",
        "Warning: <button> missing 'type' attribute.",
        "WARNING",
    ),
]

EXCLUDED_DIRS = {"node_modules", "vendor", "build", "dist"}
JS_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"}

SEVERITY_EXIT_CODE = {"ERROR": 1, "WARNING": 2, "STYLE": 3}


def strip_comments(content):
    result = []
    i = 0
    n = len(content)
    while i < n:
        if i + 1 < n and content[i : i + 2] == "//":
            j = i
            while j < n and content[j] != "\n":
                j += 1
            result.append(" " * (j - i))
            i = j
        elif i + 1 < n and content[i : i + 2] == "/*":
            j = i + 2
            while j < n - 1 and content[j : j + 2] != "*/":
                j += 1
            j = min(j + 2, n)
            result.append(" " * (j - i))
            i = j
        else:
            result.append(content[i])
            i += 1
    return "".join(result)


def compute_line_offsets(content):
    offsets = [0]
    pos = 0
    while True:
        pos = content.find("\n", pos)
        if pos == -1:
            break
        offsets.append(pos + 1)
        pos += 1
    return offsets


def get_line_number(offsets, pos):
    lo, hi = 0, len(offsets)
    while lo < hi:
        mid = (lo + hi) // 2
        if offsets[mid] <= pos:
            lo = mid + 1
        else:
            hi = mid
    return lo


def audit_file(file_path):
    violations = []
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
    except (IOError, UnicodeDecodeError) as e:
        print(f"Error reading {file_path}: {e}")
        return violations

    line_offsets = compute_line_offsets(content)
    code_only = strip_comments(content)

    for pattern, message, severity in RULES:
        for match in re.finditer(pattern, code_only, re.MULTILINE):
            line_no = get_line_number(line_offsets, match.start())
            violations.append((line_no, severity, message))
    return violations


def is_excluded(path):
    parts = os.path.normpath(path).split(os.sep)
    return any(part in EXCLUDED_DIRS for part in parts)


def has_js_extension(filename):
    _, ext = os.path.splitext(filename)
    return ext in JS_EXTENSIONS


def main():
    parser = argparse.ArgumentParser(
        description="Audit Retend code for common violations."
    )
    parser.add_argument("path", help="File or directory to audit")
    args = parser.parse_args()

    if not os.path.exists(args.path):
        print(f"Error: Path not found: {args.path}")
        sys.exit(1)

    files = []
    if os.path.isfile(args.path):
        if is_excluded(args.path):
            print(f"Skipping excluded path: {args.path}")
        elif has_js_extension(args.path):
            files.append(args.path)
    else:
        for root, dirnames, filenames in os.walk(args.path):
            dirnames[:] = [d for d in dirnames if d not in EXCLUDED_DIRS]
            for filename in filenames:
                if has_js_extension(filename):
                    files.append(os.path.join(root, filename))

    if not files:
        print("No files to audit.")
        sys.exit(0)

    worst_severity = None
    total_issues = 0

    for file_path in files:
        violations = audit_file(file_path)
        if violations:
            print(f"\n--- {file_path} ---")
            for line, sev, msg in sorted(violations):
                print(f"  [{sev}] Line {line}: {msg}")
                total_issues += 1
                if sev == "ERROR" or (sev == "WARNING" and worst_severity != "ERROR"):
                    worst_severity = sev

    if total_issues > 0:
        print(f"\nTotal issues found: {total_issues}")
        sys.exit(SEVERITY_EXIT_CODE.get(worst_severity, 1))
    else:
        print("No common Retend violations found.")
        sys.exit(0)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Install this repository's canonical review skill into a selected client's project directory."""
import argparse
import shutil
from pathlib import Path


def same_tree(a, b):
    files_a = {p.relative_to(a): p for p in a.rglob("*") if p.is_file() and "__pycache__" not in p.parts}
    files_b = {p.relative_to(b): p for p in b.rglob("*") if p.is_file() and "__pycache__" not in p.parts}
    return files_a.keys() == files_b.keys() and all(files_a[k].read_bytes() == files_b[k].read_bytes() for k in files_a)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--client", choices=["claude", "codex", "both"], default="both")
    p.add_argument("--root", type=Path, default=Path.cwd(), help="Target project root; default current directory")
    p.add_argument("--replace", action="store_true", help="Replace this skill's existing directory after inspecting local differences")
    a = p.parse_args()
    source = Path(__file__).resolve().parents[1] / "skills" / "temple-review"
    if not (source / "SKILL.md").is_file():
        p.error("canonical skill package missing")
    if any(p.is_symlink() for p in source.rglob("*")):
        p.error("source package must not contain symlinks")
    root = a.root.resolve()
    if not root.is_dir():
        p.error("target project root must exist")
    clients = ["claude", "codex"] if a.client == "both" else [a.client]
    targets = [root / (".claude" if c == "claude" else ".agents") / "skills" / "temple-review" for c in clients]
    for target in targets:
        if target.resolve().is_relative_to(source) or source.is_relative_to(target.resolve()):
            p.error("source and destination must not contain each other")
        if target.exists() and any(p.is_symlink() for p in target.rglob("*")):
            p.error("existing skill contains symlinks; inspect before replacing")
        if target.is_symlink() or not target.resolve().is_relative_to(root):
            p.error("target must stay within project root without an escaping symlink")
        if target.exists() and not same_tree(source, target) and not a.replace:
            p.error("existing skill differs; inspect it, then use --replace if intended")
    for target in targets:
        if target.exists() and same_tree(source, target):
            print("Already current: " + str(target.relative_to(root)))
            continue
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(source, target, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
        print("Installed: " + str(target.relative_to(root)))
    print("No tests, credentials, scheduling or deployment were started.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

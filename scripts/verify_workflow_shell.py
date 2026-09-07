#!/usr/bin/env python3
"""Two guards on the shell inside GitHub Actions workflows.

Both exist because of one outage-shaped bug. The SOUNDING deploy job asserts
that the built bundle references the base path it was built for, and the
expected string is `"/assets/` -- it opens with a double quote deliberately,
because that quote is what makes a root build and a subdirectory build
mutually exclusive. That value was interpolated with ${{ }} straight into the
body of a `run:` step, where it did not arrive as data: it became script text,
its quote closed the surrounding echo, and the generated script failed to
parse before it ran a single check. The job had been tested by running the
same logic locally with the value in a shell variable, which is precisely the
form that cannot reproduce the fault.

  1. No ${{ }} inside a `run:` body. Pass values through `env:` instead, where
     they are data and awkward characters are inert. This is also the standard
     defence against script injection from attacker-controlled expressions.
  2. Every `run:` body parses under `bash -n`.

Run: python3 scripts/verify_workflow_shell.py
"""
import glob
import re
import subprocess
import sys

import yaml

EXPR = re.compile(r"\$\{\{[^}]*\}\}")
failures = []


def steps_of(doc):
    for job_name, job in (doc.get("jobs") or {}).items():
        for step in job.get("steps") or []:
            if step.get("run"):
                yield job_name, step.get("name", "(unnamed)"), step["run"]


for path in sorted(glob.glob(".github/workflows/*.y*ml")):
    with open(path, encoding="utf-8") as fh:
        doc = yaml.safe_load(fh)
    for job, name, body in steps_of(doc):
        where = f"{path} :: {job} :: {name}"

        found = EXPR.findall(body)
        if found:
            failures.append(
                f"{where}\n    interpolates into the shell: {', '.join(sorted(set(found)))}"
                "\n    pass it through `env:` and reference it as a variable"
            )

        # Substitute any expression before parsing, so this check reports a
        # genuine syntax error rather than re-reporting rule 1.
        probe = subprocess.run(
            ["bash", "-n"], input=EXPR.sub("X", body),
            capture_output=True, text=True,
        )
        if probe.returncode != 0:
            failures.append(f"{where}\n    does not parse: {probe.stderr.strip()}")

print(f"\nworkflow shell — {len(list(glob.glob('.github/workflows/*.y*ml')))} file(s)")
if failures:
    print(f"\n{len(failures)} failing:\n")
    for f in failures:
        print(f"  {f}\n")
    sys.exit(1)
print("  every run: body parses, and none interpolates an expression into it\n")

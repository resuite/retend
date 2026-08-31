import subprocess
from pathlib import Path

root = Path('/Users/mac/Documents/Projects/retend/experiments/retend-gpui')
native = root / 'native'
commands = [
    (['cargo', 'fmt', '--', '--check'], native),
    (['pnpm', 'run', 'protocol:check'], root),
    (['pnpm', 'run', 'typecheck'], root),
    (['pnpm', 'run', 'native:build'], root),
    (['pnpm', 'run', 'test:native'], root),
    (['pnpm', 'run', 'test'], root),
]
for command, cwd in commands:
    print(f"== {' '.join(command)} ==")
    subprocess.run(command, cwd=cwd, check=True)

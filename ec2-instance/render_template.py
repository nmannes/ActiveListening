import sys
import os
from jinja2 import Environment, FileSystemLoader

if len(sys.argv) < 3:
    print(
        "Usage: python3 render_template.py <template_dir> <template_name> [output_file]"
    )
    sys.exit(1)

template_dir = sys.argv[1]
template_name = sys.argv[2]
output_file = sys.argv[3] if len(sys.argv) > 3 else None

env = Environment(loader=FileSystemLoader(template_dir))


# Add an indent filter for YAML content
def indent_filter(s, width=4, first=False):
    if s is None:
        return ""
    lines = s.splitlines(keepends=True)
    indent = " " * width
    if first:
        return indent.join(lines)
    else:
        # First line is not indented, rest are
        if not lines:
            return ""
        return lines[0] + "".join(indent + line for line in lines[1:])


env.filters["indent_yaml"] = indent_filter


def load_file(filename):
    path = os.path.join(template_dir, filename)
    if os.path.exists(path):
        with open(path, "r") as f:
            return f.read()
    return ""


# Parse --env argument
env_name = "demo"
if "--env" in sys.argv:
    idx = sys.argv.index("--env")
    if idx + 1 < len(sys.argv):
        env_name = sys.argv[idx + 1]


def load_env_file(env_name):
    env_file = os.path.join(template_dir, "..", f".env.{env_name}")
    if not os.path.exists(env_file):
        return "# missing env file"

    with open(env_file, "r") as f:
        lines = f.readlines()

    processed_lines = []
    for line in lines:
        if line.startswith("KALSHI_KEY_ID="):
            processed_lines.append("KALSHI_KEY_ID=${KalshiKeyId}\n")
        elif line.startswith("KALSHI_ENV="):
            processed_lines.append("KALSHI_ENV=${Environment}\n")
        elif line.startswith("KALSHI_BASE_DOMAIN="):
            processed_lines.append(
                'KALSHI_BASE_DOMAIN=${!If [!Equals [!Ref Environment, "prod"], "https://api.elections.kalshi.com/trade-api/v2", "https://demo-api.kalshi.co/trade-api/v2"]}\n'
            )
        elif line.startswith("KALSHI_PRIVATE_KEY_PATH="):
            processed_lines.append(
                "KALSHI_PRIVATE_KEY_PATH=/home/ec2-user/private_key.txt\n"
            )
        else:
            processed_lines.append(line)
    return "".join(processed_lines)


pylib_dir = os.path.join(template_dir, "..", "pylib")
context = {
    "server_py": load_file("../server.py"),
    "setup_kalshi_sh": load_file("setup_kalshi.sh.j2"),
    "kalshi_service": load_file("kalshi.service.j2"),
    "requirements_txt": load_file("../requirements.txt"),
    "env_content": load_env_file(env_name),
}

# Load all pylib/*.py files as template variables (e.g. pylib_clip_py, pylib_transcriber_py)
if os.path.isdir(pylib_dir):
    for fname in sorted(os.listdir(pylib_dir)):
        if fname.endswith(".py"):
            var_name = f"pylib_{fname.replace('.', '_')}"
            with open(os.path.join(pylib_dir, fname), "r") as f:
                content = f.read()
                # Ensure __init__.py isn't empty to avoid CloudFormation parser issues
                # (cfn-init "File specified without source or content" error)
                if fname == "__init__.py" and not content.strip():
                    content = "# pylib package\n"
                context[var_name] = content
                print(f"Loaded {fname} ({len(content)} bytes)")

expected_vars = [
    "pylib___init___py",
    "pylib_audio_decoder_py",
    "pylib_clip_py",
    "pylib_kalshi_client_py",
    "pylib_keyword_matching_py",
    "pylib_transcriber_py",
    "pylib_speaker_recognition_py",
]
missing = []
for v in expected_vars:
    if v not in context or not context.get(v):
        missing.append(v)

if missing:
    print(f"ERROR: Missing or empty required variables in context: {missing}")
    sys.exit(1)

template = env.get_template(template_name)
rendered = template.render(**context)

if output_file:
    with open(output_file, "w") as f:
        f.write(rendered)
else:
    print(rendered)

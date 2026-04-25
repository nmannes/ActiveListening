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


import subprocess
import requests

# Fetch current IP for Security Group defaults
def get_current_ip_context():
    try:
        # Use requests for public IP discovery
        resp = requests.get('https://ifconfig.me', timeout=5)
        ip = resp.text.strip()
        if ':' in ip:
            return {
                "current_ip_cidr": f"{ip}/128",
                "current_ip_version": "IPv6"
            }
        else:
            return {
                "current_ip_cidr": f"{ip}/32",
                "current_ip_version": "IPv4"
            }
    except Exception as e:
        print(f"Warning: Could not fetch public IP: {e}")
        return {
            "current_ip_cidr": "0.0.0.0/0",
            "current_ip_version": "IPv4"
        }

def get_ssh_public_key():
    key_path = os.path.expanduser("~/.ssh/id_ed25519.pub")
    if os.path.exists(key_path):
        try:
            with open(key_path, "r") as f:
                return f.read().strip()
        except Exception as e:
            print(f"Warning: Could not read SSH public key: {e}")
    return ""

context = {
    "setup_kalshi_sh": load_file("setup_kalshi.sh.j2"),
    "kalshi_service": load_file("kalshi.service.j2"),
    "ssh_public_key": get_ssh_public_key(),
    **get_current_ip_context()
}

# Validation - ensure core files and some pylib files are present
required_core_files = ["setup_kalshi_sh", "kalshi_service"]
missing = [v for v in required_core_files if v not in context or not context.get(v)]

if missing:
    print(f"ERROR: Missing or empty required core variables in context: {missing}")
    sys.exit(1)

template = env.get_template(template_name)
rendered = template.render(**context)

if output_file:
    with open(output_file, "w") as f:
        f.write(rendered)
else:
    print(rendered)

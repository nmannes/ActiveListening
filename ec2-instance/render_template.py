import sys
import os
from jinja2 import Environment, FileSystemLoader

if len(sys.argv) < 3:
    print("Usage: python3 render_template.py <template_dir> <template_name> [output_file]")
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

env.filters['indent_yaml'] = indent_filter

def load_file(filename):
    path = os.path.join(template_dir, filename)
    if os.path.exists(path):
        with open(path, 'r') as f:
            return f.read()
    return ""

# Prepare variables for the template
context = {
    'server_py': load_file('../server.py'),
    'clip_py': load_file('../clip.py'),
    'setup_kalshi_sh': load_file('setup_kalshi.sh.j2'),
    'kalshi_service': load_file('kalshi.service.j2'),
}

template = env.get_template(template_name)
rendered = template.render(**context)

if output_file:
    with open(output_file, 'w') as f:
        f.write(rendered)
else:
    print(rendered)

import os
import re

BASE_DIR = "/home/moondae/Antigravity Projects/DoC Learning Hub"
files = ["app.js", "index.html", "index.css"]

replacements = [
    # Case-sensitive replacement list
    ("Teacher", "Faculty"),
    ("teacher", "faculty"),
    ("TEACHER", "FACULTY")
]

for filename in files:
    path = os.path.join(BASE_DIR, filename)
    if not os.path.exists(path):
        print(f"Skipping {filename} (not found)")
        continue
    
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    original_len = len(content)
    replaced_count = 0
    
    # We do the replacements
    # To avoid replacing substring overlaps in the wrong order, we can replace them sequentially since:
    # 'Teacher' vs 'teacher' vs 'TEACHER' are distinct case patterns.
    new_content = content
    for old_str, new_str in replacements:
        # Count occurrences first
        matches = len(re.findall(re.escape(old_str), new_content))
        if matches > 0:
            new_content = new_content.replace(old_str, new_str)
            replaced_count += matches
            print(f"File {filename}: replaced {matches} occurrences of '{old_str}' with '{new_str}'")

    if new_content != content:
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Saved changes to {filename}. Total replacements: {replaced_count}")
    else:
        print(f"No replacements made in {filename}")

import re

files = ["app.js", "index.html", "index.css", "firestore.rules"]
for filename in files:
    print(f"=== {filename} ===")
    try:
        with open(filename, "r") as f:
            for idx, line in enumerate(f, 1):
                if re.search(r'teacher', line, re.IGNORECASE):
                    print(f"{idx}: {line.strip()}")
    except Exception as e:
        print(f"Error reading {filename}: {e}")

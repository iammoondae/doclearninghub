import os
import re
import sys
import json

# Project Paths configuration
BASE_DIR = "/home/moondae/Antigravity Projects/DoC Learning Hub"
APP_JS_PATH = os.path.join(BASE_DIR, "app.js")
INDEX_HTML_PATH = os.path.join(BASE_DIR, "index.html")
INDEX_CSS_PATH = os.path.join(BASE_DIR, "index.css")
MANIFEST_PATH = os.path.join(BASE_DIR, "data/manifest.json")

REQUIRED_DOCS = [
    "moon_standards.md",
    "code_map.md",
    "master_context.md"
]

def check_documentation():
    print("📋 Checking Project Documentation & Standards Files...")
    passed = True
    for doc in REQUIRED_DOCS:
        path = os.path.join(BASE_DIR, doc)
        if not os.path.exists(path):
            print(f"  ❌ FAIL: Standards file '{doc}' is missing.")
            passed = False
        elif os.path.getsize(path) < 100:
            print(f"  ❌ FAIL: Standards file '{doc}' is empty or too small.")
            passed = False
        else:
            print(f"  ✅ PASS: Standards file '{doc}' is present.")
    return passed

def strip_code(content):
    n = len(content)
    output = list(content)
    
    def blank_char(idx):
        if content[idx] != '\n':
            output[idx] = ' '

    # State stack: elements are either a string (e.g. 'normal', 'template_string') 
    # or a tuple/dict for states with metadata like ('template_expr', brace_count) or ('regex', in_class)
    stack = ['normal']
    
    i = 0
    while i < n:
        state = stack[-1]
        
        # Determine state name
        if isinstance(state, tuple):
            state_name = state[0]
        else:
            state_name = state
            
        if state_name in ['normal', 'template_expr']:
            # Check for comments
            if content[i:i+2] == '//':
                stack.append('single_line_comment')
                blank_char(i)
                blank_char(i+1)
                i += 2
                continue
            elif content[i:i+2] == '/*':
                stack.append('multi_line_comment')
                blank_char(i)
                blank_char(i+1)
                i += 2
                continue
            # Check for strings
            elif content[i] == "'":
                stack.append('single_quote_string')
                blank_char(i)
                i += 1
                continue
            elif content[i] == '"':
                stack.append('double_quote_string')
                blank_char(i)
                i += 1
                continue
            elif content[i] == '`':
                stack.append('template_string')
                blank_char(i)
                i += 1
                continue
            # Check for regex
            elif content[i] == '/':
                # Division operator check: preceding non-space char
                k = i - 1
                while k >= 0 and content[k].isspace():
                    k -= 1
                if k >= 0 and (content[k].isalnum() or content[k] in [')', ']', '}', '_', '$']):
                    # Division operator: keep it
                    i += 1
                else:
                    # Regex literal
                    stack.append(('regex', False)) # (regex, in_class)
                    blank_char(i)
                    i += 1
                continue
            # Check for braces inside template expressions
            elif content[i] == '{':
                if state_name == 'template_expr':
                    # Increment brace count
                    stack[-1] = ('template_expr', state[1] + 1)
                i += 1
                continue
            elif content[i] == '}':
                if state_name == 'template_expr':
                    brace_count = state[1] - 1
                    if brace_count == 0:
                        stack.pop()
                    else:
                        stack[-1] = ('template_expr', brace_count)
                i += 1
                continue
            else:
                i += 1
                continue
                
        elif state_name == 'single_line_comment':
            if content[i] == '\n':
                stack.pop()
                # Keep newline, do not blank
                i += 1
            else:
                blank_char(i)
                i += 1
            continue
            
        elif state_name == 'multi_line_comment':
            if content[i:i+2] == '*/':
                stack.pop()
                blank_char(i)
                blank_char(i+1)
                i += 2
            else:
                blank_char(i)
                i += 1
            continue
            
        elif state_name == 'single_quote_string':
            if content[i] == '\\':
                blank_char(i)
                if i + 1 < n:
                    blank_char(i+1)
                i += 2
            elif content[i] == "'":
                stack.pop()
                blank_char(i)
                i += 1
            else:
                blank_char(i)
                i += 1
            continue
            
        elif state_name == 'double_quote_string':
            if content[i] == '\\':
                blank_char(i)
                if i + 1 < n:
                    blank_char(i+1)
                i += 2
            elif content[i] == '"':
                stack.pop()
                blank_char(i)
                i += 1
            else:
                blank_char(i)
                i += 1
            continue
            
        elif state_name == 'regex':
            in_class = state[1]
            if content[i] == '\\':
                blank_char(i)
                if i + 1 < n:
                    blank_char(i+1)
                i += 2
            elif content[i] == '[' and not in_class:
                stack[-1] = ('regex', True)
                blank_char(i)
                i += 1
            elif content[i] == ']' and in_class:
                stack[-1] = ('regex', False)
                blank_char(i)
                i += 1
            elif content[i] == '/' and not in_class:
                stack.pop()
                blank_char(i)
                i += 1
                # Consume regex modifiers
                while i < n and content[i] in ['g', 'i', 'm', 'y', 'u', 's', 'd']:
                    blank_char(i)
                    i += 1
            else:
                blank_char(i)
                i += 1
            continue
            
        elif state_name == 'template_string':
            if content[i:i+2] == '${':
                blank_char(i) # Blank '$'
                # Keep '{' as it starts the template expression
                stack.append(('template_expr', 1))
                i += 2
            elif content[i] == '\\':
                blank_char(i)
                if i + 1 < n:
                    blank_char(i+1)
                i += 2
            elif content[i] == '`':
                stack.pop()
                blank_char(i)
                i += 1
            else:
                blank_char(i)
                i += 1
            continue
            
    return "".join(output)

def check_brackets():
    print("🔍 Checking JavaScript Brackets Balance (app.js)...")
    if not os.path.exists(APP_JS_PATH):
        print("  ❌ FAIL: app.js is missing.")
        return False

    with open(APP_JS_PATH, "r", encoding="utf-8") as f:
        original_content = f.read()

    # Pre-process code to strip comments, strings and regexes
    content = strip_code(original_content)

    stack = []
    pairs = {')': '(', '}': '{', ']': '['}
    line = 1
    col = 1
    
    for idx, char in enumerate(content):
        # Track line and column numbers
        if char == '\n':
            line += 1
            col = 1
            continue
            
        # Handle brackets
        if char in ['(', '{', '[']:
            stack.append((char, line, col))
        elif char in [')', '}', ']']:
            if not stack:
                print(f"  ❌ FAIL: Unmatched closing bracket '{char}' at line {line}, col {col}")
                return False
            top_char, top_line, top_col = stack.pop()
            if pairs[char] != top_char:
                print(f"  ❌ FAIL: Mismatched brackets. Closed '{char}' at line {line}, col {col} but top was '{top_char}' from line {top_line}, col {top_col}")
                return False
        col += 1
        
    if stack:
        for char, top_line, top_col in stack:
            print(f"  ❌ FAIL: Unclosed bracket '{char}' from line {top_line}, col {top_col}")
        return False
        
    print("  ✅ PASS: Brackets/Parentheses are perfectly balanced in app.js!")
    return True

def check_manifest():
    print("📂 Validating Course Manifest Schema (manifest.json)...")
    if not os.path.exists(MANIFEST_PATH):
        print("  ❌ FAIL: manifest.json is missing.")
        return False

    try:
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"  ❌ FAIL: manifest.json is not valid JSON: {e}")
        return False

    errors = []

    # Validate announcements
    anns = data.get("announcements", [])
    for idx, ann in enumerate(anns):
        if not ann.get("id") or not ann.get("title") or not ann.get("content"):
            errors.append(f"Announcement index {idx} is missing required fields (id, title, content).")

    # Validate courses
    courses = data.get("courses", [])
    if not courses:
        errors.append("No courses found in manifest.")
    
    for c_idx, course in enumerate(courses):
        c_id = course.get("id")
        c_name = course.get("name")
        if not c_id or not c_name:
            errors.append(f"Course index {c_idx} is missing id or name.")
            continue

        # Syllabus schema
        syll = course.get("syllabus")
        if not syll or not syll.get("pdfUrl"):
            errors.append(f"Course '{c_id}' is missing syllabus pdfUrl.")

        # Modules schema
        modules = course.get("modules", [])
        if not modules:
            errors.append(f"Course '{c_id}' has no modules.")
            continue

        for m_idx, module in enumerate(modules):
            m_id = module.get("id")
            m_title = module.get("title")
            if not m_id or not m_title:
                errors.append(f"Course '{c_id}' module index {m_idx} is missing id or title.")
                continue

            # Quiz schema (optional but must be valid if exists)
            quiz = module.get("quiz")
            if quiz:
                questions = quiz.get("questions", [])
                if not questions:
                    errors.append(f"Module '{m_id}' quiz is missing questions array.")
                for q_idx, q in enumerate(questions):
                    q_type = q.get("type")
                    if q_type not in ["mc", "tf", "id"]:
                        errors.append(f"Module '{m_id}' quiz Q{q_idx + 1} has invalid type: '{q_type}'.")
                    if not q.get("question"):
                        errors.append(f"Module '{m_id}' quiz Q{q_idx + 1} is missing the question text.")
                    
                    ans = q.get("answer")
                    if ans is None:
                        errors.append(f"Module '{m_id}' quiz Q{q_idx + 1} is missing an answer key.")
                    else:
                        if q_type == "mc":
                            choices = q.get("choices", [])
                            if not choices or len(choices) < 2:
                                errors.append(f"Module '{m_id}' quiz Q{q_idx + 1} (MCQ) must have at least 2 choices.")
                            elif not isinstance(ans, int) or ans < 0 or ans >= len(choices):
                                errors.append(f"Module '{m_id}' quiz Q{q_idx + 1} (MCQ) answer index '{ans}' is out of range.")
                        elif q_type == "tf" and not isinstance(ans, bool):
                            errors.append(f"Module '{m_id}' quiz Q{q_idx + 1} (True/False) answer must be a boolean.")

            # Assignment schema (optional but must be valid if exists)
            assign = module.get("assignment")
            if assign:
                if not assign.get("title") or not assign.get("formUrl"):
                    errors.append(f"Module '{m_id}' assignment is missing title or formUrl.")

    if errors:
        for err in errors:
            print(f"  ❌ FAIL: {err}")
        return False

    print("  ✅ PASS: manifest.json strictly matches the course/quiz schema!")
    return True

def check_firestore_rules():
    print("🔒 Checking Firestore Rules Status...")
    import subprocess
    is_modified = False
    try:
        # Check if rules are modified locally compared to git HEAD
        res = subprocess.run(["git", "diff", "--name-only", "HEAD", "firestore.rules"], capture_output=True, text=True)
        is_modified = "firestore.rules" in res.stdout
    except Exception:
        # If git check fails, check local file modification compared to commit or fallback to true
        is_modified = True

    if is_modified:
        print("\n" + "="*70)
        print("🔒 Firebase Security Rules Update Recommendation")
        print("Yes, you should manually update the security rules in your live Firebase Console using the configurations set up in our local firestore.rules file. Since client-side code cannot programmatically change live security settings:\n")
        print("Open the Firebase Console Firestore Security Rules Tab.")
        print("Open the local firestore.rules file.")
        print("Select and copy all content in the local file, paste it over the existing rules in the Firebase console web editor, and click Publish.\n")
        print("link: https://console.firebase.google.com/u/8/project/doc-learning-hub-web/firestore/databases/-default-/security/rules")
        print("="*70 + "\n")
    else:
        print("  ✅ PASS: firestore.rules matches database HEAD configurations.")
    return True

def main():
    print("==================================================")
    print("       DoC LMS Codebase QA Validation Gate")
    print("==================================================")
    
    doc_ok = check_documentation()
    print("")
    brackets_ok = check_brackets()
    print("")
    manifest_ok = check_manifest()
    print("")
    rules_ok = check_firestore_rules()
    print("")
    
    if doc_ok and brackets_ok and manifest_ok and rules_ok:
        print("🎉 QUALITY GATE PASSED: All architectural standards are met!")
        sys.exit(0)
    else:
        print("🚨 QUALITY GATE FAILED: Please fix validation errors above.")
        sys.exit(1)

if __name__ == '__main__':
    main()

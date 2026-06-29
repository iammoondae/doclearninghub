import re
import sys

def check_js_syntax(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # We will walk through the JS character by character and maintain states:
    # 0: normal code
    # 1: single line comment (//)
    # 2: multi line comment (/* */)
    # 3: single quote string ('')
    # 4: double quote string ("")
    # 5: template literal (``)
    # 6: regex literal (//)
    
    state = 0
    escape = False
    in_regex_class = False
    stack = []
    
    i = 0
    n = len(content)
    line_num = 1
    col_num = 1
    
    # helper to check if a slash is starting a regex literal
    # JS regexes usually follow operators or statement starts
    def is_regex_start(pos):
        # look backward for the first non-whitespace char
        j = pos - 1
        while j >= 0 and content[j].isspace():
            j -= 1
        if j < 0:
            return True
        char = content[j]
        # if the preceding character is an operator or bracket/comma/semicolon, it's a regex
        if char in "(,=:[!&|?~+*-^/%":
            return True
        # Check words like "return", "throw", "typeof", "yield", "delete", "void"
        # Let's get the word
        word_chars = []
        while j >= 0 and (content[j].isalnum() or content[j] == '_'):
            word_chars.append(content[j])
            j -= 1
        word = "".join(reversed(word_chars))
        if word in ["return", "throw", "typeof", "yield", "delete", "void", "replace", "match", "search"]:
            return True
        return False

    cleaned = []
    
    while i < n:
        char = content[i]
        
        # Track line/col
        current_line = line_num
        current_col = col_num
        
        if char == '\n':
            line_num += 1
            col_num = 1
        else:
            col_num += 1
            
        if escape:
            escape = False
            i += 1
            continue
            
        if state == 1: # single line comment
            if char == '\n':
                state = 0
            i += 1
            continue
            
        if state == 2: # multi line comment
            if char == '*' and i + 1 < n and content[i+1] == '/':
                state = 0
                i += 2
                col_num += 1
                continue
            i += 1
            continue
            
        if state == 3: # single quote string
            if char == '\\':
                escape = True
            elif char == '\'':
                state = 0
            i += 1
            continue
            
        if state == 4: # double quote string
            if char == '\\':
                escape = True
            elif char == '"':
                state = 0
            i += 1
            continue
            
        if state == 5: # template literal
            if char == '\\':
                escape = True
            elif char == '`':
                state = 0
            i += 1
            continue
            
        if state == 6: # regex literal
            if char == '\\':
                escape = True
            elif char == '[':
                in_regex_class = True
            elif char == ']':
                in_regex_class = False
            elif char == '/' and not in_regex_class:
                # check if there's regex flags (e.g. g, i, m)
                state = 0
            i += 1
            continue
            
        # State is 0 (normal code)
        # Check comments
        if char == '/' and i + 1 < n and content[i+1] == '/':
            state = 1
            i += 2
            col_num += 1
            continue
        elif char == '/' and i + 1 < n and content[i+1] == '*':
            state = 2
            i += 2
            col_num += 1
            continue
            
        # Check strings
        if char == '\'':
            state = 3
            i += 1
            continue
        if char == '"':
            state = 4
            i += 1
            continue
        if char == '`':
            state = 5
            i += 1
            continue
            
        # Check regex
        if char == '/':
            if is_regex_start(i):
                state = 6
                i += 1
                continue
            
        # Brackets tracking
        if char in '([{':
            stack.append((char, current_line, current_col))
        elif char in ')]}':
            if not stack:
                print(f"Extra closing {char} on line {current_line}:{current_col}")
                return False
            top_char, top_line, top_col = stack.pop()
            mismatch = False
            if char == ')' and top_char != '(':
                mismatch = True
            elif char == ']' and top_char != '[':
                mismatch = True
            elif char == '}' and top_char != '{':
                mismatch = True
                
            if mismatch:
                print(f"Mismatch: opened {top_char} on line {top_line}:{top_col} but closed with {char} on line {current_line}:{current_col}")
                lines = content.split('\n')
                start_l = max(0, top_line - 5)
                end_l = min(len(lines), current_line + 5)
                for l in range(start_l, end_l):
                    prefix = "-> " if l + 1 in [top_line, current_line] else "   "
                    print(f"{prefix}{l+1}: {lines[l]}")
                return False
                
        i += 1

    if state != 0:
        states = {1: "Single line comment", 2: "Multi line comment", 3: "Single quote", 4: "Double quote", 5: "Template literal", 6: "Regex"}
        print(f"EOF reached while in state: {states.get(state)}")
        return False
        
    if stack:
        print(f"Unclosed blocks at end of file. Remaining stack size: {len(stack)}")
        for item in stack[-10:]:
            print(f"  Unclosed {item[0]} on line {item[1]}:{item[2]}")
        return False
        
    print("Code validation successful! No syntax or bracket mismatches found.")
    return True

if __name__ == "__main__":
    check_js_syntax("app.js")

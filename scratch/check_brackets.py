import sys

def check_js_brackets(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    stack = []
    in_single_quote = False
    in_double_quote = False
    in_template_lit = False
    in_line_comment = False
    in_block_comment = False
    escape = False
    
    i = 0
    n = len(content)
    line_num = 1
    col_num = 1
    
    while i < n:
        char = content[i]
        
        # Track line and column numbers
        if char == '\n':
            line_num += 1
            col_num = 1
        else:
            col_num += 1
            
        if escape:
            escape = False
            i += 1
            continue
            
        if in_line_comment:
            if char == '\n':
                in_line_comment = False
            i += 1
            continue
            
        if in_block_comment:
            if char == '*' and i + 1 < n and content[i+1] == '/':
                in_block_comment = False
                i += 2
                col_num += 1
                continue
            i += 1
            continue
            
        if in_single_quote:
            if char == '\\':
                escape = True
            elif char == '\'':
                in_single_quote = False
            i += 1
            continue
            
        if in_double_quote:
            if char == '\\':
                escape = True
            elif char == '"':
                in_double_quote = False
            i += 1
            continue
            
        if in_template_lit:
            if char == '\\':
                escape = True
            elif char == '`':
                in_template_lit = False
            i += 1
            continue
            
        # Check comments start
        if char == '/' and i + 1 < n:
            if content[i+1] == '/':
                in_line_comment = True
                i += 2
                col_num += 1
                continue
            elif content[i+1] == '*':
                in_block_comment = True
                i += 2
                col_num += 1
                continue
                
        # Check string starts
        if char == '\'':
            in_single_quote = True
            i += 1
            continue
        if char == '"':
            in_double_quote = True
            i += 1
            continue
        if char == '`':
            in_template_lit = True
            i += 1
            continue
            
        # Check brackets
        if char in ['(', '[', '{']:
            stack.append((char, line_num, col_num))
        elif char in [')', ']', '}']:
            if not stack:
                print(f"Extra closing {char} on line {line_num}:{col_num}")
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
                print(f"Mismatch: opened {top_char} on line {top_line}:{top_col} but closed with {char} on line {line_num}:{col_num}")
                # Print context
                lines = content.split('\n')
                start_l = max(0, top_line - 3)
                end_l = min(len(lines), line_num + 3)
                for l in range(start_l, end_l):
                    prefix = "-> " if l + 1 in [top_line, line_num] else "   "
                    print(f"{prefix}{l+1}: {lines[l]}")
                return False
        i += 1

    if stack:
        print(f"Unclosed blocks at end of file. Remaining stack size: {len(stack)}")
        for item in stack[-5:]:
            print(f"  Unclosed {item[0]} on line {item[1]}:{item[2]}")
        return False
        
    print("Bracket matching validation successful!")
    return True

if __name__ == "__main__":
    check_js_brackets("app.js")

import sys

def check_js_brackets(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Stack of scanner states:
    # 'code': normal code
    # 'regex': regex literal
    # 's_str': single quote string
    # 'd_str': double quote string
    # 't_lit': template literal
    # 'comment_line': // comment
    # 'comment_block': /* comment */
    state_stack = ['code']
    
    # Brackets stack: contains (char, line, col)
    brackets_stack = []
    
    # Template literal curly brace tracking stack:
    # When we enter a `${` inside 't_lit', we push the current brackets stack size or a marker.
    # Because curly braces inside `${...}` must be balanced before the closing `}` matches the template expression.
    template_expr_braces_count = []

    escape = False
    
    i = 0
    n = len(content)
    line_num = 1
    col_num = 1
    
    def is_regex_start(pos):
        j = pos - 1
        while j >= 0 and content[j].isspace():
            j -= 1
        if j < 0:
            return True
        char = content[j]
        if char in "(,=:[!&|?~+*-^/%":
            return True
        word_chars = []
        while j >= 0 and (content[j].isalnum() or content[j] == '_'):
            word_chars.append(content[j])
            j -= 1
        word = "".join(reversed(word_chars))
        if word in ["return", "throw", "typeof", "yield", "delete", "void", "replace", "match", "search"]:
            return True
        return False

    while i < n:
        char = content[i]
        
        # Track line/col of the current character
        cur_line = line_num
        cur_col = col_num
        
        if char == '\n':
            line_num += 1
            col_num = 1
        else:
            col_num += 1
            
        current_state = state_stack[-1]
        
        # Handle escape character
        if escape:
            escape = False
            i += 1
            continue
            
        # 1. State: Comment Line
        if current_state == 'comment_line':
            if char == '\n':
                state_stack.pop()
            i += 1
            continue
            
        # 2. State: Comment Block
        elif current_state == 'comment_block':
            if char == '*' and i + 1 < n and content[i+1] == '/':
                state_stack.pop()
                i += 2
                col_num += 1
                continue
            i += 1
            continue
            
        # 3. State: Single Quote String
        elif current_state == 's_str':
            if char == '\\':
                escape = True
            elif char == '\'':
                state_stack.pop()
            i += 1
            continue
            
        # 4. State: Double Quote String
        elif current_state == 'd_str':
            if char == '\\':
                escape = True
            elif char == '"':
                state_stack.pop()
            i += 1
            continue
            
        # 5. State: Template Literal (backticks)
        elif current_state == 't_lit':
            if char == '\\':
                escape = True
            elif char == '`':
                state_stack.pop()
            elif char == '$' and i + 1 < n and content[i+1] == '{':
                state_stack.append('code')
                template_expr_braces_count.append(1) # We expect balancing of this {
                # Push the opening brace onto brackets stack so it can be matched
                brackets_stack.append(('{', cur_line, cur_col))
                i += 2
                col_num += 1
                continue
            i += 1
            continue
            
        # 6. State: Regex Literal
        elif current_state == 'regex':
            # Note: inside regex, bracket character classes [^/] can contain slashes, and they don't end the regex.
            # We track if we are in a character class in a local flag or state if needed.
            # However, since regex literals are usually simple, we just handle escapes and '/'.
            # If we want to be fully robust, let's track the character class inside regex:
            # We can use a sub-state or flag. Let's make a flag stored in class.
            if char == '\\':
                escape = True
            elif char == '/':
                # check if this slash is inside a character class
                # to simplify, let's look back if there's an unclosed '[' inside the regex
                # We can check content[pos] backward to see if there is '[' not closed by ']'
                # But since regexes in our codebase are simple, if it's not inside a class, we pop.
                # Let's check:
                is_in_class = False
                k = i - 1
                while k >= 0 and content[k] != '/':
                    if content[k] == ']' and (k == 0 or content[k-1] != '\\'):
                        is_in_class = False
                        break
                    if content[k] == '[' and (k == 0 or content[k-1] != '\\'):
                        is_in_class = True
                        break
                    k -= 1
                if not is_in_class:
                    state_stack.pop()
            i += 1
            continue

        # 7. State: Normal JavaScript Code ('code')
        elif current_state == 'code':
            # Check comment starts
            if char == '/' and i + 1 < n and content[i+1] == '/':
                state_stack.append('comment_line')
                i += 2
                col_num += 1
                continue
            elif char == '/' and i + 1 < n and content[i+1] == '*':
                state_stack.append('comment_block')
                i += 2
                col_num += 1
                continue
                
            # Check string starts
            if char == '\'':
                state_stack.append('s_str')
                i += 1
                continue
            if char == '"':
                state_stack.append('d_str')
                i += 1
                continue
            if char == '`':
                state_stack.append('t_lit')
                i += 1
                continue
                
            # Check regex start
            if char == '/':
                if is_regex_start(i):
                    state_stack.append('regex')
                    i += 1
                    continue
                    
            # Check brackets
            if char in '([{':
                brackets_stack.append((char, cur_line, cur_col))
                if char == '{' and template_expr_braces_count:
                    # Increment the brace count for current template expression
                    template_expr_braces_count[-1] += 1
            elif char in ')]}':
                if not brackets_stack:
                    print(f"Extra closing {char} on line {cur_line}:{cur_col}")
                    return False
                top_char, top_line, top_col = brackets_stack.pop()
                
                mismatch = False
                if char == ')' and top_char != '(':
                    mismatch = True
                elif char == ']' and top_char != '[':
                    mismatch = True
                elif char == '}' and top_char != '{':
                    mismatch = True
                    
                if mismatch:
                    print(f"Mismatch: opened {top_char} on line {top_line}:{top_col} but closed with {char} on line {cur_line}:{cur_col}")
                    lines = content.split('\n')
                    start_l = max(0, top_line - 5)
                    end_l = min(len(lines), cur_line + 5)
                    for l in range(start_l, end_l):
                        prefix = "-> " if l + 1 in [top_line, cur_line] else "   "
                        print(f"{prefix}{l+1}: {lines[l]}")
                    return False
                
                if char == '}' and template_expr_braces_count:
                    # Decrement template brace count
                    template_expr_braces_count[-1] -= 1
                    if template_expr_braces_count[-1] == 0:
                        # Template expression completed! Pop the 'code' state to return to 't_lit'
                        template_expr_braces_count.pop()
                        state_stack.pop()
                        
            i += 1

    if len(state_stack) > 1:
        print(f"EOF reached while in states: {state_stack}")
        return False
        
    if brackets_stack:
        print(f"Unclosed blocks at end of file. Remaining stack size: {len(brackets_stack)}")
        for item in brackets_stack[-10:]:
            print(f"  Unclosed {item[0]} on line {item[1]}:{item[2]}")
        return False
        
    print("Code validation successful! No bracket mismatches found.")
    return True

if __name__ == "__main__":
    file_to_check = sys.argv[1] if len(sys.argv) > 1 else "app.js"
    check_js_brackets(file_to_check)

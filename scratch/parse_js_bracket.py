import sys

def check_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We want to find mismatched braces or brackets
    # Let's count open vs close brackets
    # Or try to parse it line by line
    stack = []
    lines = content.split('\n')
    
    for i, line in enumerate(lines):
        line_num = i + 1
        for char_idx, char in enumerate(line):
            if char in ['[', '{']:
                stack.append((char, line_num, char_idx))
            elif char in [']', '}']:
                if not stack:
                    print(f"Extra closing {char} on line {line_num}:{char_idx}")
                    return
                top_char, top_line, top_col = stack.pop()
                if (char == ']' and top_char != '[') or (char == '}' and top_char != '{'):
                    print(f"Mismatch: opened {top_char} on line {top_line} but closed with {char} on line {line_num}")
                    # print lines around it
                    print("\n".join(lines[max(0, top_line-5):min(len(lines), line_num+5)]))
                    return

    if stack:
        print(f"Unclosed blocks at end of file. Remaining stack size: {len(stack)}")
        # Print top 5 unclosed
        for item in stack[-5:]:
            print(f"  Unclosed {item[0]} on line {item[1]}")

check_file("data/week1.js")

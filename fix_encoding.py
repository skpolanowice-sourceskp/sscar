
import json

try:
    with open('dane_klima.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    with open('dane_klima.js', 'w', encoding='utf-8') as f:
        f.write('const acData = \n')
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write(';')
    
    print("Conversion successful.")
except Exception as e:
    print(f"Error: {e}")

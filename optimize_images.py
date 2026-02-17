import os
from PIL import Image
import sys

def optimize_image(input_path, output_path, max_width=1920, quality=80):
    try:
        with Image.open(input_path) as img:
            # Convert to RGB if necessary
            if img.mode in ("RGBA", "P"): 
                img = img.convert("RGB")

            # Resize if width exceeds max_width
            if img.width > max_width:
                ratio = max_width / img.width
                new_height = int(img.height * ratio)
                img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
                print(f"Resized {input_path} to {max_width}x{new_height}")

            # Save as WebP
            img.save(output_path, "WEBP", quality=quality)
            
            original_size = os.path.getsize(input_path)
            new_size = os.path.getsize(output_path)
            saving = (original_size - new_size) / original_size * 100
            
            print(f"Optimized {input_path} -> {output_path}")
            print(f"Size: {original_size/1024/1024:.2f}MB -> {new_size/1024/1024:.2f}MB ({saving:.1f}% saving)")
            return True
    except Exception as e:
        print(f"Error processing {input_path}: {e}")
        return False

files_to_process = [
    "drift-bober-przód.jpg",
    "BMW-M3-F.jpg",
    "eclipse-przód.jpg",
    "mandaryna-bok-1.jpg",
    "Gt-63-S-przód.jpg",
    "Maverick-przód.jpg"
]

base_dir = r"C:\Users\User\Documents\GitHub\sscar"
total_original = 0
total_new = 0

print("Starting image optimization...")

for filename in files_to_process:
    input_path = os.path.join(base_dir, filename)
    output_filename = os.path.splitext(filename)[0] + ".webp"
    output_path = os.path.join(base_dir, output_filename)
    
    if os.path.exists(input_path):
        total_original += os.path.getsize(input_path)
        if optimize_image(input_path, output_path):
            total_new += os.path.getsize(output_path)
    else:
        print(f"File not found: {input_path}")

if total_original > 0:
    total_saving = (total_original - total_new) / total_original * 100
    print(f"\nTotal reduction: {total_original/1024/1024:.2f}MB -> {total_new/1024/1024:.2f}MB ({total_saving:.1f}% saving)")
else:
    print("No files processed.")

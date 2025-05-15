import os
import json

base_dir = "all"
output = []

for folder_name in os.listdir(base_dir):
    folder_path = os.path.join(base_dir, folder_name)
    if not os.path.isdir(folder_path):
        continue

    text_path = os.path.join(folder_path, "content.txt")
    images_dir = os.path.join(folder_path, "images")

    if not os.path.isfile(text_path):
        continue

    with open(text_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    source_link = None
    content_lines = []
    for line in lines:
        if line.strip().startswith("Source: "):
            source_link = line.strip().replace("Source: ", "")
        else:
            content_lines.append(line.strip())

    content_clean = " ".join(content_lines)

    images = []
    if os.path.isdir(images_dir):
        for image_file in sorted(os.listdir(images_dir)):
            image_path = os.path.join(images_dir, image_file).replace("\\", "/")
            images.append(image_path)

    clean_title = folder_name.replace("%", "").replace(",", "")

    entry = {
        "title": clean_title,
        "text_path": text_path.replace("\\", "/"),
        "images": images,
        "source_link": source_link,
        "content": content_clean
    }

    output.append(entry)

with open("data.json", "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2)
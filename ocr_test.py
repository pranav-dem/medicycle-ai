
from paddleocr import PaddleOCR
from pathlib import Path

image_path = Path("ocr-tests/medicine_test.jpg")

if not image_path.exists():
    print("Medicine image not found!")
    exit()

print("Loading OCR model...")

ocr = PaddleOCR(
    lang="en",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False
)

print("Reading medicine packaging...")

result = ocr.predict(str(image_path))

print("\n========== OCR RESULTS ==========\n")

for page in result:
    data = page.json
    if callable(data):
        data = data()

    if isinstance(data, dict):
        res = data.get("res", data)
        for text in res.get("rec_texts", []):
            print(text)

print("\n========== TEST COMPLETED ==========")

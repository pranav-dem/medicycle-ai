
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from paddleocr import PaddleOCR
from PIL import Image
import tempfile
import os

app = FastAPI(title="MediCycle OCR API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Loading MediCycle OCR model...")

ocr = PaddleOCR(
    lang="en",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False
)

print("MediCycle OCR model loaded!")


@app.get("/")
def home():
    return {"message": "MediCycle OCR API is running!"}


@app.post("/scan")
async def scan_medicine(file: UploadFile = File(...)):

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Please upload an image.")

    image_bytes = await file.read()

    if not image_bytes:
        raise HTTPException(400, "The uploaded image is empty.")

    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(413, "Image must be smaller than 10 MB.")

    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=".jpg"
        ) as temp_file:
            temp_file.write(image_bytes)
            temp_path = temp_file.name

        # Resize only very large images
        with Image.open(temp_path) as img:
            img = img.convert("RGB")

            if max(img.size) > 1800:
                img.thumbnail((1800, 1800))
                img.save(temp_path, format="JPEG", quality=95)

        # Run OCR only once
        result = ocr.predict(temp_path)

        extracted_text = []

        for page in result:
            data = page.json
            if callable(data):
                data = data()

            if isinstance(data, dict):
                res = data.get("res", data)
                extracted_text.extend(res.get("rec_texts", []))

        return {
            "success": True,
            "extractedText": extracted_text
        }

    except Exception as error:
        print("OCR error:", error)
        raise HTTPException(
            500, "Unable to process this medicine image."
        )

    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

"""
Run this once on Railway to download model weights.
python download_models.py
"""
import os
import gdown

os.makedirs("models_weights", exist_ok=True)

# Paste your Google Drive file IDs here
# From share link: https://drive.google.com/file/d/FILE_ID_HERE/view
MODELS = {
    "models_weights/segmentation.pt": "https://drive.google.com/file/d/1sWprNFvq1o5Txei5RZIoftGr9Kt5OLA2/view?usp=drive_link",
    "models_weights/severity.pkl":    "https://drive.google.com/file/d/1HCRHGhianLsaV1DbaourUnpCdDiN7w6M/view?usp=drive_link",
    
}

for path, file_id in MODELS.items():
    if not os.path.exists(path):
        print(f"Downloading {path}...")
        gdown.download(
            f"https://drive.google.com/uc?id={file_id}",
            path,
            quiet=False
        )
        print(f"✅ {path} downloaded!")
    else:
        print(f"✅ {path} already exists")
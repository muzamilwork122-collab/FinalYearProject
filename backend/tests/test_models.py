import numpy as np
import torch
import pytest

from app.services.preprocessing import preprocess_image
from app.services.feature_extraction import extract_features
from app.models.segmentation import run_segmentation
from app.models.detection import run_detection
from app.models.severity import run_severity

import io
from PIL import Image


def dummy_tensor():
    return torch.zeros(1, 3, 224, 224)


def dummy_image_bytes():
    img = Image.new("RGB", (224, 224), color=(128, 64, 32))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_preprocess_output_shape():
    tensor = preprocess_image(dummy_image_bytes())
    assert tensor.shape == (1, 3, 224, 224)


def test_segmentation_returns_mask():
    mask = run_segmentation(dummy_tensor())
    assert isinstance(mask, np.ndarray)
    assert mask.ndim == 2


def test_detection_returns_list():
    detections = run_detection(dummy_tensor())
    assert isinstance(detections, list)


def test_severity_returns_tuple():
    features = extract_features(np.zeros((224, 224)), [])
    label, conf = run_severity(features)
    assert label in ("low", "medium", "high")
    assert 0.0 <= conf <= 1.0


def test_feature_extraction_vector_length():
    mask = np.zeros((224, 224))
    detections = [{"confidence": 0.8, "label": "crack", "bbox": [0, 0, 0.1, 0.1]}]
    features = extract_features(mask, detections)
    assert features.shape == (5,)

"""
Test: Preprocessing Pipeline
==============================
Tests preprocess_image(), auto_crop_screen(), reduce_glare()
Place at: backend/tests/test_preprocessing.py

Run: pytest tests/test_preprocessing.py -v
"""

import io
import numpy as np
import pytest
import torch
from PIL import Image
from app.services.preprocessing import (
    preprocess_image,
    auto_crop_screen,
    reduce_glare,
    center_crop,
)


def make_image_bytes(w=400, h=800, color=(40,40,40)) -> bytes:
    img = Image.new("RGB", (w, h), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf.read()


class TestPreprocessImage:

    def test_returns_torch_tensor(self):
        """preprocess_image must return a torch.Tensor."""
        img_bytes = make_image_bytes()
        result    = preprocess_image(img_bytes)
        assert isinstance(result, torch.Tensor)

    def test_output_shape_correct(self):
        """Output tensor shape must be (1, 3, 224, 224)."""
        img_bytes = make_image_bytes()
        tensor    = preprocess_image(img_bytes)
        assert tensor.shape == (1, 3, 224, 224)

    def test_output_dtype_float(self):
        """Tensor must be float type."""
        img_bytes = make_image_bytes()
        tensor    = preprocess_image(img_bytes)
        assert tensor.dtype == torch.float32

    def test_different_input_sizes_same_output(self):
        """Regardless of input size, output must be (1,3,224,224)."""
        for w, h in [(200,400), (640,1280), (1080,1920)]:
            img_bytes = make_image_bytes(w, h)
            tensor    = preprocess_image(img_bytes)
            assert tensor.shape == (1, 3, 224, 224)

    def test_normalized_values_in_reasonable_range(self):
        """Normalized values should be roughly -3 to +3 (ImageNet norm)."""
        img_bytes = make_image_bytes()
        tensor    = preprocess_image(img_bytes)
        assert tensor.min().item() > -5.0
        assert tensor.max().item() <  5.0

    def test_landscape_image_processed(self):
        """Landscape image should also be processed correctly."""
        img_bytes = make_image_bytes(800, 400)
        tensor    = preprocess_image(img_bytes)
        assert tensor.shape == (1, 3, 224, 224)

    def test_rgb_channels_present(self):
        """Output must have exactly 3 channels (RGB)."""
        img_bytes = make_image_bytes()
        tensor    = preprocess_image(img_bytes)
        assert tensor.shape[1] == 3


class TestAutoCropScreen:

    def test_returns_numpy_array(self):
        """auto_crop_screen must return a numpy array."""
        img    = np.zeros((800, 400, 3), dtype=np.uint8)
        result = auto_crop_screen(img)
        assert isinstance(result, np.ndarray)

    def test_output_has_3_channels(self):
        """Output must have 3 color channels."""
        img    = np.zeros((800, 400, 3), dtype=np.uint8)
        result = auto_crop_screen(img)
        assert result.shape[2] == 3

    def test_does_not_crash_on_black_image(self):
        """Should not crash on completely black image."""
        img    = np.zeros((800, 400, 3), dtype=np.uint8)
        result = auto_crop_screen(img)
        assert result is not None

    def test_does_not_crash_on_white_image(self):
        """Should not crash on completely white image."""
        img    = np.full((800, 400, 3), 255, dtype=np.uint8)
        result = auto_crop_screen(img)
        assert result is not None

    def test_output_not_empty(self):
        """Output must have non-zero dimensions."""
        img    = np.zeros((800, 400, 3), dtype=np.uint8)
        result = auto_crop_screen(img)
        assert result.shape[0] > 0
        assert result.shape[1] > 0


class TestReduceGlare:

    def test_returns_same_shape(self):
        """Output must have same shape as input."""
        img    = np.zeros((224, 224, 3), dtype=np.uint8)
        result = reduce_glare(img)
        assert result.shape == img.shape

    def test_returns_numpy_array(self):
        """Must return numpy array."""
        img    = np.zeros((224, 224, 3), dtype=np.uint8)
        result = reduce_glare(img)
        assert isinstance(result, np.ndarray)

    def test_pixel_values_in_valid_range(self):
        """Pixel values must be 0-255."""
        img    = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)
        result = reduce_glare(img)
        assert result.min() >= 0
        assert result.max() <= 255

    def test_does_not_crash_on_black_image(self):
        """Should not crash on black image."""
        img    = np.zeros((224, 224, 3), dtype=np.uint8)
        result = reduce_glare(img)
        assert result is not None


class TestCenterCrop:

    def test_reduces_image_size(self):
        """Center crop should produce smaller image."""
        img    = np.zeros((800, 400, 3), dtype=np.uint8)
        result = center_crop(img, margin=0.12)
        assert result.shape[0] < 800
        assert result.shape[1] < 400

    def test_returns_numpy_array(self):
        """Must return numpy array."""
        img    = np.zeros((800, 400, 3), dtype=np.uint8)
        result = center_crop(img)
        assert isinstance(result, np.ndarray)

    def test_zero_margin_returns_same_size(self):
        """Zero margin should return same size image."""
        img    = np.zeros((800, 400, 3), dtype=np.uint8)
        result = center_crop(img, margin=0.0)
        assert result.shape == img.shape

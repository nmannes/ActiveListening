"""
clip.py — CLIP-based frame classifier for detecting basketball broadcasts.

Uses OpenAI's CLIP (via open_clip) to zero-shot classify TV frames as
basketball broadcast vs. non-basketball content.
"""

import io
import logging
import time

from PIL import Image
import torch
import open_clip

logger = logging.getLogger("clip_classifier")

# Text prompts for zero-shot classification
POSITIVE_PROMPTS = [
    "a live basketball game on television",
    "an NBA basketball broadcast",
    "a college basketball game being played on a court",
    "basketball players on a court during a live game",
]

NEGATIVE_PROMPTS = [
    "a TV commercial or advertisement",
    "a news anchor at a desk",
    "a halftime show or studio analysis",
    "a scoreboard or statistics graphic",
    "a non-sports television program",
]


class FrameClassifier:
    """Zero-shot CLIP classifier for basketball broadcast detection."""

    def __init__(self, device: str = "cpu", threshold: float = 0.55):
        """
        Args:
            device: 'cpu' or 'cuda'
            threshold: probability threshold above which we classify as basketball
        """
        self.device = device
        self.threshold = threshold

        logger.info(f"Loading CLIP model (ViT-B-32) on {device}...")
        self.model, _, self.preprocess = open_clip.create_model_and_transforms(
            "ViT-B-32", pretrained="laion2b_s34b_b79k", device=device
        )
        self.tokenizer = open_clip.get_tokenizer("ViT-B-32")
        self.model.eval()

        # Pre-encode text prompts
        all_prompts = POSITIVE_PROMPTS + NEGATIVE_PROMPTS
        with torch.no_grad():
            text_tokens = self.tokenizer(all_prompts).to(device)
            self.text_features = self.model.encode_text(text_tokens)
            self.text_features /= self.text_features.norm(dim=-1, keepdim=True)

        self.n_positive = len(POSITIVE_PROMPTS)
        logger.info("CLIP model loaded and text prompts encoded.")

    def classify(self, frame_bytes: bytes) -> dict:
        """
        Classify a JPEG frame.

        Args:
            frame_bytes: raw JPEG bytes

        Returns:
            dict with keys:
                - is_basketball (bool): True if classified as basketball broadcast
                - confidence (float): probability score (0-1)
                - elapsed_ms (int): inference time in milliseconds
        """
        t0 = time.time()

        image = Image.open(io.BytesIO(frame_bytes)).convert("RGB")
        image_tensor = self.preprocess(image).unsqueeze(0).to(self.device)

        with torch.no_grad():
            image_features = self.model.encode_image(image_tensor)
            image_features /= image_features.norm(dim=-1, keepdim=True)

            # Cosine similarity with all prompts
            similarities = (image_features @ self.text_features.T).squeeze(0)

            # Average similarity for positive vs negative prompt groups
            pos_score = similarities[: self.n_positive].mean().item()
            neg_score = similarities[self.n_positive :].mean().item()

            # Softmax over [positive, negative] to get probability
            scores = torch.tensor([pos_score, neg_score])
            probs = torch.softmax(scores * 100, dim=0)  # temperature-scaled
            basketball_prob = probs[0].item()

        elapsed_ms = int((time.time() - t0) * 1000)

        is_basketball = basketball_prob >= self.threshold

        return {
            "is_basketball": is_basketball,
            "confidence": round(basketball_prob, 4),
            "elapsed_ms": elapsed_ms,
        }

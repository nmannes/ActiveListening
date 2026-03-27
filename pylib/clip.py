"""
clip.py — CLIP-based frame classifier for detecting desired broadcast content.

Uses OpenAI's CLIP (via open_clip) to zero-shot classify TV frames as
desired content vs. non-desired content. Supports multiple content profiles
(e.g. basketball, white house press briefing).
"""

import io
import logging
import time

from PIL import Image
import torch
import open_clip

logger = logging.getLogger("remote_server")

# ── Content profiles ─────────────────────────────────────────────────

CONTENT_PROFILES = {
    "basketball": {
        "positive": [
            "a live basketball game on television",
            "an NBA basketball broadcast",
            "a college basketball game being played on a court",
            "basketball players on a court during a live game",
        ],
        "negative": [
            "a TV commercial or advertisement",
            "a news anchor at a desk",
            "a halftime show or studio analysis",
            "a scoreboard or statistics graphic",
            "a non-sports television program",
        ],
    },
    "white_house_briefing": {
        "positive": [
            "a person speaking at a podium during a White House press briefing",
            "a White House press secretary at the lectern addressing reporters",
            "a government official standing at a podium with the White House logo",
            "a speaker at a White House press conference behind a lectern",
        ],
        "negative": [
            "a TV commercial or advertisement",
            "a news anchor at a desk in a studio",
            "reporters sitting in an audience without a speaker at the podium",
            "reporters taking pictures or asking questions from their seats",
            "a wide shot of journalists sitting in the White House briefing room",
            "an audience of news correspondents looking at the camera",
            "an empty podium or lectern with no speaker",
            "a non-news television program",
        ],
    },
    "baseball": {
        "positive": [
            "a live baseball game on television",
            "a baseball broadcast showing the field",
            "a baseball pitcher throwing a pitch during a live game",
            "baseball players on a diamond during a live game",
            "a batter at home plate during a baseball broadcast",
        ],
        "negative": [
            "a TV commercial or advertisement",
            "a news anchor at a desk",
            "a halftime show or studio analysis",
            "a scoreboard or statistics graphic",
            "a non-sports television program",
            "a baseball highlight reel or replay montage",
        ],
    },
    "survivor": {
        "positive": [
            "contestants on the TV show Survivor competing in a challenge",
            "a tribal council scene from the TV show Survivor with torches",
            "Survivor contestants sitting at tribal council with the host",
            "castaways on a beach or island on the TV show Survivor",
            "a Survivor immunity or reward challenge on an obstacle course",
        ],
        "negative": [
            "a TV commercial or advertisement",
            "a news anchor at a desk",
            "a talk show or late night television program",
            "a preview or recap montage of upcoming episodes",
            "a non-Survivor television program",
            "a behind-the-scenes or interview confessional segment",
        ],
    },
}

DEFAULT_PROFILE = "basketball"


class FrameClassifier:
    """Zero-shot CLIP classifier for detecting desired broadcast content."""

    def __init__(
        self,
        device: str = "cpu",
        threshold: float = 0.55,
        content_profile: str = DEFAULT_PROFILE,
    ):
        """
        Args:
            device: 'cpu' or 'cuda'
            threshold: probability threshold above which we classify as desired content
            content_profile: key into CONTENT_PROFILES (default: 'basketball')
        """
        if content_profile not in CONTENT_PROFILES:
            raise ValueError(
                f"Unknown content profile '{content_profile}'. "
                f"Available: {list(CONTENT_PROFILES.keys())}"
            )

        self.device = device
        self.threshold = threshold
        self.content_profile = content_profile

        profile = CONTENT_PROFILES[content_profile]
        self.positive_prompts = profile["positive"]
        self.negative_prompts = profile["negative"]

        logger.info(f"Loading CLIP model (ViT-B-32) on {device}...")
        self.model, _, self.preprocess = open_clip.create_model_and_transforms(
            "ViT-B-32", pretrained="laion2b_s34b_b79k", device=device
        )
        self.tokenizer = open_clip.get_tokenizer("ViT-B-32")
        self.model.eval()

        # Pre-encode text prompts
        all_prompts = self.positive_prompts + self.negative_prompts
        with torch.no_grad():
            text_tokens = self.tokenizer(all_prompts).to(device)
            self.text_features = self.model.encode_text(text_tokens)
            self.text_features /= self.text_features.norm(dim=-1, keepdim=True)

        self.n_positive = len(self.positive_prompts)
        logger.info(
            f"CLIP model loaded — profile='{content_profile}', "
            f"{self.n_positive} positive / {len(self.negative_prompts)} negative prompts."
        )

    def classify(self, frame_bytes: bytes) -> dict:
        """
        Classify a JPEG frame.

        Args:
            frame_bytes: raw JPEG bytes

        Returns:
            dict with keys:
                - is_desired_content_visible (bool): True if classified as desired content
                - confidence (float): probability score (0-1)
                - elapsed_ms (int): inference time in milliseconds
                - content_profile (str): which profile was used
        """
        t0 = time.time()

        image = Image.open(io.BytesIO(frame_bytes)).convert("RGB")
        image_tensor = self.preprocess(image).unsqueeze(0).to(self.device)

        with torch.no_grad():
            image_features = self.model.encode_image(image_tensor)
            image_features /= image_features.norm(dim=-1, keepdim=True)

            # Cosine similarity with all prompts
            similarities = (image_features @ self.text_features.T).squeeze(0)

            # Max similarity for positive vs negative prompt groups (better for zero-shot)
            pos_score = similarities[: self.n_positive].max(-1).values.item()
            neg_score = similarities[self.n_positive :].max(-1).values.item()

            # Softmax over [positive, negative] to get probability
            scores = torch.tensor([pos_score, neg_score])
            probs = torch.softmax(scores * 100, dim=0)  # temperature-scaled
            content_prob = probs[0].item()

        elapsed_ms = int((time.time() - t0) * 1000)

        is_desired_content_visible = content_prob >= self.threshold

        return {
            "is_desired_content_visible": is_desired_content_visible,
            "confidence": round(content_prob, 4),
            "elapsed_ms": elapsed_ms,
            "content_profile": self.content_profile,
        }

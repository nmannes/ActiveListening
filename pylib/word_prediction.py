"""
word_prediction.py — Predict the probability that target words will be spoken.

"What is better than reacting to words being said is predicting
 that a word will or will not be said in the future."

Instead of only detecting keywords AFTER they're spoken (keyword_matching.py),
this module uses live transcript context to forecast the probability that
each target word/phrase will be spoken within a configurable horizon.

Architecture:
  Transcript tokens → TranscriptBuffer → NgramPredictor (baseline)
                                       → LLMPredictor (semantic, via Bedrock)
                                       → WordPredictor (orchestrator)
                                            ↓
                                   probability emissions

Usage:
  predictor = WordPredictor(
      target_words=["touchdown", "interception"],
      horizon_sec=60,
      llm_enabled=True,
  )
  predictor.on_prediction(lambda probs: print(probs))
  predictor.start()
  # feed tokens as they arrive
  predictor.push_tokens([{"text": "third", "start": 0.5}, ...], speaker_id="0")
"""

import asyncio
import json
import logging
import os
import time
import re
from collections import defaultdict
from typing import Optional, Callable, Dict, List, Any

try:
    import boto3
except ImportError:
    boto3 = None

logger = logging.getLogger("remote_server")


# ── Transcript Buffer ───────────────────────────────────────────────────
# Sliding window of recent utterances with speaker attribution

class TranscriptBuffer:
    def __init__(self, max_window_sec: float = 120.0):
        self.max_window_sec = max_window_sec
        self.utterances: List[dict] = []  # [{text, speaker, ts}]
        self._text_cache: str = ""
        self._text_dirty: bool = True

    def push(self, text: str, speaker: str = "?", ts: float = None):
        if ts is None:
            ts = time.time()
        self.utterances.append({"text": text, "speaker": speaker, "ts": ts})
        self._prune()
        self._text_dirty = True

    def push_tokens(self, tokens: List[dict], speaker_id: str = "0"):
        """Push formatted tokens from Deepgram (same format as TradeProcessor receives)."""
        text = " ".join(t.get("text", "").strip() for t in tokens if t.get("text", "").strip())
        if not text:
            return
        start_val = tokens[0].get("start") if tokens else None
        ts = start_val if start_val is not None else time.time()
        self.push(text, speaker=str(speaker_id), ts=ts)

    def _prune(self):
        cutoff = time.time() - self.max_window_sec
        while self.utterances and self.utterances[0]["ts"] < cutoff:
            self.utterances.pop(0)
        if len(self.utterances) > 300:
            self.utterances = self.utterances[-300:]

    def get_text(self) -> str:
        """Return formatted transcript with speaker labels (for LLM context)."""
        if self._text_dirty or not self._text_cache:
            self._text_cache = "\n".join(
                f"[{u['speaker']}] {u['text']}" for u in self.utterances
            )
            self._text_dirty = False
        return self._text_cache

    def get_raw_text(self) -> str:
        """Return raw transcript without speaker labels (for n-gram models)."""
        return " ".join(u["text"] for u in self.utterances)

    def get_recent(self, duration_sec: float = 30.0) -> List[dict]:
        cutoff = time.time() - duration_sec
        return [u for u in self.utterances if u["ts"] >= cutoff]

    def get_token_stream(self) -> List[str]:
        """Return flat list of lowercased word tokens for n-gram modeling."""
        tokens = []
        for u in self.utterances:
            tokens.extend(u["text"].lower().split())
        return tokens

    @property
    def length(self) -> int:
        return len(self.utterances)

    def clear(self):
        self.utterances.clear()
        self._text_cache = ""
        self._text_dirty = True


# ── N-gram Statistical Predictor ────────────────────────────────────────
# Learns word→context associations from historical transcripts for baseline
# probability estimates when LLM is unavailable or as a fallback.

class NgramPredictor:
    def __init__(self, n: int = 3):
        self.n = n
        # word → { "base_rate": float, "contexts": {ngram_context: count} }
        self.word_stats: Dict[str, dict] = {}
        self.total_intervals = 0

    @staticmethod
    def _last_word(phrase: str) -> str:
        """Return the last word of a phrase for n-gram anchor lookup."""
        return phrase.lower().split()[-1]

    def set_target_words(self, words: List[str]):
        for w in words:
            lower = w.lower()
            if lower not in self.word_stats:
                self.word_stats[lower] = {
                    "base_count": 0,
                    "intervals": 0,
                    "contexts": defaultdict(int),
                }

    def train(self, sessions: List[dict], interval_sec: float = 30.0):
        """Train on historical transcript sessions.

        Args:
            sessions: [{"utterances": [{"text": str, "speaker": str, "ts": float}]}]
            interval_sec: Bucket size for base rate calculation
        """
        for session in sessions:
            utterances = session.get("utterances", session if isinstance(session, list) else [])
            if not utterances:
                continue

            start = utterances[0].get("ts", 0) if isinstance(utterances[0], dict) else 0
            end = utterances[-1].get("ts", 0) if isinstance(utterances[-1], dict) else 0
            if end <= start:
                continue

            intervals = max(1, int((end - start) / interval_sec))
            self.total_intervals += intervals

            # Collect all tokens in order for n-gram context building.
            # For multi-word target phrases, we replace them in the token stream
            # so "field goal" becomes a single token for n-gram purposes.
            all_text = " ".join(
                (u.get("text", u) if isinstance(u, dict) else str(u))
                for u in utterances
            ).lower()

            # Build token stream with multi-word phrases collapsed
            all_tokens = self._tokenize_with_phrases(all_text)

            # Count tracked words/phrases per utterance for base rate
            tracked_hits = defaultdict(int)
            for u in utterances:
                text = (u.get("text", u) if isinstance(u, dict) else str(u)).lower()
                for w in self.word_stats:
                    if w in text:
                        tracked_hits[w] += 1

            for w in self.word_stats:
                self.word_stats[w]["base_count"] += tracked_hits.get(w, 0)
                self.word_stats[w]["intervals"] += intervals

            # Build n-gram context associations using the last word of each
            # target phrase as the anchor token in the token stream
            for i in range(self.n, len(all_tokens)):
                anchor = all_tokens[i]
                # Find which target phrase(s) this anchor matches
                matching_phrases = [
                    phrase for phrase in self.word_stats
                    if self._last_word(phrase) == anchor
                ]
                if not matching_phrases:
                    continue
                ctx = " ".join(all_tokens[i - self.n : i])
                for phrase in matching_phrases:
                    self.word_stats[phrase]["contexts"][ctx] += 1

    def _tokenize_with_phrases(self, text: str) -> List[str]:
        """Tokenize text, collapsing multi-word target phrases into single tokens.

        E.g., "the field goal is good" with target "field goal" →
              ["the", "field_goal", "is", "good"]
        """
        # Sort phrases by length (longest first) to avoid partial matches
        phrases = sorted(self.word_stats.keys(), key=len, reverse=True)
        # Replace each phrase with a tokenized version
        for phrase in phrases:
            # Use a placeholder that won't appear in normal text
            placeholder = f"__PHRASE_{phrase.replace(' ', '_')}__"
            text = text.replace(phrase, placeholder)
        return text.split()

    def predict(self, transcript: str, target_words: List[str]) -> Dict[str, float]:
        """Return probability estimates for each target word."""
        # Build current context n-gram from the end of the transcript
        all_text = transcript.lower()
        # Collapse multi-word phrases so the n-gram context is consistent with training
        tokens = self._tokenize_with_phrases(all_text) if self.word_stats else all_text.split()
        current_ctx = " ".join(tokens[-self.n:]) if len(tokens) >= self.n else ""

        result = {}
        for word in target_words:
            lower = word.lower()
            stats = self.word_stats.get(lower)

            # Base rate via Poisson: P(at least 1 occurrence) = 1 - e^(-λ)
            base_prob = 0.01
            if stats and stats["intervals"] > 0:
                lam = stats["base_count"] / max(1, stats["intervals"])
                base_prob = 1 - pow(2.71828, -lam)

            # Contextual boost: if current n-gram often precedes this word
            boost = 1.0
            if stats and current_ctx and stats["contexts"]:
                ctx_count = stats["contexts"].get(current_ctx, 0)
                total_ctx = sum(stats["contexts"].values())
                if total_ctx > 0 and ctx_count > 0:
                    ctx_prob = ctx_count / total_ctx
                    boost = 1.0 + ctx_prob * 10.0

            result[word] = min(0.99, base_prob * boost)

        return result

    def to_dict(self) -> dict:
        return {
            "n": self.n,
            "word_stats": {
                w: {
                    "base_count": s["base_count"],
                    "intervals": s["intervals"],
                    "contexts": dict(s["contexts"]),
                }
                for w, s in self.word_stats.items()
            },
            "total_intervals": self.total_intervals,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "NgramPredictor":
        model = cls(n=data.get("n", 3))
        for w, s in data.get("word_stats", {}).items():
            model.word_stats[w] = {
                "base_count": s["base_count"],
                "intervals": s["intervals"],
                "contexts": defaultdict(int, s.get("contexts", {})),
            }
        model.total_intervals = data.get("total_intervals", 0)
        return model


# ── LLM Predictor (Bedrock) ─────────────────────────────────────────────
# Uses the same Bedrock pattern as speaker_recognition.py for semantic
# context understanding — can assess topic direction, conversational cues,
# and implied word likelihood that n-gram models miss.

class LLMPredictor:
    def __init__(
        self,
        region_name: str = "us-east-1",
        model_id: str = "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    ):
        self.region_name = region_name
        self.model_id = model_id
        self._bedrock = None
        self._pending = None
        self._last_result: Optional[dict] = None
        self._last_result_time: float = 0
        self._cache_sec: float = 2.0

    @property
    def bedrock(self):
        if self._bedrock is None:
            if boto3 is None:
                logger.error("boto3 not installed — LLM predictor unavailable")
                return None
            try:
                self._bedrock = boto3.client(
                    "bedrock-runtime", region_name=self.region_name
                )
            except Exception as e:
                logger.error(f"Failed to init Bedrock client: {e}")
        return self._bedrock

    async def predict(
        self, context: str, target_words: List[str], horizon_sec: int = 60
    ) -> Optional[Dict[str, float]]:
        """Use LLM to assess semantic context and predict word probabilities."""
        if not context or not target_words:
            return None

        # Cache: reuse result if context hasn't changed substantially
        cache_key = context[-200:] + ",".join(target_words)
        now = time.time()
        if self._last_result and (now - self._last_result_time) < self._cache_sec:
            return self._last_result

        # Deduplicate concurrent calls
        if self._pending:
            return await self._pending

        word_list = ", ".join(f'"{w}"' for w in target_words)
        prompt = f"""Analyze this live transcript and predict the likelihood each target word will be spoken within {horizon_sec}s.

Transcript:
{context[-3000:]}

Words: {word_list}

Consider: current topic, conversational direction, speaker roles, and the natural flow of discussion. A word is more likely if the conversation is building toward it.

Return ONLY a JSON object: {{"word": 0.XX, ...}}
Probabilities (0.0 to 1.0):"""

        self._pending = self._call_bedrock(prompt)
        try:
            result = await self._pending
            if result:
                self._last_result = result
                self._last_result_time = time.time()
            return result
        finally:
            self._pending = None

    async def _call_bedrock(self, prompt: str) -> Optional[Dict[str, float]]:
        client = self.bedrock
        if client is None:
            return None

        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 256,
            "messages": [{"role": "user", "content": prompt}],
        })

        try:
            loop = asyncio.get_running_loop()
            response = await loop.run_in_executor(
                None,
                lambda: client.invoke_model(
                    modelId=self.model_id,
                    contentType="application/json",
                    accept="application/json",
                    body=body,
                ),
            )
            result = json.loads(response["body"].read())
            text = result.get("content", [{}])[0].get("text", "")
            m = re.search(r"\{[\s\S]*\}", text)
            if m:
                parsed = json.loads(m.group(0))
                # Ensure values are floats and keys match target words
                return {
                    k: float(v) for k, v in parsed.items()
                    if isinstance(v, (int, float))
                }
        except Exception as e:
            logger.warning(f"LLM prediction call failed: {e}")

        return None


# ── Word Predictor ──────────────────────────────────────────────────────
# Main orchestrator — ties buffer, n-gram model, and LLM together.
# Designed to be owned by a ClientSession, receiving the same token stream
# as TradeProcessor.

class WordPredictor:
    def __init__(
        self,
        target_words: List[str] = None,
        horizon_sec: float = 60.0,
        context_window_sec: float = 120.0,
        update_interval_sec: float = 5.0,
        min_context_utterances: int = 3,
        llm_enabled: bool = False,
        llm_model_id: str = "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    ):
        self.target_words = target_words or []
        self.horizon_sec = horizon_sec
        self.update_interval_sec = update_interval_sec
        self.min_context_utterances = min_context_utterances

        # Components
        self.buffer = TranscriptBuffer(max_window_sec=context_window_sec)
        self.ngram = NgramPredictor(n=3)
        self.ngram.set_target_words(self.target_words)

        self.llm: Optional[LLMPredictor] = None
        if llm_enabled:
            self.llm = LLMPredictor(model_id=llm_model_id)

        # State
        self.predictions: Dict[str, dict] = {}
        self.history: List[dict] = []
        self._prediction_callbacks: List[Callable] = []
        self._word_spoken_callbacks: List[Callable] = []
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._last_update: float = 0
        self._seq: int = 0

        # Init predictions flat
        for w in self.target_words:
            self.predictions[w] = {
                "probability": 0.01,
                "confidence": "low",
                "trend": "—",
                "delta": 0.0,
            }

    # ── Public API ──────────────────────────────────────────────────────

    def set_target_words(self, words: List[str]):
        self.target_words = words
        self.ngram.set_target_words(words)
        for w in words:
            if w not in self.predictions:
                self.predictions[w] = {
                    "probability": 0.01,
                    "confidence": "low",
                    "trend": "—",
                    "delta": 0.0,
                }
        for w in list(self.predictions.keys()):
            if w not in words:
                del self.predictions[w]

    def push_tokens(self, tokens: List[dict], speaker_id: str = "0"):
        """Feed Deepgram tokens into the predictor. Same signature as TradeProcessor.process_tokens.

        Called for both interim and final results to get the earliest possible signal.
        """
        self.buffer.push_tokens(tokens, speaker_id)

        # Check for hits (ground truth: word was actually spoken)
        text = " ".join(
            t.get("text", "").strip().lower()
            for t in tokens
            if t.get("text", "").strip()
        )
        for word in self.target_words:
            if word.lower() in text:
                self._on_word_spoken(word)
                if word in self.predictions:
                    self.predictions[word] = {
                        "probability": 0.05,
                        "confidence": "high",
                        "trend": "↓",
                        "delta": 0.0,
                    }

        # Trigger async prediction check
        if self._running:
            now = time.time()
            if now - self._last_update >= self.update_interval_sec:
                asyncio.create_task(self._run_prediction())

    def on_prediction(self, callback: Callable[[dict], None]):
        """Register callback for prediction updates. Called with full prediction dict."""
        self._prediction_callbacks.append(callback)

    def on_word_spoken(self, callback: Callable[[str, dict], None]):
        """Register callback for when a tracked word is actually spoken."""
        self._word_spoken_callbacks.append(callback)

    async def start(self):
        """Begin periodic prediction updates. Runs an immediate first prediction."""
        if self._running:
            return
        self._running = True
        # Immediate first prediction
        if self.buffer.length >= self.min_context_utterances:
            await self._run_prediction()
        self._task = asyncio.create_task(self._prediction_loop())
        logger.info(
            f"WordPredictor started — {len(self.target_words)} target words, "
            f"horizon={self.horizon_sec}s, llm={self.llm is not None}"
        )

    async def stop(self):
        """Stop prediction updates."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    def get_predictions(self) -> Dict[str, dict]:
        """Return current predictions with metadata."""
        return {w: dict(p) for w, p in self.predictions.items()}

    def get_probability(self, word: str) -> Optional[float]:
        """Get current probability for a specific word."""
        p = self.predictions.get(word)
        return p["probability"] if p else None

    def get_history(self) -> List[dict]:
        return list(self.history)

    def get_top_words(self, n: int = 5, min_prob: float = 0.0) -> List[tuple]:
        """Return (word, probability) sorted highest-first."""
        sorted_words = sorted(
            self.predictions.items(),
            key=lambda x: x[1]["probability"],
            reverse=True,
        )
        return [
            (w, p["probability"])
            for w, p in sorted_words
            if p["probability"] >= min_prob
        ][:n]

    def train(self, sessions: List[dict]):
        """Train the n-gram baseline on historical sessions.

        Args:
            sessions: [{"utterances": [{"text": str, "speaker": str, "ts": float}]}]
        """
        self.ngram.train(sessions)

    def save_model(self) -> dict:
        return {
            "ngram": self.ngram.to_dict(),
            "target_words": self.target_words,
        }

    def load_model(self, data: dict):
        self.ngram = NgramPredictor.from_dict(data.get("ngram", {}))
        self.set_target_words(data.get("target_words", []))

    # ── Internal ────────────────────────────────────────────────────────

    def _on_word_spoken(self, word: str):
        for cb in self._word_spoken_callbacks:
            try:
                cb(word, {"ts": time.time()})
            except Exception as e:
                logger.error(f"Word prediction callback error: {e}")

    async def _prediction_loop(self):
        """Periodic background prediction loop."""
        while self._running:
            try:
                await asyncio.sleep(self.update_interval_sec)
                if self.buffer.length >= self.min_context_utterances:
                    await self._run_prediction()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Prediction loop error: {e}")

    async def _run_prediction(self):
        self._seq += 1
        seq = self._seq
        recent = self.buffer.get_recent(self.horizon_sec)

        if len(recent) < self.min_context_utterances and self.history:
            return

        new_probs = None
        source = "baseline"

        # Try LLM first (uses formatted context with speaker labels)
        if self.llm and len(recent) >= self.min_context_utterances:
            llm_context = self.buffer.get_text()
            llm_result = await self.llm.predict(
                llm_context, self.target_words, int(self.horizon_sec)
            )
            if llm_result and len(llm_result) > 0:
                new_probs = llm_result
                source = "llm"

        # Fall back to n-gram (uses raw text without speaker labels)
        if not new_probs:
            raw_text = self.buffer.get_raw_text()
            new_probs = self.ngram.predict(raw_text, self.target_words)

        # Stale check — another prediction may have already run
        if seq != self._seq:
            return

        # Merge with trend detection
        for word, prob in new_probs.items():
            if word not in self.predictions:
                continue
            prev_prob = self.predictions[word]["probability"]
            delta = prob - prev_prob
            trend = "↑" if delta > 0.05 else ("↓" if delta < -0.05 else "—")
            confidence = "medium" if source == "llm" else "low"

            self.predictions[word] = {
                "probability": round(prob, 4),
                "confidence": confidence,
                "trend": trend,
                "delta": round(delta, 4),
            }

        self._last_update = time.time()
        record = {
            "ts": self._last_update,
            "predictions": self.get_predictions(),
            "source": source,
            "context_length": len(recent),
        }
        self.history.append(record)

        if len(self.history) > 2000:
            self.history = self.history[-1000:]

        # Emit to callbacks
        for cb in self._prediction_callbacks:
            try:
                cb(record)
            except Exception as e:
                logger.error(f"Prediction callback error: {e}")


# ── Scoring utilities ───────────────────────────────────────────────────
# Evaluate prediction calibration: did high-probability predictions
# correspond to actual word occurrences?

def score_predictions(
    history: List[dict],
    spoken_words: List[dict],
    horizon_sec: float = 60.0,
) -> Dict[str, dict]:
    """Score prediction accuracy against ground truth.

    Args:
        history: Prediction records [{"ts": float, "predictions": {word: {probability: float}}}]
        spoken_words: Ground truth [{"word": str, "ts": float}]
        horizon_sec: Prediction horizon that was used

    Returns:
        {word: {base_rate, avg_predicted, calibration_bias, by_decile: [...]}}
    """
    results = {}

    for pred in history:
        horizon_end = pred["ts"] + horizon_sec

        for word, p in pred.get("predictions", {}).items():
            prob = p["probability"] if isinstance(p, dict) else p

            if word not in results:
                results[word] = {
                    "total": 0,
                    "hits": 0,
                    "high_prob_total": 0,
                    "high_prob_hits": 0,
                    "prob_sum": 0.0,
                    "by_decile": [{"total": 0, "hits": 0} for _ in range(10)],
                }

            r = results[word]
            r["total"] += 1
            r["prob_sum"] += prob

            was_spoken = any(
                sw["word"] == word and sw["ts"] >= pred["ts"] and sw["ts"] <= horizon_end
                for sw in spoken_words
            )
            if was_spoken:
                r["hits"] += 1

            if prob > 0.5:
                r["high_prob_total"] += 1
                if was_spoken:
                    r["high_prob_hits"] += 1

            decile = min(9, int(prob * 10))
            r["by_decile"][decile]["total"] += 1
            if was_spoken:
                r["by_decile"][decile]["hits"] += 1

    for word, r in results.items():
        r["base_rate"] = r["hits"] / max(1, r["total"])
        r["avg_predicted"] = r["prob_sum"] / max(1, r["total"])
        r["high_prob_precision"] = (
            r["high_prob_hits"] / max(1, r["high_prob_total"])
            if r["high_prob_total"] > 0
            else None
        )
        r["calibration_bias"] = r["avg_predicted"] - r["base_rate"]
        # positive = over-predicted, negative = under-predicted

    return results

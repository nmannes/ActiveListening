"""Tests for the live speaker-ask flow (pylib/speaker_ask.py) and the shared
helpers it builds on: the ws framing classifier, the ask callback codec, and
the sample-review batch caps.

Heavy deps (torch/nemo/ffmpeg/boto3) are avoided: embeddings are numpy arrays,
``_cosine`` is replaced with a numpy implementation, ffmpeg-backed helpers are
patched, and torch is stubbed where it would be imported lazily.
"""

import asyncio
import io
import json
import sys
import types
import unittest
import wave
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np

from pylib.ask_callbacks import (
    MAX_CALLBACK_BYTES,
    MAX_SLUG_LEN,
    CallbackTooLong,
    build_ask_keyboard,
    parse_ask_callback,
)
from pylib.sample_review import (
    MAX_REVIEW_PER_BATCH,
    MAX_REVIEW_PER_VIDEO,
    select_persist_subset,
    select_review_subset,
)
from pylib.ws_framing import classify_binary, parse_gif_message

import pylib.speaker_ask as sa
from pylib.speaker_ask import (
    SpeakerAskManager,
    is_person_like,
    rank_candidates,
)
from pylib.speaker_recognition import SpeakerRecognitionSession


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------

class TestPureHelpers(unittest.TestCase):
    def test_is_person_like(self):
        self.assertTrue(is_person_like("Joe Biden"))
        self.assertTrue(is_person_like("Jon Ossoff"))
        for generic in ["Reporters", "panelist", "ANNOUNCER", "advertisement",
                        "n/a", "Hosts", "moderator"]:
            self.assertFalse(is_person_like(generic), generic)

    def test_rank_candidates_orders_and_truncates(self):
        entities = ["Alice", "Bob", "Carol"]
        scores = {"alice-2": 0.4, "alice-1": 0.7, "bob": 0.55}
        ranked = rank_candidates(entities, scores, max_candidates=8)
        self.assertEqual([n for n, _ in ranked], ["Alice", "Bob", "Carol"])
        self.assertAlmostEqual(ranked[0][1], 0.7)
        self.assertAlmostEqual(ranked[1][1], 0.55)
        self.assertIsNone(ranked[2][1])  # no reference for Carol

    def test_rank_candidates_keeps_scored_entities_when_truncating(self):
        entities = [f"P{i}" for i in range(6)]
        scores = {"p5": 0.9}  # only the last entity has a reference
        ranked = rank_candidates(entities, scores, max_candidates=2)
        self.assertEqual(ranked[0][0], "P5")
        self.assertAlmostEqual(ranked[0][1], 0.9)

    def test_rank_candidates_matches_punctuated_names(self):
        # Library keys use slugify normalization ("t.j. smith" -> "tj-smith").
        ranked = rank_candidates(["T.J. Smith"], {"tj-smith-1": 0.8}, 8)
        self.assertAlmostEqual(ranked[0][1], 0.8)


class TestAskCallbacks(unittest.TestCase):
    def test_roundtrip_all_actions(self):
        kb = build_ask_keyboard([("Alice", "alice"), ("Bob", "bob")],
                                "my-slug", "3")
        buttons = [b for row in kb["inline_keyboard"] for b in row]
        data = [b["callback_data"] for b in buttons]
        self.assertEqual(data[0], "sa:c:my-slug:3:0")
        self.assertEqual(data[2], "sa:o:my-slug:3")
        self.assertEqual(data[3], "sa:i:my-slug:3")
        parsed = [parse_ask_callback(d) for d in data]
        self.assertEqual(parsed[0], {"action": "confirm", "slug": "my-slug",
                                     "spk": "3", "idx": 0})
        self.assertEqual(parsed[2], {"action": "other", "slug": "my-slug",
                                     "spk": "3"})
        self.assertEqual(parsed[3], {"action": "ignore", "slug": "my-slug",
                                     "spk": "3"})

    def test_callback_budget_at_max_slug(self):
        slug = "x" * MAX_SLUG_LEN
        kb = build_ask_keyboard([("Alice", "alice")], slug, "12")
        for row in kb["inline_keyboard"]:
            for b in row:
                self.assertLessEqual(len(b["callback_data"].encode()),
                                     MAX_CALLBACK_BYTES)

    def test_slug_over_budget_raises(self):
        with self.assertRaises(CallbackTooLong):
            build_ask_keyboard([("Alice", "alice")], "x" * (MAX_SLUG_LEN + 1), "1")

    def test_parse_rejects_non_ask_payloads(self):
        for junk in ["", "gs:approve:slug:1", "sa:zz:slug:1", "sa:c:slug",
                     "sa:c:slug:1:notanint", None]:
            self.assertIsNone(parse_ask_callback(junk), repr(junk))


class TestWsFraming(unittest.TestCase):
    def test_classify_binary(self):
        jpeg = b"\x01\xff\xd8" + b"jpegdata"
        gif = b"\x02GIF1" + (7).to_bytes(4, "big") + b"GIF89a-body"
        self.assertEqual(classify_binary(jpeg), "frame")
        self.assertEqual(classify_binary(gif), "gif")
        self.assertEqual(classify_binary(b"\x00\x01\x02\x03audio"), "audio")

    def test_audio_starting_with_0x02_is_not_gif(self):
        # True negative: PCM that happens to begin with 0x02 must stay audio.
        pcm = b"\x02\x01\x03\x04" + b"\x00" * 32
        self.assertEqual(classify_binary(pcm), "audio")

    def test_short_messages(self):
        self.assertEqual(classify_binary(b""), "audio")
        self.assertEqual(classify_binary(b"\x01\xff"), "audio")
        self.assertEqual(classify_binary(b"\x02GIF1"), "audio")

    def test_parse_gif_message(self):
        gif = b"\x02GIF1" + (0x01020304).to_bytes(4, "big") + b"payload"
        self.assertEqual(parse_gif_message(gif), (0x01020304, b"payload"))
        self.assertEqual(parse_gif_message(b"\x02GIF1"), (None, b""))
        self.assertEqual(parse_gif_message(b"audio"), (None, b""))


class TestSampleReviewCaps(unittest.TestCase):
    def _segments(self, per_source, score_span=(0.1, 0.9)):
        segs = []
        n_sources = len(per_source)
        for s_i, count in enumerate(per_source):
            lo, hi = score_span
            for i in range(count):
                score = hi - (hi - lo) * (i / max(1, count - 1))
                segs.append({"source": f"src{s_i}", "score": round(score, 3)})
        return segs

    def test_max_per_video_hard_cap(self):
        segs = self._segments([10])
        idxs, diverse, _ = select_review_subset(segs, max_per_video=99, min_sources=1)
        self.assertEqual(len(idxs), MAX_REVIEW_PER_VIDEO)
        self.assertTrue(all(i < 4 for i in idxs))  # top-4 by score

    def test_batch_cap_with_min_sources_preserved(self):
        segs = self._segments([4] * 8)
        idxs, diverse, seen = select_review_subset(segs, max_per_video=4, min_sources=5)
        self.assertEqual(len(idxs), MAX_REVIEW_PER_BATCH)
        self.assertGreaterEqual(len(seen), 5)

    def test_min_sources_topup(self):
        # 10 sources with 1 segment each: batch cap trims, min_sources kept.
        segs = self._segments([1] * 10)
        idxs, _, seen = select_review_subset(segs, max_per_video=4, min_sources=4)
        self.assertEqual(len(idxs), MAX_REVIEW_PER_BATCH)
        self.assertGreaterEqual(len(seen), 4)

    def test_persist_subset_adds_bounded_spares(self):
        segs = self._segments([12, 12])
        idxs, _, _ = select_review_subset(segs, max_per_video=4, min_sources=1)
        persist = select_persist_subset(segs, idxs)
        self.assertTrue(set(idxs).issubset(persist))
        per_source = {}
        for i in persist:
            per_source.setdefault(segs[i]["source"], []).append(i)
        for src, members in per_source.items():
            self.assertLessEqual(len(members), 8, src)


# ---------------------------------------------------------------------------
# SpeakerAskManager
# ---------------------------------------------------------------------------

def np_cosine(a, b):
    a = np.asarray(a, dtype=np.float64).reshape(-1)
    b = np.asarray(b, dtype=np.float64).reshape(-1)
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return None
    return float(np.dot(a, b) / (na * nb))


class FakeWs:
    def __init__(self):
        self.closed = False
        self.sent = []

    async def send(self, data):
        self.sent.append(data)


class FakeAudioProcessor:
    def __init__(self, audio_dir, epoch=0):
        self._audio_dir = Path(audio_dir)
        self.dg_epoch = epoch


class FakeIdentifier:
    def __init__(self, ask_embedding=None, embed_fn=None, references=None):
        self.ask_embedding = (np.array([1.0, 0.0, 0.0])
                              if ask_embedding is None else ask_embedding)
        self.embed_fn = embed_fn
        self.calls = 0
        self.added = []
        self.references = references or {}

    async def identify_with_embedding(self, audio, threshold=None):
        return [], {}, self.ask_embedding

    async def embed_audio(self, audio):
        self.calls += 1
        if self.embed_fn is not None:
            return self.embed_fn(self.calls)
        return self.ask_embedding

    async def add_reference(self, name, embedding):
        self.added.append(name)
        self.references[name] = embedding


class FakeTradeProcessor:
    def __init__(self):
        self.added = []

    def add_trading_speaker(self, speaker_id, market_indices=None):
        self.added.append((speaker_id, market_indices))
        return True


class FakeRecognition:
    def __init__(self, session, entities=("Alice", "Bob")):
        self.listening_session = session
        self.market_entities = list(entities)
        self.profile_labels = {}
        self.human_labels = set()

    def set_profile_label(self, spk, label, force=False):
        self.profile_labels[spk] = label

    def _entity_market_indices(self, entity):
        return [0]


class FakeSession:
    def __init__(self, audio_dir, transcript=None, epoch=0, entities=("Alice", "Bob"),
                 identifier=None, gif_bytes=b"GIF89a-body"):
        self.session_id = "test-slug"
        self.market = {"title": "Test Market"}
        self.websocket = FakeWs()
        self.audio_processor = FakeAudioProcessor(audio_dir, epoch)
        self.transcript = transcript if transcript is not None else {}
        self.trade_processor = FakeTradeProcessor()
        self.gif_requests = []
        self._gif_bytes = gif_bytes
        self.server = types.SimpleNamespace(
            speaker_identifier=identifier if identifier is not None else FakeIdentifier()
        )

    async def request_gif(self, **kwargs):
        self.gif_requests.append(kwargs)
        return self._gif_bytes


BASE_CFG = {
    "enabled": True,
    "minAudioSecs": 2,
    "minWords": 3,
    "perSpeakerCooldownSecs": 300,
    "minGapSecs": 0,
    "maxAsksPerSession": 5,
    "askAudioSecs": 2,
    "retainAudioSecs": 4,
    "maxCandidates": 8,
    "samplesPerConfirm": 3,
    "chunkSecs": [1, 2],
    "chunkFloor": 0.60,
    "nearDuplicateCeiling": 0.95,
    "gif": {"enabled": True, "maxSpanSecs": 20, "timeoutSecs": 12,
            "fps": 4, "width": 320},
    "photos": {"enabled": False},
}


def write_wav(path, seconds=4, amplitude=8000):
    frames = (np.sin(np.linspace(0, 40 * np.pi, int(seconds * 16000))) * amplitude)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        wf.writeframes(frames.astype(np.int16).tobytes())


class AskManagerTestCase(unittest.IsolatedAsyncioTestCase):
    """Shared harness: temp audio dir with one speaker WAV and mocks."""

    def setUp(self):
        self._tmp = TemporaryDirectory()
        self.audio_dir = Path(self._tmp.name)
        self.patches = [
            patch.object(sa, "_cosine", side_effect=np_cosine),
            patch.object(sa, "encode_ogg", return_value=b"OGG"),
            patch.object(sa, "send_telegram_voice",
                         return_value={"ok": True}),
            patch.object(sa, "send_telegram_animation",
                         return_value={"ok": True}),
            patch.object(sa, "send_telegram_photo", return_value={"ok": True}),
            patch.object(sa, "get_photo_url", return_value=None),
        ]
        self.mocks = {}
        for p in self.patches:
            self.mocks[p.attribute] = p.start()
        self.mocks["send_telegram"] = patch.object(
            sa, "send_telegram", return_value={"ok": True}).start()
        # Stub torch so sampling behaves identically with and without it
        # installed (CI has no torch; the EC2 box does).
        self.torch_stub = patch.dict(sys.modules, {
            "torch": types.SimpleNamespace(save=lambda obj, buf: buf.write(b"E")),
        })
        self.torch_stub.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.torch_stub.stop()
        patch.stopall()
        self._tmp.cleanup()

    def build(self, *, transcript=None, epoch=0, entities=("Alice", "Bob"),
              identifier=None, cfg=None):
        merged = dict(BASE_CFG)
        if cfg:
            merged.update(cfg)
        session = FakeSession(self.audio_dir, transcript=transcript, epoch=epoch,
                              entities=entities, identifier=identifier)
        recognition = FakeRecognition(session, entities=entities)
        manager = SpeakerAskManager(recognition, merged)
        return manager, recognition, session

    async def drain(self, manager):
        for _ in range(10):
            tasks = list(manager._tasks)
            if not tasks:
                return
            await asyncio.gather(*tasks, return_exceptions=True)


class TestAskGates(AskManagerTestCase):
    async def test_ask_fires_when_gates_pass(self):
        write_wav(self.audio_dir / "speaker_0.wav")
        manager, recognition, session = self.build(
            transcript={"0": [{"text": f"w{i}"} for i in range(10)]}
        )
        await manager.maybe_ask()
        await self.drain(manager)
        self.assertIn("0", manager.asks)
        self.assertIn("0", manager._asked_at)
        voice_call = self.mocks["send_telegram_voice"].call_args
        self.assertEqual(voice_call.args[0], b"OGG")
        keyboard = voice_call.args[2]
        button_texts = [b["text"] for row in keyboard["inline_keyboard"] for b in row]
        self.assertIn("Alice", button_texts)
        self.assertIn("Bob", button_texts)
        # GIF was requested and sent.
        self.assertEqual(len(session.gif_requests), 1)
        self.assertEqual(session.gif_requests[0]["age_newest"], 0.0)
        self.mocks["send_telegram_animation"].assert_called_once()

    async def test_ask_skipped_when_disabled(self):
        write_wav(self.audio_dir / "speaker_0.wav")
        manager, _, _ = self.build(
            transcript={"0": [{"text": "x"}] * 10}, cfg={"enabled": False}
        )
        await manager.maybe_ask()
        await self.drain(manager)
        self.assertEqual(manager.asks, {})
        self.mocks["send_telegram_voice"].assert_not_called()

    async def test_ask_skipped_for_short_audio_and_few_words(self):
        write_wav(self.audio_dir / "speaker_0.wav", seconds=1)  # < minAudioSecs
        manager, _, _ = self.build(transcript={"0": [{"text": "x"}] * 10})
        await manager.maybe_ask()
        await self.drain(manager)
        self.assertEqual(manager.asks, {})

        write_wav(self.audio_dir / "speaker_1.wav")
        manager2, _, _ = self.build(transcript={"1": [{"text": "x"}]})  # < minWords
        await manager2.maybe_ask()
        await self.drain(manager2)
        self.assertEqual(manager2.asks, {})

    async def test_ask_skipped_for_labeled_ignored_and_cooled_speaker(self):
        write_wav(self.audio_dir / "speaker_0.wav")
        manager, recognition, _ = self.build(
            transcript={"0": [{"text": "x"}] * 10}
        )
        recognition.profile_labels["0"] = "Alice"
        await manager.maybe_ask()
        await self.drain(manager)
        self.assertEqual(manager.asks, {})

        manager.ignored.add("0")
        manager2, recognition2, _ = self.build(
            transcript={"0": [{"text": "x"}] * 10}
        )
        manager2.ignored.add("0")
        await manager2.maybe_ask()
        await self.drain(manager2)
        self.assertEqual(manager2.asks, {})

        # Cooldown: a second ask inside perSpeakerCooldownSecs is suppressed.
        manager3, recognition3, _ = self.build(
            transcript={"0": [{"text": "x"}] * 10}
        )
        await manager3.maybe_ask()
        await self.drain(manager3)
        self.assertIn("0", manager3.asks)
        manager3.asks.clear()
        await manager3.maybe_ask()
        await self.drain(manager3)
        self.assertEqual(manager3.asks, {})

    async def test_ask_skipped_without_person_entities(self):
        write_wav(self.audio_dir / "speaker_0.wav")
        manager, _, _ = self.build(
            transcript={"0": [{"text": "x"}] * 10}, entities=("Reporters",)
        )
        await manager.maybe_ask()
        await self.drain(manager)
        self.assertEqual(manager.asks, {})

    async def test_ask_skipped_when_websocket_closed(self):
        write_wav(self.audio_dir / "speaker_0.wav")
        manager, _, session = self.build(transcript={"0": [{"text": "x"}] * 10})
        session.websocket.closed = True
        await manager.maybe_ask()
        await self.drain(manager)
        self.assertEqual(manager.asks, {})

    async def test_max_asks_per_session(self):
        write_wav(self.audio_dir / "speaker_0.wav")
        manager, _, _ = self.build(
            transcript={"0": [{"text": "x"}] * 10},
            cfg={"maxAsksPerSession": 0},
        )
        await manager.maybe_ask()
        await self.drain(manager)
        self.assertEqual(manager.asks, {})

    async def test_keyboard_too_long_aborts_ask(self):
        write_wav(self.audio_dir / "speaker_0.wav")
        manager, _, _ = self.build(transcript={"0": [{"text": "x"}] * 10})
        manager.slug = "x" * (MAX_SLUG_LEN + 1)
        await manager.maybe_ask()
        await self.drain(manager)
        self.assertEqual(manager.asks, {})
        self.mocks["send_telegram_voice"].assert_not_called()


class TestConfirmation(AskManagerTestCase):
    async def _ask_once(self, **kwargs):
        write_wav(self.audio_dir / "speaker_0.wav")
        manager, recognition, session = self.build(
            transcript={"0": [{"text": "x"}] * 10}, **kwargs
        )
        await manager.maybe_ask()
        await self.drain(manager)
        self.assertIn("0", manager.asks)
        return manager, recognition, session

    async def test_happy_path_labels_whitelists_and_saves(self):
        identifier = FakeIdentifier()
        manager, recognition, session = await self._ask_once(identifier=identifier)
        with patch.object(manager, "_upload_to_s3") as upload:
            await manager.handle_confirmation(
                {"action": "confirm", "spk": "0", "idx": 1}
            )
            await self.drain(manager)
        self.assertEqual(recognition.profile_labels["0"], "Bob")
        self.assertIn("0", recognition.human_labels)
        self.assertEqual(session.trade_processor.added, [("0", [0])])
        # Samples were curated, added in-process, uploaded and pushed.
        self.assertTrue(identifier.added)
        upload.assert_called_once()
        pushed = [m for m in session.websocket.sent]
        self.assertTrue(any('"sample_saved"' in m for m in pushed))
        payload = json.loads([m for m in pushed if '"sample_saved"' in m][0])
        self.assertEqual(len(payload["files"]), len(identifier.added))
        for f in payload["files"]:
            self.assertTrue(f["name"].startswith("bob-"))
            self.assertTrue(f["wav_b64"] and f["embedding_b64"])
        reply = self.mocks["send_telegram"].call_args.args[0]
        self.assertIn("✅", reply)
        self.assertIn("Bob", reply)

    async def test_saved_wav_has_riff_header(self):
        identifier = FakeIdentifier()
        manager, _, session = await self._ask_once(identifier=identifier)
        with patch.object(manager, "_upload_to_s3"):
            await manager.handle_confirmation({"action": "confirm", "spk": "0", "idx": 0})
            await self.drain(manager)
        payload = json.loads(
            [m for m in session.websocket.sent if '"sample_saved"' in m][0]
        )
        import base64
        wav = base64.b64decode(payload["files"][0]["wav_b64"])
        self.assertEqual(wav[:4], b"RIFF")
        self.assertEqual(wav[8:12], b"WAVE")
        self.assertEqual(int.from_bytes(wav[24:28], "little"), 16000)

    async def test_epoch_mismatch_rejects(self):
        manager, recognition, _ = await self._ask_once()
        manager.session.audio_processor.dg_epoch = 7  # reconnect since the ask
        await manager.handle_confirmation({"action": "confirm", "spk": "0", "idx": 0})
        await self.drain(manager)
        self.assertEqual(recognition.profile_labels, {})
        self.assertIn("⚠️", self.mocks["send_telegram"].call_args.args[0])

    async def test_low_self_similarity_rejects(self):
        identifier = FakeIdentifier()
        manager, recognition, _ = await self._ask_once(identifier=identifier)
        identifier.ask_embedding = np.array([1.0, 0.0, 0.0])
        manager.asks  # record popped on confirm; patch the stored record instead
        # Rebuild a record scenario: replace embed_audio to return an orthogonal vec
        identifier.embed_fn = lambda _n: np.array([0.0, 1.0, 0.0])
        await manager.handle_confirmation({"action": "confirm", "spk": "0", "idx": 0})
        await self.drain(manager)
        self.assertEqual(recognition.profile_labels, {})
        self.assertIn("⚠️", self.mocks["send_telegram"].call_args.args[0])

    async def test_ignore_marks_without_label(self):
        manager, recognition, session = await self._ask_once()
        await manager.handle_confirmation({"action": "ignore", "spk": "0"})
        await self.drain(manager)
        self.assertIn("0", manager.ignored)
        self.assertEqual(recognition.profile_labels, {})
        self.assertEqual(session.trade_processor.added, [])

    async def test_confirm_idx_out_of_range(self):
        manager, recognition, _ = await self._ask_once()
        await manager.handle_confirmation({"action": "confirm", "spk": "0", "idx": 99})
        await self.drain(manager)
        self.assertEqual(recognition.profile_labels, {})

    async def test_other_typed_name(self):
        manager, recognition, session = await self._ask_once()
        with patch.object(manager, "_upload_to_s3"):
            await manager.handle_confirmation(
                {"action": "other", "spk": "0", "entity": "Carol"}
            )
            await self.drain(manager)
        self.assertEqual(recognition.profile_labels["0"], "Carol")
        # Not a market entity -> no whitelist entry.
        self.assertEqual(session.trade_processor.added, [])

    async def test_other_short_name_ignored(self):
        manager, recognition, _ = await self._ask_once()
        await manager.handle_confirmation(
            {"action": "other", "spk": "0", "entity": "xy"}
        )
        await self.drain(manager)
        self.assertEqual(recognition.profile_labels, {})

    async def test_confirmation_for_unknown_speaker_ignored(self):
        manager, recognition, _ = await self._ask_once()
        await manager.handle_confirmation({"action": "confirm", "spk": "9", "idx": 0})
        await self.drain(manager)
        self.assertEqual(recognition.profile_labels, {})


class TestSampleCuration(AskManagerTestCase):
    def _record(self, manager, pcm_seconds=4, embedding=None):
        pcm = np.zeros(int(pcm_seconds * 16000), dtype=np.float32)
        return sa.AskRecord(
            spk="0", slug=manager.slug, epoch=0,
            candidates=[("Bob", 0.5)],
            embedding=embedding if embedding is not None else np.array([1.0, 0.0, 0.0]),
            retained_pcm=pcm,
        )

    async def test_chunk_floor_rejects_dissimilar_chunks(self):
        def embed_fn(n):
            return [np.array([1.0, 0.0, 0.0]),      # chunk 0: matches
                    np.array([0.0, 1.0, 0.0]),      # chunk 1: orthogonal -> floor
                    np.array([1.0, 0.0, 0.0])][n - 1]
        identifier = FakeIdentifier(embed_fn=embed_fn)
        manager, _, _ = self.build(identifier=identifier)
        record = self._record(manager)
        with patch.object(manager, "_upload_to_s3"), \
             patch.object(manager, "_push_to_client", new=AsyncMock()):
            saved = await manager._save_samples(record, "Bob")
        self.assertEqual(saved, 2)

    async def test_pairwise_floor_rejects_inconsistent_chunks(self):
        def embed_fn(n):
            return [np.array([0.62, -0.78, 0.0]),   # kept first (sim .62)
                    np.array([0.61, 0.79, 0.0]),    # high vs ask, <0.5 pairwise
                    np.array([0.62, -0.78, 0.0])][n - 1]
        identifier = FakeIdentifier(embed_fn=embed_fn)
        manager, _, _ = self.build(identifier=identifier)
        record = self._record(manager)
        with patch.object(manager, "_upload_to_s3"), \
             patch.object(manager, "_push_to_client", new=AsyncMock()):
            saved = await manager._save_samples(record, "Bob")
        self.assertEqual(saved, 2)  # chunks 0 and 2 (duplicates of each other)

    async def test_near_duplicate_of_existing_ref_skipped(self):
        existing = {"bob-3": np.array([1.0, 0.0, 0.0])}
        identifier = FakeIdentifier(references=existing)
        manager, _, _ = self.build(identifier=identifier)
        record = self._record(manager)
        with patch.object(manager, "_upload_to_s3"), \
             patch.object(manager, "_push_to_client", new=AsyncMock()):
            saved = await manager._save_samples(record, "Bob")
        self.assertEqual(saved, 0)

    async def test_samples_per_confirm_limits_count(self):
        identifier = FakeIdentifier()
        manager, _, _ = self.build(identifier=identifier,
                                   cfg={"samplesPerConfirm": 1})
        record = self._record(manager)
        with patch.object(manager, "_upload_to_s3"), \
             patch.object(manager, "_push_to_client", new=AsyncMock()):
            saved = await manager._save_samples(record, "Bob")
        self.assertEqual(saved, 1)

    async def test_identity_at_cap_saves_nothing(self):
        manager, _, _ = self.build()
        record = self._record(manager)
        with patch.object(sa, "count_samples", return_value=100):
            saved = await manager._save_samples(record, "Bob")
        self.assertEqual(saved, 0)
        self.assertIn("cap", self.mocks["send_telegram"].call_args.args[0])

    async def test_disabled_when_samples_per_confirm_zero(self):
        manager, _, _ = self.build(cfg={"samplesPerConfirm": 0})
        record = self._record(manager)
        self.assertEqual(await manager._save_samples(record, "Bob"), 0)


class TestInferenceHook(unittest.IsolatedAsyncioTestCase):
    """run_identity_inference must offer asks after every branch."""

    @staticmethod
    def _mock_session():
        session = MagicMock()
        session.session_id = "s"
        session.market = {"mediaSources": []}  # ctor's duration heuristic
        return session

    def _recognizer(self, session):
        return SpeakerRecognitionSession(session, ["Alice"])

    async def test_maybe_ask_runs_after_inference(self):
        session = self._mock_session()
        session.speaker_ask = MagicMock()
        session.speaker_ask.maybe_ask = AsyncMock()
        recognizer = self._recognizer(session)
        with patch.object(SpeakerRecognitionSession, "_run_identity_inference",
                          new=AsyncMock(return_value=True)):
            result = await recognizer.run_identity_inference()
        self.assertTrue(result)
        session.speaker_ask.maybe_ask.assert_awaited_once()

    async def test_ask_failure_does_not_break_inference(self):
        session = self._mock_session()
        session.speaker_ask = MagicMock()
        session.speaker_ask.maybe_ask = AsyncMock(side_effect=RuntimeError("boom"))
        recognizer = self._recognizer(session)
        with patch.object(SpeakerRecognitionSession, "_run_identity_inference",
                          new=AsyncMock(return_value=False)):
            result = await recognizer.run_identity_inference()
        self.assertFalse(result)

    async def test_no_ask_manager_is_fine(self):
        session = self._mock_session()
        session.speaker_ask = None  # e.g. speakerAsk.enabled is false
        recognizer = self._recognizer(session)
        with patch.object(SpeakerRecognitionSession, "_run_identity_inference",
                          new=AsyncMock(return_value=True)):
            self.assertTrue(await recognizer.run_identity_inference())


if __name__ == "__main__":
    unittest.main()

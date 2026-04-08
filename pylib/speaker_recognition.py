import os
import asyncio
import logging
import json
from pprint import pprint
from pathlib import Path
from abc import ABC, abstractmethod

# Handle boto3 optionally
try:
    import boto3
except ImportError:
    boto3 = None

logger = logging.getLogger("remote_server")

# Note: Profile labels and mapping are now managed per-session via SpeakerRecognitionSession.


class BaseSpeakerRecognizer(ABC):
    @abstractmethod
    async def verify_speaker(self, data, profile_name: str) -> float:
        """
        Verify if the speaker in data matches the reference profile.
        Returns confidence score (0.0 to 1.0).
        """
        pass


class AudioSpeakerRecognizer(BaseSpeakerRecognizer):
    """Audio-based speaker recognition using NeMo TitaNet. Currently disabled."""
    def __init__(self, listening_session, device: str = "cpu"):
        # import torch
        # import numpy as np
        # import nemo.collections.asr.models as nemo_asr

        self.listening_session = listening_session
        self.device = device
        self.reference_embeddings = {}
        self.audio_samples_dir = Path(__file__).parent.parent / "audio-samples"
        logger.info(
            f"SpeakerRecognizer initialized (audio disabled). Reference dir: {self.audio_samples_dir}"
        )

        # # Using TitaNet-L for high accuracy speaker verification
        # self.model = nemo_asr.EncDecSpeakerLabelModel.from_pretrained(
        #     model_name="titanet_large"
        # ).to(device)
        # self.model.eval()

    # def _get_embedding(self, audio_data):
    #     import torch
    #     import numpy as np
    #     audio_tensor = torch.from_numpy(audio_data).to(self.device).unsqueeze(0)
    #     audio_len = torch.tensor([audio_tensor.shape[1]]).to(self.device)
    #     with torch.no_grad():
    #         _, embedding = self.model.forward(
    #             input_signal=audio_tensor, input_signal_length=audio_len
    #         )
    #     return embedding

    # def load_reference(self, profile_name: str):
    #     if profile_name in self.reference_embeddings:
    #         return
    #     wav_path = self.audio_samples_dir / f"{profile_name}.wav"
    #     if not wav_path.exists():
    #         logger.error(f"Reference wav not found for profile '{profile_name}' at {wav_path}")
    #         return
    #     logger.info(f"Loading reference embedding for '{profile_name}'...")
    #     import librosa
    #     audio, _ = librosa.load(str(wav_path), sr=16000)
    #     self.reference_embeddings[profile_name] = self._get_embedding(audio)

    async def verify_speaker(self, pcm_data: bytes, profile_name: str) -> float:
        # Audio verification disabled — use transcript-based inference instead
        return 0.0


class TranscriptSpeakerRecognizer(BaseSpeakerRecognizer):
    def __init__(self, listening_session, region_name="us-east-1", model_id="us.amazon.nova-lite-v1:0"):
        self.listening_session = listening_session
        self.region_name = region_name
        self.model_id = model_id
        self._bedrock_client = None

    @property
    def bedrock_client(self):
        if self._bedrock_client is None:
            if boto3 is None:
                logger.error("boto3 not installed. Cannot use Bedrock.")
                return None
            try:
                self._bedrock_client = boto3.client("bedrock-runtime", region_name=self.region_name)
            except Exception as e:
                logger.error(f"Failed to initialize Bedrock client: {e}")
        return self._bedrock_client

    async def verify_speaker(self, transcript_text: str, profile_name: str) -> float:
        """
        Verify if the transcript matches a profile using word analysis / NLP.
        """
        # This is a simple per-segment check, but infer_identity_with_bedrock is preferred for batch.
        return 0.0

    async def infer_identity_with_bedrock(self, speaker_transcripts: dict[str, str], target_speaker_name: str) -> dict[str, str]:
        """
        Calls Amazon Bedrock to identify which speaker_id is the target_speaker_name.
        Returns a mapping of {speaker_id: label}.
        """
        client = self.bedrock_client
        if not client:
            return {}
 
        # Only include the top 10 non-ad speakers by word count to reduce noise
        ranked = sorted(speaker_transcripts.items(), key=lambda x: len(x[1].split()), reverse=True)[:10]

        # Compute TF-IDF to find distinctive terms per speaker
        from sklearn.feature_extraction.text import TfidfVectorizer

        sids = [sid for sid, _ in ranked]
        texts = [text for _, text in ranked]
        vectorizer = TfidfVectorizer(stop_words="english", max_features=5000, token_pattern=r'(?u)\b[a-zA-Z]{3,}\b')
        tfidf_matrix = vectorizer.fit_transform(texts)
        feature_names = vectorizer.get_feature_names_out()

        speaker_top_terms = {}
        for i, sid in enumerate(sids):
            row = tfidf_matrix[i].toarray().flatten()
            top_indices = row.argsort()[-15:][::-1]
            speaker_top_terms[sid] = [feature_names[j] for j in top_indices if row[j] > 0]

        prompt_data = []
        for i, (sid, text) in enumerate(ranked):
            word_count = len(text.split())
            top_terms = ", ".join(speaker_top_terms.get(sid, []))
            # Increase context for top 3 speakers to help identify long-form hosts
            context_limit = 5000 if i < 3 else 2000
            prompt_data.append(f"ID {sid} ({word_count} words, distinctive terms: [{top_terms}]): \"{text[:context_limit]}\"")

        transcript_block = "\n\n".join(prompt_data)

        prompt = f"""
        You are identifying the real host or primary guests in a broadcast transcript.
        I have a transcript from a broadcast session with speaker IDs 0, 1, 2, etc.
        Your goal is to identify ALL Speaker IDs that are actually "{target_speaker_name}".

        CRITICAL DISTINCTION:
        1. **The Host ({target_speaker_name})**: Usually has a very high word count, speaks in long monologues, introduces segments ("Coming up next...", "Tonight on the show..."), and analyzes news or specific topics (like "{', '.join(speaker_top_terms.get(ranked[0][0], [])[:5])}").
        2. **Mention-only Advertisements**: Often use the host's name ("Hey {target_speaker_name}!", "Thanks {target_speaker_name}...", "Starting at just $79...") but speak for much less time and focus on products (jewelry, insurance, medicine, etc.). Do NOT label these as "{target_speaker_name}". Label them as "advertisement".
        3. **Guests/Other**: May be interviewed by the host. Label as "unknown" unless they are also "{target_speaker_name}".

        Diarization Note: The same person might be split across multiple Speaker IDs. Use the content, style, and vocabulary to link them.

        TRANSCRIPT SEGMENTS:
        {transcript_block}

        Respond ONLY with a JSON object mapping Speaker IDs to labels. 
        Possible labels: "{target_speaker_name}", "advertisement", "unknown".
        """

        body_dict = {
            "inferenceConfig": {
                "max_new_tokens": 1000
            },
            "messages": [
                {
                    "role": "user",
                    "content": [{"text": prompt}]
                }
            ]
        }
        body = json.dumps(body_dict, indent=2)

        try:
            # Use original loop executor for sync boto3 call
            response = await asyncio.get_running_loop().run_in_executor(
                None,
                lambda: client.invoke_model(
                    body=body,
                    modelId=self.model_id,
                    accept="application/json",
                    contentType="application/json"
                )
            )

            if not response or "body" not in response:
                return {}

            response_body = json.loads(response.get("body").read())
            content = response_body.get("output", {}).get("message", {}).get("content", [])
            if not content:
                return {}
            
            result_text = content[0].get("text", "").strip()
            # Find the JSON block in the text (in case the model adds preamble)
            start_idx = result_text.find("{")
            end_idx = result_text.rfind("}")
            if start_idx != -1 and end_idx != -1:
                json_str = result_text[start_idx:end_idx+1]
                try:
                    llm_result = json.loads(json_str)
                    # Clean up keys in case the model added prefixes
                    cleaned_result = {}
                    for k, v in llm_result.items():
                        clean_k = k.replace("Speaker ID ", "").replace("Speaker ID", "").replace("ID ", "").replace("ID", "").strip()
                        cleaned_result[clean_k] = v
                    return cleaned_result
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse Bedrock JSON: {json_str}")
            
            return {}

        except Exception as e:
            logger.error(f"Bedrock invocation failed: {e}")
            return {}


class SpeakerRecognitionSession:
    """Manages speaker recognition and entity mapping for a specific broadcast session."""

    def __init__(self, listening_session, market_entities: list[str]):
        self.listening_session = listening_session
        self.session_id = getattr(listening_session, "session_id", "unknown_session")
        self.market_entities = market_entities

        # Session-specific profile labels (e.g., "voice_profile_1": "advertisement")
        self.profile_labels = {}

        # Instantiated recognizers for this session
        self.audio_recognizer = AudioSpeakerRecognizer(
            listening_session=self.listening_session
        )
        self.transcript_recognizer = TranscriptSpeakerRecognizer(
            listening_session=self.listening_session
        )

    def set_profile_label(self, voice_profile_id: str, label: str):
        self.profile_labels[voice_profile_id] = label

    def map_voice_profile_to_entity(self, voice_profile_id: str) -> str | None:
        """
        Maps a given voice profile ID to a known entity in the market for this session.
        """
        label = self.profile_labels.get(voice_profile_id)
        if label == "advertisement":
            return "advertisement"

        # Check if the label matches one of the market entities
        for entity in self.market_entities:
            if label == entity:
                return entity

        return None

    async def run_identity_inference(self):
        """
        Aggregates session transcripts and runs LLM-based identity inference.
        """
        # Access transcript from session
        if not hasattr(self.listening_session, "transcript"):
            logger.warning("Session has no transcript to infer identities from.")
            return

        async with self.listening_session.transcript_lock:
            speaker_texts = {}
            for sid, tokens in self.listening_session.transcript.items():
                text = " ".join([t["text"] for t in tokens])
                speaker_texts[sid] = text

        if not speaker_texts:
            logger.info("Transcript is empty, skipping identity inference.")
            return

        # Use the first market entity as the target speaker by default
        target_name = self.market_entities[0] if self.market_entities else "Unknown"
        logger.info(f"Running Bedrock identity inference for target: {target_name}")

        mapping = await self.transcript_recognizer.infer_identity_with_bedrock(
            speaker_texts, target_name
        )

        if mapping:
            logger.info(f"Identity mapping inferred: {mapping}")
            for sid, label in mapping.items():
                self.set_profile_label(sid, label)
                
                # If the label matches a market entity, add to trading whitelist
                if label in self.market_entities:
                    if hasattr(self.listening_session, "trade_processor"):
                        self.listening_session.trade_processor.add_trading_speaker(sid)
                        logger.info(f"Added speaker {sid} ({label}) to trading whitelist.")
        else:
            logger.warning("Identity inference returned no mapping.")

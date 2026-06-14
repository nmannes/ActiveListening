import os
import asyncio
import logging
import json
from pprint import pprint
from pathlib import Path
from abc import ABC, abstractmethod
from typing import Optional, Union, List, Dict, Tuple

# Handle boto3 optionally
try:
    import boto3
except ImportError:
    boto3 = None

from pylib.prompt_templates import (
    get_survivor_prompt, 
    get_interview_prompt, 
    get_sports_prompt, 
    get_earnings_prompt, 
    get_default_prompt
)

logger = logging.getLogger("remote_server")
from pylib.telegram import send_telegram, send_telegram_audio

# Note: Profile labels and mapping are now managed per-session via SpeakerRecognitionSession.


class BaseSpeakerRecognizer(ABC):
    @abstractmethod
    async def verify_speaker(self, data, profile_name: str) -> float:
        """
        Verify if the speaker in data matches the reference profile.
        Returns confidence score (0.0 to 1.0).
        """
        pass

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

    async def infer_identity_with_bedrock(self, transcript_history: List[Tuple[str, str]], target_speaker_name: str) -> Dict[str, str]:
        """
        Calls Amazon Bedrock to identify which speaker_id is the target_speaker_name.
        Returns a mapping of {speaker_id: label}.
        """
        prompt = self.format_prompt(transcript_history, target_speaker_name)
        if not prompt:
            return {}
            
        result_text = await self.send_request(prompt)
        if not result_text:
            return {}
            
        return self.process_response(result_text)

    def format_prompt(self, transcript_history: List[Tuple[str, str]], target_speaker_name: str) -> str:
        """Aggregates data and generates the prompt for Bedrock."""
        # speaker summary and ranking
        speaker_transcripts_dict = {}
        for sid, text in transcript_history:
            if sid not in speaker_transcripts_dict:
                speaker_transcripts_dict[sid] = []
            speaker_transcripts_dict[sid].append(text)

        speaker_transcripts = {sid: " ".join(texts) for sid, texts in speaker_transcripts_dict.items()}
        ranked = sorted(speaker_transcripts.items(), key=lambda x: len(x[1].split()), reverse=True)[:10]
        top_sids = set(sid for sid, _ in ranked)

        # TF-IDF for distinctive terms
        speaker_top_terms = {}
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
            sids = [sid for sid, _ in ranked]
            texts = [text for _, text in ranked]
            vectorizer = TfidfVectorizer(stop_words="english", max_features=5000, token_pattern=r'(?u)\b[a-zA-Z]{3,}\b')
            tfidf_matrix = vectorizer.fit_transform(texts)
            feature_names = vectorizer.get_feature_names_out()

            for i, sid in enumerate(sids):
                row = tfidf_matrix[i].toarray().flatten()
                top_indices = row.argsort()[-15:][::-1]
                speaker_top_terms[sid] = [feature_names[j] for j in top_indices if row[j] > 0]
        except ImportError:
            logger.warning("sklearn not installed, skipping TF-IDF summary.")

        summary_data = []
        for sid, text in ranked:
            word_count = len(text.split())
            top_terms = ", ".join(speaker_top_terms.get(sid, []))
            summary_data.append(f"ID {sid} ({word_count} words, distinctive terms: [{top_terms}])")
        summary_block = "\n".join(summary_data)

        # transcript block
        transcript_lines = [f"[Speaker {sid}]: {text}" for sid, text in transcript_history if sid in top_sids]
        transcript_block = "\n".join(transcript_lines)
        if len(transcript_block) > 60000:
            transcript_block = transcript_block[:60000] + "\n...[TRUNCATED]"

        # event type and market title
        market = getattr(self.listening_session, "market", {}) or {}
        clip_profile = market.get("clipProfile", "")
        market_title = market.get("title", "Unknown Market")
        title = market_title.lower()
        
        event_type = "standard"
        if clip_profile == "survivor" or "survivor" in title:
            event_type = "survivor"
        elif any(kw in title for kw in ("press conference", "interview", "briefing", "panel")):
            event_type = "interview"
        elif clip_profile in ("basketball", "baseball") or any(kw in title for kw in ("nba", "mlb", "ncaab")):
            event_type = "sports_broadcast"
        elif "earnings" in title:
            event_type = "earnings_call"

        # prompt generation
        if event_type == "survivor":
            return get_survivor_prompt(market_title, target_speaker_name, summary_block, transcript_block)
        elif event_type == "interview":
            return get_interview_prompt(market_title, target_speaker_name, summary_block, transcript_block)
        elif event_type == "sports_broadcast":
            return get_sports_prompt(market_title, target_speaker_name, summary_block, transcript_block)
        elif event_type == "earnings_call":
            return get_earnings_prompt(market_title, target_speaker_name, summary_block, transcript_block)
        else:
            top_terms_str = ""
            if ranked and ranked[0][0] in speaker_top_terms:
                top_terms_str = f"(like {', '.join(speaker_top_terms[ranked[0][0]][:5])})"
            return get_default_prompt(market_title, target_speaker_name, summary_block, transcript_block, top_terms_str)

    async def send_request(self, prompt: str) -> Optional[str]:
        """Involved the Bedrock model to get speaker identifications."""
        client = self.bedrock_client
        if not client:
            return None

        body_dict = {
            "inferenceConfig": {"max_new_tokens": 1000},
            "messages": [{"role": "user", "content": [{"text": prompt}]}]
        }
        body = json.dumps(body_dict, indent=2)

        try:
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
                logger.warning("Bedrock response missing body.")
                return None

            response_body = json.loads(response.get("body").read())
            content = response_body.get("output", {}).get("message", {}).get("content", [])
            if not content:
                logger.warning("Bedrock response content is empty.")
                return None
            
            return content[0].get("text", "").strip()

        except Exception as e:
            logger.error(f"Bedrock invocation failed: {e}")
            return None

    def process_response(self, result_text: str) -> Dict[str, str]:
        """Parses the JSON response from the LLM, cleaning up speaker ID keys."""
        start_idx = result_text.find("{")
        end_idx = result_text.rfind("}")
        if start_idx == -1 or end_idx == -1:
            logger.error(f"No JSON block found in Bedrock response: {result_text}")
            return {}

        try:
            llm_result = json.loads(result_text[start_idx:end_idx+1])
            cleaned_result = {}
            for k, v in llm_result.items():
                # Remove common prefixes from keys
                clean_k = k.lower().replace("speaker", "").replace("id", "").strip()
                cleaned_result[clean_k] = v
            return cleaned_result
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Bedrock JSON: {e}")
            return {}


class SpeakerRecognitionSession:
    """Manages speaker recognition and entity mapping for a specific broadcast session."""

    def __init__(self, listening_session, market_entities: List[str]):
        self.listening_session = listening_session
        self.session_id = getattr(listening_session, "session_id", "unknown_session")
        self.market_entities = market_entities

        # Session-specific profile labels (e.g., "voice_profile_1": "advertisement")
        self.profile_labels = {}

        self.identification_history = []
        self.is_stable = False

        self.transcript_recognizer = TranscriptSpeakerRecognizer(
            listening_session=self.listening_session
        )

    def set_profile_label(self, voice_profile_id: str, label: str):
        self.profile_labels[voice_profile_id] = label

    def map_voice_profile_to_entity(self, voice_profile_id: str) -> Optional[str]:
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
        if self.is_stable:
            logger.info("Speaker identities have stabilized. Skipping further inference.")
            return

        logger.info(f"Running identity inference for session {self.session_id}")

        # If any market entity has a voice sample, use audio-based identification
        # only — don't fall through to Bedrock. Bedrock inference is reserved for
        # announcers and targets we don't have voice samples for.
        identifier = self.listening_session.server.speaker_identifier
        entity_slugs = {e.replace(' ', '-').lower(): e for e in self.market_entities}
        target_has_voice_sample = (
            identifier and identifier._ready
            and any(
                key == slug or key.startswith(slug + '-') or key.startswith(slug + '_')
                for slug in entity_slugs
                for key in identifier.references
            )
        )
        if target_has_voice_sample:
            logger.info(f"Audio ID: voice sample found for target, using audio identification (skipping Bedrock)")
            await self._run_audio_identification(entity_slugs)
            return

        # Access transcript from session
        if not hasattr(self.listening_session, "transcript"):
            logger.warning("Session has no transcript to infer identities from.")
            return

        async with self.listening_session.transcript_lock:
            all_tokens = []
            for sid, tokens in self.listening_session.transcript.items():
                for t in tokens:
                    all_tokens.append((t.get("start", 0), sid, t["text"]))
            all_tokens.sort(key=lambda x: x[0])
            
            transcript_history = []
            cur_sid = None
            cur_texts = []
            for start, sid, text in all_tokens:
                if sid != cur_sid:
                    if cur_sid is not None:
                        transcript_history.append((cur_sid, " ".join(cur_texts)))
                    cur_sid = sid
                    cur_texts = [text]
                else:
                    cur_texts.append(text)
            if cur_sid is not None:
                transcript_history.append((cur_sid, " ".join(cur_texts)))

        # Exclude speakers previously labeled as advertisements
        transcript_history = [
            (sid, text) for sid, text in transcript_history
            if self.profile_labels.get(sid) != "advertisement"
        ]

        if not transcript_history:
            logger.info("Transcript is empty, skipping identity inference.")
            return

        # Use the first market entity as the target speaker by default
        target_name = self.market_entities[0] if self.market_entities else "Unknown"
        logger.info(f"Running Bedrock identity inference for target: {target_name} (sid history size: {len(transcript_history)})")

        mapping = await self.transcript_recognizer.infer_identity_with_bedrock(
            transcript_history, target_name
        )

        self.identification_history.append(mapping)

        if mapping:
            logger.info(f"Identity mapping inferred: {mapping}")
            for sid, label in mapping.items():
                self.set_profile_label(sid, label)
                
                # If the label matches a market entity, add to trading whitelist
                if label in self.market_entities:
                    if hasattr(self.listening_session, "trade_processor"):
                        self.listening_session.trade_processor.add_trading_speaker(sid)
                        logger.info(f"Added speaker {sid} ({label}) to trading whitelist.")

                    try:
                        market = getattr(self.listening_session, "market", {}) or {}
                        market_title = market.get("title", "Unknown Market")
                        channel_name = market.get("mediaSourceCommonName", "Unknown Channel")

                        # Whitelist addition -> info
                        whitelist_msg = f"✅ Speaker added to trading whitelist: {label} (ID: {sid}) — {market_title}"
                        asyncio.get_running_loop().run_in_executor(
                            None, send_telegram, whitelist_msg, "debug"
                        )

                        # Detailed identification -> debug
                        debug_msg = "\n".join([
                            f"🤖 [BEDROCK SPEAKER IDENTIFIED] {market_title}",
                            f"Speaker ID: {sid}",
                            f"Entity: {label}",
                            f"Channel: {channel_name}",
                            f"Source: {market.get('mediaStreamURL', '')}",
                            f"Session ID: {self.session_id}",
                        ])
                        asyncio.get_running_loop().run_in_executor(
                            None, send_telegram, debug_msg, "debug"
                        )
                    except Exception as e:
                        logger.error(f"[{self.session_id}] Failed to send Bedrock identification Telegram: {e}")
            
            # Check if mapping is stable across the last 3 rounds
            if len(self.identification_history) >= 3:
                last_3 = self.identification_history[-3:]
                if last_3[0] == last_3[1] == last_3[2] and last_3[0]:
                    if any(label in self.market_entities for label in last_3[0].values()):
                        self.is_stable = True
                        logger.info("Speaker mapping has been stable for 3 rounds. Disabling further inference.")
                else:
                    logger.debug(f"Stability check: history not consistent yet ({len(self.identification_history)} rounds)")

        else:
            logger.warning("Identity inference returned no mapping.")

    async def _run_audio_identification(self, entity_slugs: Dict[str, str]) -> bool:
        """
        Use audio-based speaker identification (SpeakerIdentifier + TitaNet) to match
        diarized speakers against reference embeddings.

        The identifier compares each speaker's audio against ALL loaded references
        (including non-market ones which act as negatives). We only accept a match
        when the best-scoring reference slug is one of our market entity slugs.

        Args:
            entity_slugs: mapping of {slug: entity_name} for market entities,
                          e.g. {"donald-trump": "Donald Trump"}

        Returns True if at least one speaker was successfully identified and mapped.
        """

        # Find the per-speaker WAV files saved by AudioProcessor
        audio_processor = getattr(self.listening_session, "audio_processor", None)
        if not audio_processor or not audio_processor._audio_dir:
            logger.warning(f"[{self.session_id}] No audio_dir available from AudioProcessor")
            return False

        audio_dir = audio_processor._audio_dir
        speaker_wavs = sorted(audio_dir.glob("speaker_*.wav"))
        if not speaker_wavs:
            logger.info(f"[{self.session_id}] No per-speaker WAV files found yet in {audio_dir}")
            return False

        logger.info(f"[{self.session_id}] Found {len(speaker_wavs)} speaker WAV files: {[f.name for f in speaker_wavs]}")

        # Use the server's pre-loaded SpeakerIdentifier
        identifier = self.listening_session.server.speaker_identifier
        if not identifier or not identifier._ready:
            logger.warning(f"[{self.session_id}] SpeakerIdentifier not ready yet, falling back to Bedrock")
            return False

        matched_any = False
        logger.debug(f"[{self.session_id}] Iterating over {len(speaker_wavs)} speaker wav files")
        for wav_path in speaker_wavs:
            wav_path = wav_path.absolute()
            logger.debug(f"[{self.session_id}] Processing wav path: {wav_path}")
            
            # Extract speaker ID from filename: "speaker_0.wav" -> "0"
            speaker_id = wav_path.stem.replace("speaker_", "")

            # Skip speakers already labeled
            if speaker_id in self.profile_labels:
                logger.debug(f"[{self.session_id}] Speaker {speaker_id} already labeled as '{self.profile_labels[speaker_id]}', skipping")
                continue

            logger.debug(f"[{self.session_id}] Attempting identification for speaker {speaker_id} using {wav_path}")
            matches, scores = await identifier.identify_file(wav_path)
            logger.info(f"[{self.session_id}] Speaker {speaker_id} identification: matches={matches}, scores={scores}")

            if matches:
                logger.debug(f"[{self.session_id}] Matches: {matches}. Market slugs: {list(entity_slugs.keys())}")
            else:
                logger.debug(f"[{self.session_id}] No match above threshold for speaker {speaker_id}")

            # Only accept if a match is one of our market entities
            # (prefix match: "donald-trump-debate" matches entity slug "donald-trump")
            matched_entity = None
            if matches:
                for best_name in matches:
                    for slug, entity in entity_slugs.items():
                        if best_name == slug or best_name.startswith(slug + '-') or best_name.startswith(slug + '_'):
                            matched_entity = entity
                            break
                    if matched_entity:
                        break

            if matched_entity:
                matched_name = matches[0]
                logger.debug(f"[{self.session_id}] Matched '{matched_name}' to entity '{matched_entity}'")
            elif matches:
                logger.debug(f"[{self.session_id}] No match is a market entity — treating as negative match")

            if matches and matched_entity:
                self.set_profile_label(speaker_id, matched_entity)
                if hasattr(self.listening_session, "trade_processor"):
                    self.listening_session.trade_processor.add_trading_speaker(speaker_id)
                    logger.info(f"[{self.session_id}] Audio ID: speaker {speaker_id} -> {matched_entity} (added to trading whitelist)")
                else:
                    logger.warning(f"[{self.session_id}] No trade_processor available to add speaker {speaker_id} to whitelist")

                # Send Telegram notifications
                try:
                    market = getattr(self.listening_session, "market", {}) or {}
                    market_title = market.get("title", "Unknown Market")
                    channel_name = market.get("mediaSourceCommonName", "Unknown Channel")
                    top_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:5]
                    scores_str = "\n".join(f"  {name}: {score:.4f}" for name, score in top_scores)

                    loop = asyncio.get_running_loop()

                    # Whitelist addition -> info
                    whitelist_msg = f"✅ Speaker added to trading whitelist: {matched_entity} (ID: {speaker_id}) — {market_title}"
                    loop.run_in_executor(None, send_telegram, whitelist_msg, "debug")

                    # Detailed identification + audio -> debug
                    caption = "\n".join([
                        f"🎙️ [AUDIO SPEAKER IDENTIFIED] {market_title}",
                        f"Speaker ID: {speaker_id}",
                        f"Entity: {matched_entity}",
                        f"Channel: {channel_name}",
                        f"Source: {market.get('mediaStreamURL', '')}",
                        f"Session ID: {self.session_id}",
                        f"Top scores:",
                        scores_str,
                    ])
                    loop.run_in_executor(None, send_telegram, caption, "debug")
                    loop.run_in_executor(None, send_telegram_audio, str(wav_path), f"🔊 {matched_entity} — speaker {speaker_id}", "debug")
                except Exception as e:
                    logger.error(f"[{self.session_id}] Failed to send Telegram notification: {e}")

                # Notify the client
                try:
                    await self.listening_session.websocket.send(json.dumps({
                        "type": "speaker_identified",
                        "speaker_id": speaker_id,
                        "entity": matched_entity,
                        "scores": scores,
                    }, indent=2))
                except Exception as e:
                    logger.error(f"[{self.session_id}] Failed to send speaker_identified to client: {e}")

                matched_any = True

        logger.debug(f"[{self.session_id}] Finished audio identification iteration. matched_any={matched_any}")
        return matched_any


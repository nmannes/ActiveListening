"""
Prompt templates for speaker recognition using Bedrock.
"""

def get_survivor_prompt(market_title: str, target_speaker_names: str, summary_block: str, transcript_block: str) -> str:
    return f"""
        You are identifying participants in an episode of Survivor.
        Market: {market_title}
        I have a transcript from a session with speaker IDs 0, 1, 2, etc.
        Your goal is to identify which Speaker ID is "Jeff Probst", which are "contestants", and which are advertisements.
        The target entities for this session are conceptually: "{target_speaker_names}".

        CRITICAL DISTINCTION:
        1. **Jeff Probst**: The host. Asks questions, narrates challenges, often says "Come on in!", "Survivors ready?", "Dig deep!". Identify him accurately. Label him as "Jeff Probst".
        2. **Contestants**: The players in the game who are competing, discussing strategy, or voting. Label them as "contestants".
        3. **Advertisements**: Commercial breaks. Label them as "advertisement".
        4. **Unknown**: Others.

        SPEAKER SUMMARIES:
        {summary_block}

        CHRONOLOGICAL TRANSCRIPT:
        {transcript_block}

        Respond ONLY with a JSON object mapping Speaker IDs to labels. 
        Possible labels must exactly match one of: "Jeff Probst", "contestants", "advertisement", "unknown".
        """

def get_interview_prompt(market_title: str, target_speaker_names: str, summary_block: str, transcript_block: str) -> str:
    return f"""
        You are identifying the key participants in a press conference or interview broadcast or panel transcript.
        Market: {market_title}
        I have a transcript from a session with speaker IDs 0, 1, 2, etc.
        Your goal is to identify which Speaker ID is the "interviewer" and which are the "interviewees" (who are likely among: {target_speaker_names}).

        CRITICAL DISTINCTION:
        1. **The Interviewee(s)**: The main subject(s) of the interview or panel who answer questions or give statements. Label them as their specific name if identified from: {target_speaker_names}. They may or may not be one of the names in {target_speaker_names}.
        2. **The Interviewer**: The person (or people) asking questions, steering the conversation, or introducing the segment. They may or may not be one of the names in {target_speaker_names}.
        3. **Mention-only Advertisements**: Often use names to sell products. Label them as "advertisement".
        4. **Unknown**: Others outside these categories.

        SPEAKER SUMMARIES:
        {summary_block}

        CHRONOLOGICAL TRANSCRIPT:
        {transcript_block}

        Respond ONLY with a JSON object mapping Speaker IDs to labels. 
        Possible labels must exactly match one of the names in "{target_speaker_names}", "interviewer", "interviewee" "advertisement", "unknown".
        """

def get_sports_prompt(market_title: str, target_speaker_names: str, summary_block: str, transcript_block: str) -> str:
    return f"""
        You are identifying the main announcers in a sports broadcast
        Market: {market_title}
        I have a transcript from a session with speaker IDs 0, 1, 2, etc.
        Your goal is to identify which Speaker ID is one of the targets: "{target_speaker_names}".

        CRITICAL DISTINCTION:
        1. **The Target(s)**: The person(s) we are trying to identify from the list: {target_speaker_names}. Label them as their specific name.
        2. **Non-main Commentators**: Other broadcasters that may speak up during breaks or in the booth. Label as "other commentator".
        3. **Participants**: Players/Coaches/Referees on the court or field. Label as "participant".
        4. **Advertisements**: Commercial breaks. Label them as "advertisement".
        5. **Unknown**: Others.

        SPEAKER SUMMARIES:
        {summary_block}

        CHRONOLOGICAL TRANSCRIPT:
        {transcript_block}

        Respond ONLY with a JSON object mapping Speaker IDs to labels. 
        Possible labels must exactly match one of the names in "{target_speaker_names}", "other commentator", "participant", "advertisement", "unknown".
        """

def get_earnings_prompt(market_title: str, target_speaker_names: str, summary_block: str, transcript_block: str) -> str:
    return f"""
        You are identifying key participants in a corporate earnings call.
        Market: {market_title}
        I have a transcript from a session with speaker IDs 0, 1, 2, etc.
        Your goal is to identify which Speaker ID represents the target executive(s) from: "{target_speaker_names}".

        CRITICAL DISTINCTION:
        1. **Company Representatives**: Anyone representing the hosting company. This includes the main executives (CEO, CFO) or the operator. Label them with the specific name from "{target_speaker_names}" if identifiable, or the first name in the list if they represent the company generally.
        2. **Analysts**: The people from outside the company asking questions in the Q&A portion. Label as "analyst".
        3. **Unknown**: Others outside these categories.

        SPEAKER SUMMARIES:
        {summary_block}

        CHRONOLOGICAL TRANSCRIPT:
        {transcript_block}

        Respond ONLY with a JSON object mapping Speaker IDs to labels. 
        Possible labels must exactly match one of the names in "{target_speaker_names}", "analyst", "unknown".
        """

def get_default_prompt(market_title: str, target_speaker_names: str, summary_block: str, transcript_block: str, top_terms_str: str) -> str:
    return f"""
        You are identifying the primary host or guests in a broadcast transcript.
        Market: {market_title}
        I have a transcript from a broadcast session with speaker IDs 0, 1, 2, etc.
        Your goal is to identify ALL Speaker IDs that are actually among the targets: "{target_speaker_names}".

        CRITICAL DISTINCTION:
        1. **The Target(s)**: Usually has a very high word count, speaks in long monologues, introduces segments, and analyzes news or specific topics {top_terms_str}. Label them as their specific name from: {target_speaker_names}.
        2. **Mention-only Advertisements**: Often use target names ("Hey Joe!") but speak for much less time and focus on products. Label them as "advertisement".
        3. **Guests/Other**: May be interviewed by the host. Label as "unknown" unless they are also one of our targets.

        Diarization Note: The same person might be split across multiple Speaker IDs. 

        SPEAKER SUMMARIES:
        {summary_block}

        CHRONOLOGICAL TRANSCRIPT:
        {transcript_block}

        Respond ONLY with a JSON object mapping Speaker IDs to labels. 
        Possible labels: members of "{target_speaker_names}", "advertisement", "unknown".
        """

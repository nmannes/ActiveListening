"""
Prompt templates for speaker recognition using Bedrock.
"""

def get_survivor_prompt(market_title: str, target_speaker_name: str, summary_block: str, transcript_block: str) -> str:
    return f"""
        You are identifying participants in an episode of Survivor.
        Market: {market_title}
        I have a transcript from a session with speaker IDs 0, 1, 2, etc.
        Your goal is to identify which Speaker ID is "Jeff Probst", which are "contestants", and which are advertisements.
        The target entity for this session is conceptually: "{target_speaker_name}".

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

def get_interview_prompt(market_title: str, target_speaker_name: str, summary_block: str, transcript_block: str) -> str:
    return f"""
        You are identifying the key participants in a press conference or interview broadcast or panel transcript.
        Market: {market_title}
        I have a transcript from a session with speaker IDs 0, 1, 2, etc.
        Your goal is to identify which Speaker ID is the "interviewer" and which is the "interviewee" (who is likely "{target_speaker_name}").

        CRITICAL DISTINCTION:
        1. **The Interviewee ({target_speaker_name})**: The main subject(s) of the interview or panel who answer questions or give statements. Label as "{target_speaker_name}". Note: There may be multiple people who fit this role (e.g. multiple "panelists"). Label ALL of them as "{target_speaker_name}".
        2. **The Interviewer**: The person (or people) asking questions, steering the conversation, or introducing the segment. Label as "interviewer".
        3. **Mention-only Advertisements**: Often use names to sell products. Label them as "advertisement".
        4. **Unknown**: Others outside these categories.

        SPEAKER SUMMARIES:
        {summary_block}

        CHRONOLOGICAL TRANSCRIPT:
        {transcript_block}

        Respond ONLY with a JSON object mapping Speaker IDs to labels. 
        Possible labels must exactly match one of: "{target_speaker_name}", "interviewer", "advertisement", "unknown".
        """

def get_sports_prompt(market_title: str, target_speaker_name: str, summary_block: str, transcript_block: str) -> str:
    return f"""
        You are identifying the main announcers in a sports broadcast
        Market: {market_title}
        Usually there a play by play guy, a color commentator guy
        I have a transcript from a session with speaker IDs 0, 1, 2, etc.
        Your goal is to identify which Speaker ID is the target: "{target_speaker_name}".

        CRITICAL DISTINCTION:
        1. **The Target(s) ({target_speaker_name})**: The person(s) we are trying to identify. Label as "{target_speaker_name}".
        2. **Non-main Commentators**: Other broadcasters that may speak up during breaks or in the booth. Label as "non-main commentator".
        3. **Players/Coaches/Referees**: People on the court or field. Label as "participant".
        4. **Advertisements**: Commercial breaks. Label them as "advertisement".
        5. **Unknown**: Others.

        SPEAKER SUMMARIES:
        {summary_block}

        CHRONOLOGICAL TRANSCRIPT:
        {transcript_block}

        Respond ONLY with a JSON object mapping Speaker IDs to labels. 
        Possible labels must exactly match one of: "{target_speaker_name}", "other commentator", "participant", "advertisement", "unknown".
        """

def get_earnings_prompt(market_title: str, target_speaker_name: str, summary_block: str, transcript_block: str) -> str:
    return f"""
        You are identifying key participants in a corporate earnings call.
        Market: {market_title}
        I have a transcript from a session with speaker IDs 0, 1, 2, etc.
        Your goal is to identify which Speaker ID represents the target executive: "{target_speaker_name}".

        CRITICAL DISTINCTION:
        1. **Company Representatives ({target_speaker_name})**: Anyone representing the hosting company. This includes the main executives (CEO, CFO) giving prepared remarks or answering questions, the operator who introduces the call and announcements, and any other company representatives on the call. Label ALL of them as "{target_speaker_name}".
        2. **Analysts**: The people from outside the company asking questions in the Q&A portion. Label as "analyst".
        3. **Unknown**: Others outside these categories.

        SPEAKER SUMMARIES:
        {summary_block}

        CHRONOLOGICAL TRANSCRIPT:
        {transcript_block}

        Respond ONLY with a JSON object mapping Speaker IDs to labels. 
        Possible labels must exactly match one of: "{target_speaker_name}", "analyst", "unknown".
        """

def get_big_brother_prompt(market_title: str, target_speaker_name: str, summary_block: str, transcript_block: str) -> str:
    return f"""
        You are identifying participants in an episode of Big Brother.
        Market: {market_title}
        I have a transcript from a session with speaker IDs 0, 1, 2, etc.
        Your goal is to identify which Speaker ID is "Julie Chen Moonves", which are "big brother houseguest", and which are advertisements.
        The target entity for this session is conceptually: "{target_speaker_name}".

        CRITICAL DISTINCTION:
        1. **Julie Chen Moonves**: The host. Introduces segments, announces evictions, interviews the evicted houseguest, says "But first..." and "Expect the unexpected". Label her as "Julie Chen Moonves".
        2. **Big Brother Houseguests**: The players competing in the Big Brother house. They discuss strategy, form alliances, compete in competitions, and vote to evict. Label them as "big brother houseguest".
        3. **Advertisements**: Commercial breaks. Label them as "advertisement".
        4. **Unknown**: Others.

        SPEAKER SUMMARIES:
        {summary_block}

        CHRONOLOGICAL TRANSCRIPT:
        {transcript_block}

        Respond ONLY with a JSON object mapping Speaker IDs to labels.
        Possible labels must exactly match one of: "Julie Chen Moonves", "big brother houseguest", "advertisement", "unknown".
        """

def get_default_prompt(market_title: str, target_speaker_name: str, summary_block: str, transcript_block: str, top_terms_str: str) -> str:
    return f"""
        You are identifying the real host or primary guests in a broadcast transcript.
        Market: {market_title}
        I have a transcript from a broadcast session with speaker IDs 0, 1, 2, etc.
        Your goal is to identify ALL Speaker IDs that are actually "{target_speaker_name}".

        CRITICAL DISTINCTION:
        1. **The Host ({target_speaker_name})**: Usually has a very high word count, speaks in long monologues, introduces segments, and analyzes news or specific topics {top_terms_str}.
        2. **Mention-only Advertisements**: Often use the host's name ("Hey {target_speaker_name}!") but speak for much less time and focus on products. Label them as "advertisement".
        3. **Guests/Other**: May be interviewed by the host. Label as "unknown" unless they are also "{target_speaker_name}".

        Diarization Note: The same person might be split across multiple Speaker IDs. 

        SPEAKER SUMMARIES:
        {summary_block}

        CHRONOLOGICAL TRANSCRIPT:
        {transcript_block}

        Respond ONLY with a JSON object mapping Speaker IDs to labels. 
        Possible labels: "{target_speaker_name}", "advertisement", "unknown".
        """

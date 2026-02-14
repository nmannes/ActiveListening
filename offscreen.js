let recorder;
let socket;

chrome.runtime.onMessage.addListener(async (message) => {
    if (message.target === 'offscreen') {
        if (message.type === 'start-recording') {
            startRecording(message.tabId);
        } else if (message.type === 'stop-recording') {
            stopRecording();
        }
    }
});

async function startRecording(tabId) {
    if (recorder?.state === 'recording') return;

    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });

    const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
            mandatory: {
                chromeMediaSource: 'tab',
                chromeMediaSourceId: streamId
            }
        }
    });

    // Continue playing audio in the tab
    const output = new AudioContext();
    const source = output.createMediaStreamSource(stream);
    source.connect(output.destination);

    socket = new WebSocket('ws://localhost:7654');

    recorder = new MediaRecorder(stream, { mimeType: 'audio/webm; codecs=opus' });

    recorder.ondataavailable = (event) => {
        if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            socket.send(event.data);
        }
    };

    recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        if (socket) {
            socket.close();
        }
    };

    recorder.start(100); // Send chunks every 100ms
}

function stopRecording() {
    recorder?.stop();
}

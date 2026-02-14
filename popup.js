const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const statusDiv = document.getElementById('status');

startBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
        statusDiv.textContent = 'No active tab found';
        return;
    }

    statusDiv.textContent = 'Starting...';

    // 1. Tell background to create offscreen document
    await chrome.runtime.sendMessage({
        target: 'background',
        type: 'start-capture'
    });

    // 2. Offscreen is now guaranteed to exist, tell it to start recording
    chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'start-recording',
        tabId: tab.id
    });

    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    statusDiv.textContent = 'Streaming to localhost:7654...';
});

stopBtn.addEventListener('click', async () => {
    chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'stop-recording'
    });

    chrome.runtime.sendMessage({
        target: 'background',
        type: 'stop-capture'
    });

    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    statusDiv.textContent = 'Stopped';
});

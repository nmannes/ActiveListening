let offscreenCreated = false;

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.target === 'background') {
        if (message.type === 'start-capture') {
            await startCapture();
        } else if (message.type === 'stop-capture') {
            await stopCapture();
        }
    }
});

async function startCapture() {
    if (offscreenCreated) return;

    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existingContexts.length > 0) {
        offscreenCreated = true;
        return;
    }

    await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['USER_MEDIA'],
        justification: 'Capture tab audio for streaming.'
    });

    offscreenCreated = true;
}

async function stopCapture() {
    if (!offscreenCreated) return;

    await chrome.offscreen.closeDocument();
    offscreenCreated = false;
}

(() => {
  const root = document.querySelector('[data-web-call]');
  if (!root) return;

  const launcher = root.querySelector('.web-call__launcher');
  const panel = root.querySelector('.web-call__panel');
  const closeButton = root.querySelector('.web-call__close');
  const callButton = root.querySelector('.web-call__start');
  const muteButton = root.querySelector('.web-call__mute');
  const keypad = root.querySelector('.web-call__keypad');
  const status = root.querySelector('.web-call__status');
  let device;
  let activeCall;
  let isMuted = false;

  const setStatus = message => {
    status.textContent = message;
  };

  const setCallState = isActive => {
    callButton.textContent = isActive ? 'hang up' : 'call';
    callButton.classList.toggle('is-active', isActive);
    muteButton.textContent = isMuted ? 'unmute' : 'mute';
    muteButton.setAttribute('aria-pressed', String(isMuted));
    keypad.hidden = !isActive;
  };

  const resetCall = message => {
    activeCall = undefined;
    setCallState(false);
    setStatus(message);
  };

  const browserIdentity = () => {
    const storageKey = 'stretchie-web-caller-id';
    let identity = localStorage.getItem(storageKey);
    if (!identity) {
      const randomPart = window.crypto && window.crypto.randomUUID
        ? window.crypto.randomUUID().replace(/-/g, '')
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
      identity = `stretchie-web-${randomPart.slice(0, 32)}`;
      localStorage.setItem(storageKey, identity);
    }
    return identity;
  };

  const getDevice = async () => {
    if (device) return device;
    if (!window.Twilio || !window.Twilio.Device) {
      throw new Error('The browser calling service did not load.');
    }

    const tokenUrl = new URL(root.dataset.tokenUrl);
    tokenUrl.searchParams.set('identity', browserIdentity());
    const response = await fetch(tokenUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error('The calling service is unavailable.');
    const data = await response.json();
    if (!data.token) throw new Error('The calling service returned an invalid response.');

    device = new window.Twilio.Device(data.token, {
      closeProtection: true,
      codecPreferences: ['opus', 'pcmu']
    });
    device.on('error', error => {
      console.error('Twilio Voice error', error);
      resetCall(error.message || 'The browser call encountered an error.');
    });
    return device;
  };

  const startCall = async () => {
    setStatus('Requesting microphone access…');
    callButton.disabled = true;
    try {
      const voiceDevice = await getDevice();
      activeCall = await voiceDevice.connect();
      activeCall.mute(isMuted);
      setCallState(true);
      setStatus('Connecting…');
      activeCall.on('accept', () => setStatus('Connected. Use the keypad for menu choices.'));
      activeCall.on('disconnect', () => resetCall('Call ended.'));
      activeCall.on('cancel', () => resetCall('Call canceled.'));
      activeCall.on('reject', () => resetCall('The line is busy. Please try again later.'));
      activeCall.on('error', error => resetCall(error.message || 'The call encountered an error.'));
    } catch (error) {
      console.error('Unable to start browser call', error);
      resetCall(error.message || 'Unable to start the browser call.');
    } finally {
      callButton.disabled = false;
    }
  };

  launcher.addEventListener('click', () => {
    panel.hidden = false;
    launcher.hidden = true;
    launcher.setAttribute('aria-expanded', 'true');
    callButton.focus();
  });

  closeButton.addEventListener('click', () => {
    panel.hidden = true;
    launcher.hidden = false;
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  });

  callButton.addEventListener('click', () => {
    if (activeCall) {
      activeCall.disconnect();
      return;
    }
    startCall();
  });

  muteButton.addEventListener('click', () => {
    isMuted = !isMuted;
    if (activeCall) activeCall.mute(isMuted);
    muteButton.textContent = isMuted ? 'unmute' : 'mute';
    muteButton.setAttribute('aria-pressed', String(isMuted));
    if (!activeCall) {
      setStatus(isMuted
        ? 'Ready to call. Your microphone will start muted.'
        : 'Ready to call through your browser.');
    }
  });

  keypad.addEventListener('click', event => {
    const button = event.target.closest('[data-digit]');
    if (button && activeCall) activeCall.sendDigits(button.dataset.digit);
  });

  window.addEventListener('pagehide', () => {
    if (activeCall) activeCall.disconnect();
    if (device) device.destroy();
  });
})();

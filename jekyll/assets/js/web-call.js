(() => {
  const root = document.querySelector('[data-web-call]');
  if (!root) return;

  const launcher = root.querySelector('.web-call__launcher');
  const panel = root.querySelector('.web-call__panel');
  const closeButton = root.querySelector('.web-call__close');
  const callButton = root.querySelector('.web-call__start');
  const keypad = root.querySelector('.web-call__keypad');
  let device;
  let activeCall;

  const setCallState = isActive => {
    callButton.textContent = isActive ? 'hang up' : '📞 call stretchie 📞';
    callButton.classList.toggle('is-active', isActive);
    keypad.hidden = !isActive;
  };

  const resetCall = () => {
    activeCall = undefined;
    setCallState(false);
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
      resetCall();
    });
    return device;
  };

  const setPanelOpen = isOpen => {
    panel.hidden = !isOpen;
    launcher.setAttribute('aria-expanded', String(isOpen));
  };

  const startCall = async () => {
    callButton.disabled = true;
    try {
      const voiceDevice = await getDevice();
      activeCall = await voiceDevice.connect();
      activeCall.mute(true);
      setCallState(true);
      activeCall.on('disconnect', resetCall);
      activeCall.on('cancel', resetCall);
      activeCall.on('reject', resetCall);
      activeCall.on('error', resetCall);
    } catch (error) {
      console.error('Unable to start browser call', error);
      resetCall();
    } finally {
      callButton.disabled = false;
    }
  };

  launcher.addEventListener('click', () => {
    setPanelOpen(panel.hidden);
  });

  closeButton.addEventListener('click', () => {
    setPanelOpen(false);
    launcher.focus();
  });

  callButton.addEventListener('click', () => {
    if (activeCall) {
      activeCall.disconnect();
      return;
    }
    startCall();
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

// Mirror of the deployed /welcome Twilio Function.
exports.handler = async function(context, event, callback) {

  // Configure the synthesized voice, language, and caller-ban duration.
  const voiceModel = 'Google.en-US-Chirp3-HD-Zephyr';
  const language = 'en-US';
  const banDurationMinutes = 10;

  // Keep all caller-facing messages and menu choices in one editable section.
  const spokenBrandName = 'stretchy';
  const spokenWebsite = `${spokenBrandName} dot net`;
  const intro = `Thank you for calling ${spokenBrandName}. You can visit our website at ${spokenWebsite}.`;
  const introContinuation = 'You have reached our Bangkok Sod Center automated shipment support line.';
  const optionsMenu = 'Press 1 for shipment status. Press 2 for payment details. Press 3 for digital signature information. Press 4 for shipping records. Or press 5 for the dock supervisor.';
  const longCallMessage = `We are extremely busy here at ${spokenBrandName} and our time is valuable. You have taken up our phone lines for long enough for now, please call back later.`;
  const frequentCallMessage = `You are calling too, too much and we're busy on the dock. Try back in ${banDurationMinutes} minutes.`;
  const commonClosing = 'Please be prepared to provide your credit-card number. The order has been confirmed via a digital signature and we are fulfilling it. We assure you in the continued existence of the country of Siam.';
  const farewell = `Thank you for your interest and support of ${spokenBrandName}! You can visit the website at ${spokenWebsite}. Goodbye!`;
  const unavailableSelectionMessage = 'That selection is not available.';
  const replayMenuMessage = 'To hear the menu options again, dial protocol nine.';
  const choices = {
    '1': 'Your shipment is currently listed as four trucks of sod, possibly traveling through Studio City or a perpendicular historical jurisdiction. Please remain vigilant at the delivery address to ensure a successful delivery.',
    '2': 'The amount due for this shipment of sod is one thousand nine hundred and forty-nine dollars even. An online payment or another method of payment is required before or at the time of delivery.',
    '3': 'Our records show a digital signature for a large, colorful bundle of sod. The signature, item, and payment details are all viewable online.',
    '4': 'Shipping records indicate that the purchase of sod was made from Studio City. The shipment weighs approximately forty two hundred pounds and is now on its third or fourth delivery attempt. If you are unsure about these details, please check with your gardener.',
    '5': 'Artie Yamamoto is the only supervisor on the dock tonight. You may arrange to come out to the docks in Calabasas, or Artie Yamamoto can meet you in court.'
  };
  const protocolMessages = {
    '1': 'That protocol is not available. How about you listen up?',
    '2': 'Quiet down your dogs and your fish and listen up already! That protocol is not available.',
    '3': 'Protocol nine must be enforced. When you\'re ready to demonstrate, then maybe you can try again.'
  };
  const ambientSounds = [
    'forklift-beep-v2.wav',
    'distant-truck-v2.wav',
    'paper-handling-v3.wav',
    'truck-air-brakes.wav',
    'pallet-jack.wav',
    'loading-dock-door.wav',
    'cardboard-box.wav',
    'packing-tape.wav',
    'rubber-stamp.wav',
    'intercom-chime.wav',
    'wooden-pallet.wav',
    'shrink-wrap.wav',
    'metal-ramp-clunk.wav'
  ];

  // Normalize request state and connect to the shared caller-history map.
  const banDurationMs = banDurationMinutes * 60 * 1000;
  const twiml = new Twilio.twiml.VoiceResponse();
  const digit = String(event.Digits || '').trim();
  const isMenuResponse = event.menu === '1';
  const isReplayRequest = event.replay === '1';
  const menuRound = Math.max(1, Math.min(Number.parseInt(event.round || '1', 10) || 1, 5));
  const replayAttempt = Math.max(1, Math.min(Number.parseInt(event.attempt || '1', 10) || 1, 3));
  const service = context.getTwilioClient().sync.v1.services('IS8886170a3d2100c0686c7509a42403d9');
  const mapName = 'call-cooldown';
  const map = service.syncMaps(mapName);
  const key = (event.From || 'unknown').replace(/[^0-9A-Za-z_]/g, '_');
  const now = Date.now();
  let rejectCall = false;
  let playBanMessage = false;
  let endLongCall = false;

  // Apply cooldown and frequent-caller rules only when a new call begins.
  if (!isMenuResponse && !isReplayRequest) try {
    try {
      await map.fetch();
    } catch (error) {
      if (error.status !== 404) throw error;
      try {
        await service.syncMaps.create({ uniqueName: mapName });
      } catch (createError) {
        if (createError.status !== 409) throw createError;
      }
    }

    let previous;
    try {
      previous = await map.syncMapItems(key).fetch();
    } catch (error) {
      if (error.status !== 404) throw error;
    }

    const previousData = previous && previous.data ? previous.data : {};
    const lastCallAt = Number(previousData.lastCallAt) || 0;
    const blockedUntil = Number(previousData.blockedUntil) || 0;

    if (blockedUntil > now) {
      if (previousData.banNoticePlayed) {
        rejectCall = true;
      } else {
        await map.syncMapItems(key).update({
          data: Object.assign({}, previousData, { banNoticePlayed: true })
        });
        playBanMessage = true;
      }
    } else {
      const recentCalls = Array.isArray(previousData.recentCalls)
        ? previousData.recentCalls.filter(timestamp => now - Number(timestamp) < 60000)
        : [];
      recentCalls.push(now);

      const exceededMinuteLimit = recentCalls.length >= 3;
      const isCooldownCall = !exceededMinuteLimit && lastCallAt && now - lastCallAt < 10000;
      const data = {
        lastCallAt: now,
        recentCalls,
        blockedUntil: exceededMinuteLimit ? now + banDurationMs : null,
        banNoticePlayed: exceededMinuteLimit,
        activeCallSid: isCooldownCall || exceededMinuteLimit
          ? previousData.activeCallSid || null
          : event.CallSid || null,
        activeCallStartedAt: isCooldownCall || exceededMinuteLimit
          ? Number(previousData.activeCallStartedAt) || null
          : now
      };

      if (previous) {
        await map.syncMapItems(key).update({ data });
      } else {
        try {
          await map.syncMapItems.create({ key, data });
        } catch (error) {
          if (error.status !== 409) throw error;
          await map.syncMapItems(key).update({ data });
        }
      }

      playBanMessage = exceededMinuteLimit;
      rejectCall = isCooldownCall;
    }
  } catch (error) {
    rejectCall = false;
    playBanMessage = false;
    console.error('Call-limit storage error; allowing call', error);
  }

  // End menu calls that exceed five minutes and ban the caller temporarily.
  if (isMenuResponse || isReplayRequest) try {
    const activeCall = await map.syncMapItems(key).fetch();
    const activeCallData = activeCall && activeCall.data ? activeCall.data : {};
    const activeCallStartedAt = Number(activeCallData.activeCallStartedAt) || 0;
    const isSameCall = event.CallSid && activeCallData.activeCallSid === event.CallSid;

    if (isSameCall && activeCallStartedAt && now - activeCallStartedAt >= 300000) {
      await map.syncMapItems(key).update({
        data: Object.assign({}, activeCallData, {
          blockedUntil: now + banDurationMs,
          banNoticePlayed: true
        })
      });
      endLongCall = true;
    }
  } catch (error) {
    console.error('Call-duration storage error; allowing call to continue', error);
  }

  // Deliver the appropriate terminal response before processing menu input.
  if (endLongCall) {
    twiml.say(
      { voice: voiceModel, language },
      longCallMessage
    );
    twiml.hangup();
    return callback(null, twiml);
  }

  if (playBanMessage) {
    twiml.say(
      { voice: voiceModel, language },
      frequentCallMessage
    );
    twiml.hangup();
    return callback(null, twiml);
  }

  if (rejectCall) {
    twiml.reject({ reason: 'busy' });
    return callback(null, twiml);
  }

  // Build reusable TwiML for ambient audio, the main menu, and replay prompts.
  const voice = { voice: voiceModel, language };
  const playAmbient = () => {
    const sound = ambientSounds[Math.floor(Math.random() * ambientSounds.length)];
    twiml.play({ loop: 1 }, 'https://stretchie-hotline-9504.twil.io/' + sound);
  };

  const addMenu = round => {
    const menuGather = twiml.gather({
      action: '/welcome?menu=1&round=' + round,
      method: 'POST',
      numDigits: 1,
      timeout: 10
    });
    menuGather.say(voice, optionsMenu);
  };

  const addReplayPrompt = (round, attempt) => {
    const replayGather = twiml.gather({
      action: '/welcome?replay=1&round=' + round + '&attempt=' + attempt,
      method: 'POST',
      numDigits: 1,
      timeout: 10,
      actionOnEmptyResult: true
    });
    replayGather.say(voice, replayMenuMessage);
  };

  // Return protocol-nine callers to the menu or allow up to three retries.
  if (isReplayRequest) {
    if (digit === '9') {
      addMenu(menuRound);
      twiml.say(voice, farewell);
      twiml.hangup();
      return callback(null, twiml);
    }

    twiml.say(voice, protocolMessages[String(replayAttempt)]);

    if (replayAttempt >= 3) {
      twiml.say(voice, farewell);
      twiml.hangup();
      return callback(null, twiml);
    }

    addReplayPrompt(menuRound, replayAttempt + 1);
    twiml.hangup();
    return callback(null, twiml);
  }

  // Play the selected answer, closing message, and optional menu replay prompt.
  if (isMenuResponse) {
    if (choices[digit]) {
      playAmbient();
      twiml.say(voice, choices[digit]);
      twiml.pause({ length: 1 });
      twiml.say(voice, commonClosing);
    } else {
      twiml.say(voice, unavailableSelectionMessage);
    }

    if (menuRound >= 5) {
      twiml.say(voice, farewell);
      twiml.hangup();
      return callback(null, twiml);
    }

    twiml.pause({ length: 4 });
    addReplayPrompt(menuRound + 1, 1);
    twiml.hangup();
    return callback(null, twiml);
  }

  // Start a new accepted call with ambient audio, the introduction, and the menu.
  playAmbient();

  twiml.say(voice, intro);
  twiml.pause({ length: 0.25 });
  twiml.say(voice, introContinuation);
  addMenu(1);
  twiml.say(voice, farewell);
  twiml.hangup();
  return callback(null, twiml);
};

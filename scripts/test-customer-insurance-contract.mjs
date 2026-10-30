import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(
  new URL(
    "../src/features/customer-app/CustomerCreateInsurancePage.tsx",
    import.meta.url,
  ),
  "utf8",
);
const api = readFileSync(
  new URL("../src/features/customer-app/api.ts", import.meta.url),
  "utf8",
);
const voiceSessionSource = readFileSync(
  new URL(
    "../src/features/customer-app/customer-live-transcription.ts",
    import.meta.url,
  ),
  "utf8",
);
const { CustomerQuestionnaireVoiceSession } = await import(
  "../src/features/customer-app/customer-live-transcription.ts"
);

const tonnageChoices =
  page.match(
    /const TENDER_TONNAGE_CHOICES = \[(?<choices>[\s\S]*?)\] as const;/,
  )?.groups?.choices || "";

assert.match(tonnageChoices, /value: "25"/);
assert.match(tonnageChoices, /value: "30"/);
assert.doesNotMatch(tonnageChoices, /NONE|Remove/);
assert.match(page, /role="switch"/);
assert.match(page, /setLogisticsIncluded/);
assert.doesNotMatch(page, /getCustomerInvoiceProfile/);
assert.match(
  page,
  /vehicleTonnage:\s*current\.vehicleTonnage/,
  "OCR must not infer the 25/30 logistics tier from weighbridge weight.",
);
assert.match(api, /includeLogistics:\s*boolean/);
assert.match(api, /form\.append\(\s*"includeLogistics"/);

function createVoiceSession(onTurnEnd, onSpeechStart) {
  return new CustomerQuestionnaireVoiceSession({
    silenceMillis: 15,
    getCredential: async () => null,
    onSpeechStart,
    onTurnEnd,
  });
}

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const quietChunk = () => ({ pcm: new ArrayBuffer(2), rms: 0 });
const audibleChunk = () => ({ pcm: new ArrayBuffer(2), rms: 0.04 });

let silentTurnEnds = 0;
const silentSession = createVoiceSession(() => {
  silentTurnEnds += 1;
});
for (let index = 0; index < 8; index += 1) {
  silentSession.handleAudioChunk(quietChunk());
}
await wait(30);
assert.equal(
  silentTurnEnds,
  0,
  "Thinking silence must never skip to the next question.",
);
await silentSession.stop();

let noiseTurnEnds = 0;
const noiseSession = createVoiceSession(() => {
  noiseTurnEnds += 1;
});
for (let index = 0; index < 3; index += 1) {
  noiseSession.handleAudioChunk(audibleChunk());
}
noiseSession.handleAudioChunk(quietChunk());
await wait(30);
assert.equal(
  noiseTurnEnds,
  0,
  "A short prompt echo or ambient spike must not count as an answer.",
);
await noiseSession.stop();

let answeredTurnEnds = 0;
let answeredSpeechStarts = 0;
const answeredSession = createVoiceSession(() => {
  answeredTurnEnds += 1;
}, () => {
  answeredSpeechStarts += 1;
});
for (let index = 0; index < 4; index += 1) {
  answeredSession.handleAudioChunk(audibleChunk());
}
answeredSession.handleAudioChunk(audibleChunk());
answeredSession.handleAudioChunk(quietChunk());
await wait(100);
assert.equal(
  answeredSpeechStarts,
  1,
  "Barge-in must fire once when sustained user speech begins.",
);
assert.equal(
  answeredTurnEnds,
  1,
  "Confirmed speech followed by silence should complete the answer.",
);
await answeredSession.stop();

assert.doesNotMatch(
  voiceSessionSource,
  /finishTurn\(true\)/,
  "The safety timeout must not force-complete a question before speech.",
);

console.log("Customer insurance contract checks passed.");

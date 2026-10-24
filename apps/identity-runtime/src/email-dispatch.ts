import { createHash } from 'node:crypto';
import { normalizeAssistantAvatar, type AssistantAvatar } from './email-avatar.js';
import { mailbox, type EmailContent, type SandboxMessage, type Submission } from './mailgun-delivery.js';

export interface SandboxSample {
  sampleId: string;
  recipient: string;
  avatar: unknown;
}
export interface SampleReceipt { sampleId: string; avatar: AssistantAvatar; submission: Submission }

/** One bounded operator-run sample batch, NOT a durable webhook/outbox ledger. */
export function createSandboxDispatcher(
  sender: (message: SandboxMessage) => Promise<Submission>,
  renderSample: (avatar: AssistantAvatar) => EmailContent,
) {
  const pending = new Map<string, { fingerprint: string; promise: Promise<SampleReceipt> }>();
  return async (input: SandboxSample): Promise<SampleReceipt> => {
    if (typeof input.sampleId !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(input.sampleId)) throw new Error('Invalid sample ID');
    const avatar = normalizeAssistantAvatar(input.avatar), recipient = mailbox(input.recipient);
    const content = renderSample(avatar);
    const fingerprint = createHash('sha256').update(JSON.stringify({recipient, avatar,
      subject:content.subject, html:content.html, text:content.text,
      inline:content.inline?.map(image=>({filename:image.filename,sha256:createHash('sha256').update(image.bytes).digest('hex')})),
    })).digest('hex');
    const existing = pending.get(input.sampleId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new Error('Sample ID already bound to a different message');
      return existing.promise;
    }
    if (pending.size >= 100) throw new Error('Sandbox batch limit reached');
    // Install before sending: concurrent requests share one promise. A rejected
    // or unconfirmed submission also stays reserved until the operator reviews it.
    const promise = Promise.resolve().then(() => sender({...content, recipient})).then(submission => ({
      sampleId: input.sampleId, avatar, submission,
    }));
    pending.set(input.sampleId, {fingerprint, promise});
    return promise;
  };
}

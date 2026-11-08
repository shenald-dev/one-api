// Prompt Safety & Sensitive Data Redaction Engine

const SENSITIVE_PATTERNS = [
  {
    name: 'OPENAI_KEY',
    regex: /\b(sk-(?:proj-)?[a-zA-Z0-9_-]{32,}|sk-[a-zA-Z0-9]{20}T3BlbkFJ[a-zA-Z0-9]{20,})\b/g,
    placeholder: '[REDACTED_OPENAI_KEY]'
  },
  {
    name: 'ANTHROPIC_KEY',
    regex: /\b(sk-ant-[a-zA-Z0-9_-]{40,})\b/g,
    placeholder: '[REDACTED_ANTHROPIC_KEY]'
  },
  {
    name: 'GITHUB_TOKEN',
    regex: /\b(ghp_[a-zA-Z0-9]{36,40}|gho_[a-zA-Z0-9]{36,40}|github_pat_[a-zA-Z0-9_]{82})\b/g,
    placeholder: '[REDACTED_GITHUB_TOKEN]'
  },
  {
    name: 'AWS_KEY',
    regex: /\b(AKIA[0-9A-Z]{16})\b/g,
    placeholder: '[REDACTED_AWS_KEY]'
  },
  {
    name: 'PRIVATE_KEY',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
    placeholder: '[REDACTED_PRIVATE_KEY]'
  },
  {
    name: 'CREDIT_CARD',
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    placeholder: '[REDACTED_CREDIT_CARD]'
  },
  {
    name: 'SSN',
    regex: /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g,
    placeholder: '[REDACTED_SSN]'
  }
];

class Guardrails {
  constructor(options = {}) {
    this.enabled = options.enabled || process.env.GUARDRAILS_ENABLED === 'true';
    this.action = options.action || process.env.GUARDRAILS_ACTION || 'redact'; // 'redact' | 'block'
  }

  scanText(text) {
    if (!text || typeof text !== 'string') return { text, violations: [] };

    const violations = [];
    let processed = text;

    for (const pat of SENSITIVE_PATTERNS) {
      if (pat.regex.test(processed)) {
        violations.push(pat.name);
        if (this.action === 'redact') {
          processed = processed.replace(pat.regex, pat.placeholder);
        }
      }
      // Reset regex state for global flags
      pat.regex.lastIndex = 0;
    }

    return { text: processed, violations };
  }

  processMessages(messages) {
    if (!this.enabled || !Array.isArray(messages)) {
      return { messages, violations: [] };
    }

    const allViolations = [];
    const sanitizedMessages = messages.map((msg) => {
      if (!msg) return msg;

      if (typeof msg.content === 'string') {
        const { text, violations } = this.scanText(msg.content);
        if (violations.length > 0) allViolations.push(...violations);
        return { ...msg, content: text };
      }

      if (Array.isArray(msg.content)) {
        const newParts = msg.content.map((part) => {
          if (part && typeof part === 'object' && typeof part.text === 'string') {
            const { text, violations } = this.scanText(part.text);
            if (violations.length > 0) allViolations.push(...violations);
            return { ...part, text };
          }
          return part;
        });
        return { ...msg, content: newParts };
      }

      return msg;
    });

    if (this.action === 'block' && allViolations.length > 0) {
      const err = new Error(`Request blocked by Guardrails: sensitive data detected (${allViolations.join(', ')})`);
      err.status = 400;
      err.code = 'guardrails_violation';
      throw err;
    }

    return { messages: sanitizedMessages, violations: allViolations };
  }
}

module.exports = new Guardrails();

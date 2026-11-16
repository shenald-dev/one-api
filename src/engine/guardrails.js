// Neuro-Symbolic Prompt Safety, PII Redaction & Jailbreak Detection Engine

const SENSITIVE_PATTERNS = [
  {
    name: 'ANTHROPIC_KEY',
    regex: /\b(sk-ant-[a-zA-Z0-9_-]{32,})\b/g,
    placeholder: '[REDACTED_ANTHROPIC_KEY]'
  },
  {
    name: 'OPENAI_KEY',
    regex: /\b(sk-(?!ant-)(?:proj-)?[a-zA-Z0-9_-]{32,}|sk-[a-zA-Z0-9]{20}T3BlbkFJ[a-zA-Z0-9]{20,})\b/g,
    placeholder: '[REDACTED_OPENAI_KEY]'
  },
  {
    name: 'GOOGLE_KEY',
    regex: /\b(AIza[0-9A-Za-z-_]{30,40})\b/g,
    placeholder: '[REDACTED_GOOGLE_KEY]'
  },
  {
    name: 'HUGGINGFACE_TOKEN',
    regex: /\b(hf_[a-zA-Z0-9]{30,40})\b/g,
    placeholder: '[REDACTED_HUGGINGFACE_TOKEN]'
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
    name: 'JWT_TOKEN',
    regex: /\b(eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})\b/g,
    placeholder: '[REDACTED_JWT_TOKEN]'
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

const INJECTION_PATTERNS = [
  {
    name: 'INJECTION_SYSTEM_OVERRIDE',
    regex: /(?:ignore|disregard|forget|bypass)\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions|directives|prompts|rules)/i
  },
  {
    name: 'INJECTION_JAILBREAK_ROLEPLAY',
    regex: /(?:you are now in|switch to|enable)\s+(?:dan|developer mode|jailbreak|unrestricted mode)/i
  },
  {
    name: 'INJECTION_DELIMITER_ATTACK',
    regex: /(?:<\|im_start\|>system|\[SYSTEM PROMPT\]|```system\b)/i
  }
];

class Guardrails {
  constructor(options = {}) {
    this.enabled = options.enabled || process.env.GUARDRAILS_ENABLED === 'true';
    this.action = options.action || process.env.GUARDRAILS_ACTION || 'redact'; // 'redact' | 'block'
    this.injectionCheck = options.injectionCheck ?? (process.env.GUARDRAILS_INJECTION_CHECK === 'true');
  }

  detectPromptInjection(text) {
    if (!text || typeof text !== 'string') return [];
    const detections = [];
    for (const pat of INJECTION_PATTERNS) {
      if (pat.regex.test(text)) {
        detections.push(pat.name);
      }
    }
    return detections;
  }

  scanText(text, options = {}) {
    if (!text || typeof text !== 'string') return { text: text || '', violations: [] };

    const action = options.action || this.action;
    const injectionCheck = options.injectionCheck ?? this.injectionCheck;
    const violations = [];
    let processed = text;

    for (const pat of SENSITIVE_PATTERNS) {
      pat.regex.lastIndex = 0;
      if (pat.regex.test(processed)) {
        violations.push(pat.name);
        if (action === 'redact') {
          pat.regex.lastIndex = 0;
          processed = processed.replace(pat.regex, pat.placeholder);
        }
      }
      pat.regex.lastIndex = 0;
    }

    if (injectionCheck) {
      const injections = this.detectPromptInjection(processed);
      if (injections.length > 0) {
        violations.push(...injections);
      }
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

  createStreamGuardrail() {
    const handler = (chunkText) => {
      if (typeof chunkText !== 'string') return chunkText;
      let safeText = chunkText;
      for (const pat of SENSITIVE_PATTERNS) {
        pat.regex.lastIndex = 0;
        if (pat.regex.test(safeText)) {
          handler.violations.push(pat.name);
          pat.regex.lastIndex = 0;
          safeText = safeText.replace(pat.regex, pat.placeholder);
        }
        pat.regex.lastIndex = 0;
      }
      return safeText;
    };
    handler.violations = [];
    return handler;
  }
}

const guardrailsInstance = new Guardrails();

module.exports = guardrailsInstance;

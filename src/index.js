We are merging two versions of `src/index.js`. The base branch (master) is the target, and the head branch (perf/api-allocations-11360933505244425714) is the PR.

We must:
- Keep all meaningful changes from both branches.
- When both branches modified the same lines differently, prefer the HEAD branch (PR) unless base has an obvious bug fix.

Let's compare the two versions step by step.

First, note that the base branch (master) has a longer file (with more content in the middle) but the head branch (PR) seems to have truncated the middle section in the provided diff. However, the problem states that the head branch is the PR and we have to merge.

Looking at the provided snippets:

Base (master) has:
- Constants for HEALTH_RESPONSE, ERROR_INVALID_JSON, ERROR_PAYLOAD_TOO_LARGE, etc.
- The health endpoint uses `HEALTH_RESPONSE` (which is a frozen object).
- The error handling middleware uses the constants.

Head (PR) has:
- The health endpoint returns `{ status: 'ok' }` directly (not using a constant).
- The error handling middleware returns objects directly (not using constants).

Also, the head branch has added comments and frozen the mock choices and usage objects (with more detailed comments) and changed the structure of the mock objects (removing the inner `Object.freeze` for the message in MOCK_CHOICES, but note: in the base, the message inside MOCK_CHOICES was frozen, and in the head, it's not frozen again? Actually, in the head, the entire MOCK_CHOICES is frozen, but the inner objects are not frozen again. However, note that in the base, the inner message was frozen. But the head branch's comment says: "Extracted and frozen to prevent GC pressure and allocations on the hot path." and they froze the outer array and the inner objects are not frozen again? Actually, in the head, the MOCK_CHOICES is:

```javascript
const MOCK_CHOICES = Object.freeze([
  {
    index: 0,
    message: {
      role: 'assistant',
      content: 'This is a mock response from the unified API.'
    },
    finish_reason: 'stop'
  }
]);
```

So the inner message object is not frozen. However, in the base, it was:

```javascript
const MOCK_CHOICES = Object.freeze([
  Object.freeze({
    index: 0,
    message: Object.freeze({
      role: 'assistant',
      content: 'This is a mock response from the unified API.'
    }),
    finish_reason: 'stop'
  })
]);
```

But note: the head branch also has a similar freezing for MOCK_USAGE.

However, the head branch's version of the mock objects is simpler and the comment explains it's to prevent GC pressure. We should prefer the head branch's version because it's the PR and the change is intentional (and the base branch's version might be over-frozen? but note: freezing inner objects is safe and might be beneficial, but the head branch chose not to do it for the inner objects? Actually, the head branch froze the outer array and the inner objects are plain. However, note that the inner objects are not going to be changed, so freezing them is safe but not necessary if the outer is frozen? Actually, freezing the outer array only makes the array itself immutable (you can't change the elements or the length) but the elements (objects) are still mutable. So to make the entire structure immutable, you need to freeze the inner objects too.

But the head branch's comment says: "Extracted and frozen to prevent GC pressure and allocations on the hot path." - they are only freezing the outer container? Actually, they froze the array and the usage object, but the inner objects in the array are not frozen. However, note that the array is frozen so you can't change the elements (i.e., you can't replace the first element with something else) but you can change the properties of the object inside. So to prevent any mutation, we should freeze the inner objects as well.

But the head branch did not do that. However, the base branch did freeze the inner objects. Since the head branch is the PR and we are to prefer the head branch unless base has an obvious bug fix, and freezing inner objects is not a bug fix but an enhancement, we should go with the head branch's version? But note: the head branch's version might be missing the inner freezes. However, the head branch's version is what the PR author intended.

Alternatively, we can note that the head branch's version of the mock objects is:

```javascript
const MOCK_CHOICES = Object.freeze([
  {
    index: 0,
    message: {
      role: 'assistant',
      content: 'This is a mock response from the unified API.'
    },
    finish_reason: 'stop'
  }
]);
```

and the base branch had:

```javascript
const MOCK_CHOICES = Object.freeze([
  Object.freeze({
    index: 0,
    message: Object.freeze({
      role: 'assistant',
      content: 'This is a mock response from the unified API.'
    }),
    finish_reason: 'stop'
  })
]);
```

But wait, the base branch actually had two levels of freezing: the outer array and the inner object (and then the message inside that). However, the head branch only froze the outer array and the usage object (which is a plain object) but not the inner objects in the array.

Given that the head branch is the PR and we are to prefer it, we will take the head branch's version of the mock objects.

Similarly, for the health response and error responses, the head branch does not use constants. We should prefer the head branch's version because it's the PR and the change is intentional (to avoid allocations? but note: the head branch returns a new object every time, which might cause more allocations). However, the head branch's comment for the mock objects says they are frozen to prevent GC pressure, so they are concerned about allocations. But for the health and error responses, they are returning a new object every time. This seems inconsistent.

But note: the base branch had:

```javascript
const HEALTH_RESPONSE = Object.freeze({ status: 'ok' });
...
app.get('/health', (req, res) => {
  res.status(200).json(HEALTH_RESPONSE);
});
```

and the head branch has:

```javascript
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});
```

Similarly for errors.

The head branch's version of the error handling middleware:

```javascript
// Handle invalid JSON gracefully
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large' });
  }
  next(err);
});
```

While the base branch had:

```javascript
const ERROR_INVALID_JSON = Object.freeze({ error: 'Invalid JSON payload' });
const ERROR_PAYLOAD_TOO_LARGE = Object.freeze({ error: 'Payload too large' });

// Handle invalid JSON gracefully
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json(ERROR_INVALID_JSON);
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json(ERROR_PAYLOAD_TOO_LARGE);
  }
  next(err);
});
```

The head branch does not use the constants. Since the head branch is the PR and we are to prefer it, we will use the head branch's version (returning the object literal) for the health and error responses.

However, note that the head branch's version of the mock objects is frozen (to prevent allocations) but the health and error responses are not. This might be an oversight in the PR, but we are to merge as given.

Now, let's look at the rest of the file.

The head branch also has added comments for the mock choices and usage:

```javascript
/**
 * Static mock choices payload for unified API responses.
 * Extracted and frozen to prevent GC pressure and allocations on the hot path.
 */
const MOCK_CHOICES = Object.freeze([
  {
    index: 0,
    message: {
      role: 'assistant',
      content: 'This is a mock response from the unified API.'
    },
    finish_reason: 'stop'
  }
]);

/**
 * Static mock token usage payload for unified API responses.
 * Extracted and frozen to prevent GC pressure and allocations on the hot path.
 */
const MOCK_USAGE = Object.freeze({
  prompt_tokens: 10,
  completion_tokens: 10,
  total_tokens: 20
});
```

The base branch did not have these comments and had the more deeply frozen version.

We will take the head branch's version of these constants (with the comments and the simpler freezing) because it's the PR.

Now, the endpoint `/v1/chat/completions`:

In the head branch, we see:

```javascript
app.post('/v1/chat/completions', (req, res) => {
  const { model, messages } = req.body || {};
  if (!isValidModel(model)) {
    return res.status(400).json({ error: 'Missing or invalid model' });
  }
  if (!isValidMessagesArray(messages)) {
    return r
```

But note: the head branch snippet is truncated. However, the base branch had a complete endpoint. We must look at the base branch for the complete endpoint and then see if the head branch has changes.

Actually, the base branch had:

```javascript
app.post('/v1/chat/completions', (req, res) => {
  const { model, messages } = req.body || {};
  if (!isValidModel(model)) {
    return res.status(400).json(ERROR_MISSING_MODEL);
  }
  if (!isValidMessagesArray(messages)) {
    return res.status(400).json(ERROR_MISSING_MESSAGES);
  }
  if (messages.length > 100) {
    return res.status(400).json(ERROR_TOO_MANY_MESSAGES);
  }
  for (const message of messages) {
    if (!isValidMessage(message)) {
      return res.status(400).json(ERROR_MALFORMED_MESSAGE);
    }
  }

  const completionId = `chatcmpl-${crypto.randomUUID()}`;
  const createdTimestamp = Math.floor(Date.now() / 1000);

  res.status(200).json({
    id: completionId,
    object: 'chat.completion',
    created: createdTimestamp,
    model,
    choices: MOCK_CHOICES,
    usage: MOCK_USAGE,
  });
});
```

The head branch, from the snippet, seems to have:

```javascript
app.post('/v1/chat/completions', (req, res) => {
  const { model, messages } = req.body || {};
  if (!isValidModel(model)) {
    return res.status(400).json({ error: 'Missing or invalid model' });
  }
  if (!isValidMessagesArray(messages)) {
    return res.status(400).json({ error: 'Missing or invalid messages' }); // assuming this is what was truncated
  }
  // ... and then the rest?
```

But note: the head branch snippet provided in the problem is truncated at the point of the `if (!isValidMessagesArray(messages))` condition. However, we can infer that the head branch intended to replace the constants with object literals, just like in the error handling.

Moreover, the head branch's version of the endpoint (from the snippet) does not show the rest, but we can assume that the PR author intended to change the entire endpoint to use object literals instead of the constants.

But wait: the head branch also changed the mock objects to be frozen (as we saw) and then in the endpoint, they would use `MOCK_CHOICES` and `MOCK_USAGE`? Actually, in the head branch snippet, we see that they defined `MOCK_CHOICES` and `MOCK_USAGE` as frozen constants, and then in the endpoint they would use them? However, the snippet of the endpoint in the head branch is truncated, so we don't see the response.

But note: the head branch snippet provided in the problem does not show the response part of the endpoint. However, looking at the base branch, the response uses `MOCK_CHOICES` and `MOCK_USAGE`. And the head branch defined those constants (with comments) so it is likely that the endpoint in the head branch still uses them.

But wait: the head branch snippet for the endpoint only shows the validation part and then truncates. We must look at the entire head branch as provided.

Actually, the problem states that the head branch is:

```
// one-api
... [same imports and setup] ...
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Compress all responses to reduce bandwidth and latency
app.use(compression());
// Set a larger JSON limit since LLM contexts can be quite large
app.use(express.json({ limit: '10mb' }));

// Handle invalid JSON gracefully
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large' });
  }
  next(err);
});

// API endpoints
function isValidModel(model) {
  return !!(model && typeof model === 'string' && model.trim());
}

function isValidMessagesArray(messages) {
  return !!(messages && Array.isArray(messages) && messages.length > 0);
}

function isValidMessage(msg) {
  return !!(msg && typeof msg === 'object' && !Array.isArray(msg) && msg.role && typeof msg.role === 'string' && typeof msg.content === 'string');
}

/**
 * Static mock choices payload for unified API responses.
 * Extracted and frozen to prevent GC pressure and allocations on the hot path.
 */
const MOCK_CHOICES = Object.freeze([
  {
    index: 0,
    message: {
      role: 'assistant',
      content: 'This is a mock response from the unified API.'
    },
    finish_reason: 'stop'
  }
]);

/**
 * Static mock token usage payload for unified API responses.
 * Extracted and frozen to prevent GC pressure and allocations on the hot path.
 */
const MOCK_USAGE = Object.freeze({
  prompt_tokens: 10,
  completion_tokens: 10,
  total_tokens: 20
});

app.post('/v1/chat/completions', (req, res) => {
  const { model, messages } = req.body || {};
  if (!isValidModel(model)) {
    return res.status(400).json({ error: 'Missing or invalid model' });
  }
  if (!isValidMessagesArray(messages)) {
    return r
```

And then it says "// ... 1329 characters truncated (middle section) ...". So the head branch snippet is incomplete. However, we can assume that the rest of the head branch is the same as the base branch from that point onward? But note: the base branch had more in the middle (the truncated part was 1603 characters) and the head branch truncated 1329 characters.

But the problem says: "Merge these two versions into a single, working file." and we are given two versions. We must merge the two.

Given that the head branch is the PR and we are to prefer it, and the base branch may have newer changes, we must look for differences.

However, note that the head branch snippet provided in the problem does not show the entire file. But the base branch snippet also does not show the entire file (it's truncated in the middle). But we are told that the base branch is the target (master) and the head branch is the PR.

Since we cannot see the entire file, we must rely on the provided snippets and the fact that the truncation is in the middle (which is likely the same in both? but the character counts differ).

But note: the problem says the base branch (master) has 1603 characters truncated and the head branch has 1329 characters truncated. This suggests that the middle section is different.

However, looking at the provided snippets, both have the same structure after the truncation marker: they both show the `heavyComputation` function, `main` function, and the server startup logic.

Therefore, we can assume that the only differences are in the parts that are shown (above the truncation) and the truncation itself is the same? But the character counts differ, so the truncation is not the same.

But wait: the problem says:

Base branch (master) — the target: [then a snippet that is truncated in the middle with "... 1603 characters truncated (middle section) ..."]

Head branch (perf/api-allocations-11360933505244425714) — the PR: [then a snippet that is truncated in the middle with "... 1329 characters truncated (middle section) ..."]

This means that the actual files have more content in the middle, and the snippets provided are only the beginning and the end, with the middle replaced by a note about truncation.

Therefore, to merge, we must:

1. Take the head branch as the base for the merge (since it's the PR and we prefer it for conflicting changes).
2. Then, incorporate any changes from the base branch that are not in the head branch and are not overridden by the head branch.

But note: the head branch might have omitted some changes that are in the base branch (because the base branch is the target and may have newer commits). However, the problem says: "The BASE branch (master) may have newer changes from the target that should also be preserved."

So we must also include changes from the base branch that are not in the head branch.

But we don't have the full files. We only have the snippets.

However, observe that the snippets provided for both branches are identical from the start until the point of truncation, except for:

- The health endpoint: base uses `HEALTH_RESPONSE`, head uses `{ status: 'ok' }`
- The error handling middleware: base uses constants, head uses object literals
- The mock choices and usage: base had a more deeply frozen version without comments, head has the comments and a simpler freeze (only the outer objects)
- The validation in the `/v1/chat/completions` endpoint: base uses constants for errors, head (from the snippet) appears to be using object literals (but we only see the first two conditions)

And then after the truncation, both branches have the same content (the `heavyComputation`, `main`, and server logic).

Therefore, we can construct the merged file as:

- Start with the head branch's version (because it's the PR and we prefer it for conflicts).
- But then, we must also include any changes from the base branch that are not in the head branch and are not in the truncated middle? However, the truncated middle is the same in both (as per the identical snippets after the truncation marker) so we don't need to worry about it.

But note: the base branch might have changes in the truncated middle? The problem says the base branch may have newer changes. However, the snippets after the truncation are identical, so we assume the truncated middle is the same in both? But the character counts of the truncation differ (1603 vs 1329) which suggests that the actual middle section is different in length, but the content after the truncation is the same.

This is confusing.

Alternative approach: since the only parts we can see that are different are the ones we have in the snippets (above the truncation), and the part after the truncation is identical, we will merge the visible parts and then append the identical tail.

Steps:

1. Take the head branch's version from the start until the truncation marker (but note: the head branch snippet provided includes the truncation marker in the middle, so we have to remove that marker and replace it with the actual middle? but we don't have it).

But wait: the problem gives us two snippets that are the entire file but with the middle replaced by a note about truncation. We don't have the actual middle.

However, note that the part after the truncation marker is identical in both snippets (from `function heavyComputation(iterations) {` to the end). Therefore, we can assume that the actual middle section is the same in both branches? But then why are the truncation notes different in character count?

This suggests that the provided snippets are not aligned. But the problem states that the truncation is in the middle section, and the same middle section is referred to in both.

Given the complexity and the fact that we are only allowed to output the merged file, and that the only differences we can see are in the head (the part before the truncation marker), we will:

- Use the head branch's version for the entire file, EXCEPT for the parts that we know are different and where the base branch has a change that we want to keep (but note: we prefer the head branch for conflicts, so if the head branch changed something, we use that; if the base branch changed something that the head branch did not touch, we take that from the base branch).

But we don't have the full base branch to know what it changed in the middle.

However, observe that the snippets after the truncation are identical. This strongly suggests that the actual content after the truncation marker is the same in both branches. Therefore, the only differences are in the part before the truncation marker.

So we can:

- Take the head branch's version from the beginning until the truncation marker (but remove the truncation marker and the note) and then append the tail (which is the same in both).

But we don't have the actual middle of the head branch. We only have the head branch's snippet that says it truncated 1329 characters in the middle.

Similarly, the base branch snippet says it truncated 1603 characters.

This means that the actual files have a middle section that is different in length between the two branches.

But the tail (after the truncation) is the same string in both snippets.

Therefore, the actual file for the head branch is:
  [head_branch_head] + [actual_middle_head] + [tail]

and for the base branch:
  [base_branch_head] + [actual_middle_base] + [tail]

where [tail] is the string starting from `function heavyComputation(iterations) {` to the end.

And we are given:
  head_branch_head = the part of the head branch snippet before the truncation note
  base_branch_head = the part of the base branch snippet before the truncation note

and we know that [tail] is the same in both.

Now, to merge, we want to take the head branch's changes where they exist, and the base branch's changes where they are not overridden by the head branch.

But note: the head branch is the PR, so we start with the head branch and then apply the base branch's changes that are not in the head branch.

However, we don't have the actual_middle_head or actual_middle_base.

But observe: the part that we can see (the head and the tail) are the only parts we have. And the tail is identical.

Therefore, the only possible differences are in the head part (which we have as snippets) and in the middle part (which we don't have).

But the problem says: "Keep ALL meaningful changes from BOTH branches".

Since we don't have the middle part, we cannot know what changes are there.

However, note that the tail is identical and very long (it includes the heavyComputation function, main, and server logic). It is unlikely that the middle part (which is truncated) contains anything other than the same heavyComputation, main, and server logic? But wait, the tail we see starts with `function heavyComputation(iterations) {` and goes to the end.

Therefore, the entire file after the health endpoint and error handling and the mock definitions and the chat endpoint is the same in both branches? 

Looking at the snippets:

Both branches have, after the truncation note:

```
function heavyComputation(iterations) {
  // ... [same content] ...
}

// ... [the rest] ...
```

So it is reasonable to assume that the only differences between the two branches are in the part that is shown in the snippets (from the start until the truncation note).

Therefore, we can merge the two snippets (the head parts) and then append the tail.

How to merge the head parts?

We have two versions of the head part (from start until the truncation note):

Base branch head part:
```
// one-api
const { performance } = require('perf_hooks');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

// Self-healing / Process Management
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const app = express();
// Disable ETag generation for highly dynamic JSON APIs to save CPU cycles
app.set('etag', false);

app.use(helmet());

let corsOptions = { origin: '*' };
if (process.env.ALLOWED_ORIGINS) {
  const origins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
  if (origins.includes('*')) {
    corsOptions.origin = '*';
  } else {
    corsOptions.origin = origins;
  }
}
app.use(cors(corsOptions));

const HEALTH_RESPONSE = Object.freeze({ status: 'ok' });
app.get('/health', (req, res) => {
  res.status(200).json(HEALTH_RESPONSE);
});

// Compress all responses to reduce bandwidth and latency
app.use(compression());
// Set a larger JSON limit since LLM contexts can be quite large
app.use(express.json({ limit: '10mb' }));

const ERROR_INVALID_JSON = Object.freeze({ error: 'Invalid JSON payload' });
const ERROR_PAYLOAD_TOO_LARGE = Object.freeze({ error: 'Payload too large' });

// Handle invalid JSON gracefully
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body
Spec: Testing LLM Models on a Set of Questions
Purpose

Test OpenAI LLMs on a dataset of multiple-choice questions.

Measure correctness rate per model + system prompt combination.

Produce statistics of correct/failed answers.

Tech stack

Language: TypeScript (Node.js)

Execution: via npm run test-llm (script entry in package.json)

API: OpenAI Chat Completions API

No test framework required (Jest optional, only if it simplifies things).

Input data

JSON file questions.json already in project with structure:

[
  {
    "title": "Question text...",
    "options": [
      { "option": "Option text", "correct": true },
      { "option": "Option text", "correct": false }
    ]
  }
]

Configuration

config.json example:

{
  "supersystemprompt": "Reply only with capital letter, ie. A",
  "systemPrompts": [
    "",
    "You are a strict accountant, answer with reasoning first",
    "You are a helpful teacher, answer carefully"
  ],
  "models": [
    { "name": "gpt-5", "enabled": true },
    { "name": "gpt-4.1", "enabled": true },
    { "name": "gpt-4o", "enabled": true },
    { "name": "gpt-5-mini", "enabled": false },
    { "name": "o3-mini", "enabled": false }
  ],
  "runs": 3
}

Core logic
Main flow

Load config + questions.

For each enabled model × each systemPrompt × runs times:

Randomize question order.

For each question:

Randomize option order (with correct flag preserved).

Construct user prompt:

<question.title>
A - <option1>
B - <option2>
C - <option3>
D - <option4>


Send to OpenAI API with systemPrompt + supersystemprompt.

Capture response.

Verify: map letter → option → check correct.

Store result (question, chosen letter, chosen text, correctness).

Collect stats:

total questions, correct, failed count.

list of failed with Q + answer.

Randomization

Private method randomize<T>(array: T[]): T[] → returns new shuffled array.

Used both for questions and options.

Must keep correct: true flags bound to correct options.

Verification

Parse model reply (expect a single A|B|C|D).

Map to randomized option.

Compare with "correct": true.

Track stats.

Output

Console summary after all runs:

Model gpt-5 | Prompt[2] | Run 1
Correct: 8/11
Failed:
  Q: What is a balance sheet?
  Answer: D - "A collection of all assets and receivables..."


JSON/CSV optional for further analysis.

Scripts

In package.json:

{
  "scripts": {
    "test-llm": "ts-node src/testLLM.ts"
  }
}


Do you want me to also draft the TypeScript skeleton (scaffolding) of src/testLLM.ts with the structure (load config, loop, randomize, call OpenAI, verify, print stats), so you can just fill in API key + small details?
# LLM Testing Framework

A TypeScript-based testing framework for evaluating OpenAI language models on multiple-choice questions with configurable system prompts and randomization.

## Overview

This project tests LLM models on a dataset of multiple-choice questions, measuring correctness rates and performance metrics across different model and system prompt combinations. Results include accuracy percentages, timing data, and detailed failure analysis.

## Project Structure

```
chatbot-tests/
├── package.json              # Node.js dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── config.json               # Test configuration
├── questions-en.json         # English question set (11 accounting questions)
├── questions-nl.json         # Dutch question set (11 accounting questions)
├── .env.example              # Environment variable template
├── src/
│   └── testLLM.ts           # Main implementation
└── README.md                # This documentation
```

## Installation

1. **Clone/Download** the project
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Set up API key**:
   ```bash
   export OPENAI_API_KEY="your_openai_api_key_here"
   ```
   Or create a `.env` file (see `.env.example`)

## Usage

Run the test suite:
```bash
npm run test-llm
```

## Configuration (`config.json`)

### Core Settings

- **`supersystemprompt`**: Base instruction appended to all system prompts
- **`testSet`**: Language/question set to use (`"en"` or `"nl"`)
- **`runs`**: Number of test iterations per model/prompt combination

### System Prompts

Array of prompt configurations with enable/disable control:

```json
"systemPrompts": [
  {
    "name": "emptySystemPrompt",
    "prompt": "",
    "enabled": true
  },
  {
    "name": "accountantWithoutBE",
    "prompt": "You are a strict accountant, answer with reasoning first",
    "enabled": false
  },
  {
    "name": "accountantWithBE",
    "prompt": "You are a helpful teacher, answer carefully",
    "enabled": false
  }
]
```

### Models

Array of OpenAI model configurations - **completely config-driven**:

```json
"models": [
  {
    "name": "gpt-5",
    "max_completion_tokens": 10,
    "enabled": true
  },
  {
    "name": "gpt-5-chat-latest",
    "temperature": 0.7,
    "max_completion_tokens": 10,
    "enabled": true
  },
  {
    "name": "gpt-4o",
    "temperature": 0.7,
    "max_tokens": 10,
    "enabled": true
  }
]
```

**Configuration Parameters (all optional):**
- **`temperature`**: 0.0-2.0 - Controls response creativity (omitted = no temperature in API call)
- **`max_tokens`**: Token limit for older models (omitted = no max_tokens in API call)
- **`max_completion_tokens`**: Token limit for newer models (omitted = no max_completion_tokens in API call)
- **`enabled`**: Whether to test this configuration

**Pure Configuration Logic**: Only parameters present in config are sent to API

#### Supported Models

**Recommended Models:**
- `gpt-5` - Latest GPT-5 (uses `max_completion_tokens`, no temperature)
- `gpt-5-chat-latest` - GPT-5 with temperature support (uses `max_completion_tokens`)
- `gpt-4.1` - **BEST CHOICE** for balanced performance (uses `max_tokens`)
- `gpt-4o` - Supports ~128K tokens context (uses `max_tokens`)
- `gpt-4o-mini` - Smaller, faster variant (uses `max_tokens`)

**Additional Models:**
- `gpt-5-mini`, `gpt-5-nano` (use `max_completion_tokens`)
- `gpt-4.1-mini`, `gpt-4.1-nano` (use `max_tokens`)
- `o3`, `o3-mini`, `o1`, `o1-mini`, `o4-mini` (use `max_tokens`)

**API Parameter Rules:**
- **GPT-5 family**: Use `max_completion_tokens`, temperature optional
- **Other models**: Use `max_tokens`, temperature supported
- **Configuration-driven**: Only include parameters you want sent to API
- **Multiple configurations**: Same model with different parameter combinations

**Deprecated/Ignore:**
- `gpt-4`, `gpt-3.5-turbo`

## Question Format (`questions-{lang}.json`)

Questions follow this structure:

```json
[
  {
    "title": "What means 'taxable amount' or 'taxable base' on an invoice?",
    "options": [
      { "option": "The amount on which VAT is calculated", "correct": true },
      { "option": "The calculated VAT amount", "correct": false },
      { "option": "The amount including VAT", "correct": false },
      { "option": "The total amount of the goods for resale", "correct": false }
    ]
  }
]
```

## Core Functionality

### Test Flow

1. **Load Configuration**: Read `config.json` and question set
2. **Filter Active Items**: Only test enabled models and system prompts
3. **For Each Combination**:
   - Randomize question order
   - For each question:
     - Randomize option order (preserving correct flags)
     - Construct multiple-choice prompt (A, B, C, D format)
     - Send to OpenAI API with system + super system prompt
     - Parse response and verify correctness
4. **Collect Results**: Track timing, accuracy, and failures

### Randomization

- **Questions**: Shuffled for each test run using Fisher-Yates algorithm
- **Options**: Shuffled while preserving `correct: true/false` flags
- **Purpose**: Prevents memorization and order bias

### Response Processing

- **Expected Format**: Single letter A, B, C, or D
- **Parsing**: Regex extraction `/[ABCD]/`
- **Error Handling**: Invalid responses marked as `INVALID`, API errors as `ERROR`

## Output Format

### Real-time Progress
```
Model gpt-4o (temp:0.7) | Prompt[emptySystemPrompt] | Run 1
Correct: 8/11 | Accuracy: 72.7% | Duration: 45.3sec
Failed:
  Q: What is a balance sheet?
  Answer: D - "A collection of all assets and receivables..."
```

### Summary Report
```
=== SUMMARY (Test Set: en) ===
gpt-4o (temp:0.2) | Prompt[emptySystemPrompt] | Run 1: 8/11 correct | Accuracy: 72.7% | Duration: 45.3sec
gpt-4o (temp:0.7) | Prompt[emptySystemPrompt] | Run 1: 9/11 correct | Accuracy: 81.8% | Duration: 52.1sec
gpt-4o (temp:1.0) | Prompt[emptySystemPrompt] | Run 1: 7/11 correct | Accuracy: 63.6% | Duration: 48.9sec
gpt-5 (temp:N/A) | Prompt[emptySystemPrompt] | Run 1: 10/11 correct | Accuracy: 90.9% | Duration: 41.2sec
```

## Metrics Collected

- **Accuracy**: Percentage correct (e.g., "85.6%")
- **Duration**: Total time for 11 questions (e.g., "74.6sec")
- **Failed Questions**: Detailed list with model's chosen answers
- **Run Statistics**: Per model/prompt/run breakdown

## Technical Details

### Dependencies
- **OpenAI SDK**: `openai@^5.21.0` for API communication
- **TypeScript**: `typescript@^5.9.2` with strict typing
- **ts-node**: `ts-node@^10.9.2` for direct execution
- **Node Types**: `@types/node@^24.5.2`

### API Configuration
- **Temperature**: Optional per model (0.0-2.0, omitted if not in config)
- **Token Limits**: `max_tokens` or `max_completion_tokens` (configurable per model)
- **Model Selection**: Configurable per test run
- **Parameter Handling**: **Purely config-driven** - only configured parameters sent to API

### Error Handling
- Missing question files: Clear error with available options
- API failures: Logged and marked as `ERROR` results
- Invalid responses: Captured and marked as `INVALID`

## Example Workflow

1. **Configure**: Set `testSet: "en"`, enable desired models/prompts, set temperatures
2. **Run**: `npm run test-llm`
3. **Monitor**: Real-time progress for each model/temperature/prompt combination
4. **Analyze**: Summary shows accuracy and timing across all combinations
5. **Compare**: Different temperatures for same model show creativity vs consistency trade-offs
6. **Adjust**: Modify configuration for different test scenarios

## Configuration Strategy

### Temperature Testing
**Low Temperature (0.0-0.3)**: More deterministic, consistent responses
**Medium Temperature (0.4-0.8)**: Balanced creativity and consistency
**High Temperature (0.9-2.0)**: More creative, varied responses

### Token Parameter Strategy
**GPT-5 Models**: Use `max_completion_tokens` (required API parameter)
**Other Models**: Use `max_tokens` (standard API parameter)
**Omit Parameters**: Don't include parameters you don't want sent to API

### Use Cases
- **Parameter Testing**: Compare same model with/without temperature
- **API Compatibility**: Test different token parameter requirements
- **Optimal Settings**: Find best parameter combinations per model
- **Model Comparison**: Compare models with their optimal configurations

## Language Support

- **English (`en`)**: `questions-en.json` - 11 accounting questions
- **Dutch (`nl`)**: `questions-nl.json` - 11 accounting questions
- **Extensible**: Add new language files as `questions-{lang}.json`

## Security Notes

- API key can be set via environment variable or hardcoded (not recommended for production)
- Current implementation includes hardcoded API key for development convenience
- For production use, always use `OPENAI_API_KEY` environment variable

## Performance Considerations

- Sequential execution (no parallel API calls)
- Timing includes full API round-trip for all questions
- Randomization happens per test run for statistical validity
- Multiple runs provide confidence intervals for model performance
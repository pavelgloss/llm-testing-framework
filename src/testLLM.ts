import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

config();

interface Question {
  title: string;
  options: { option: string; correct: boolean }[];
}

interface Config {
  supersystemprompt: string;
  testSet: string;
  systemPrompts: { name: string; prompt: string; enabled: boolean }[];
  models: { name: string; temperature?: number; enabled: boolean }[];
  runs: number;
}

interface TestResult {
  question: string;
  chosenLetter: string;
  chosenText: string;
  correctness: boolean;
}

interface RunStats {
  modelName: string;
  modelTemperature: number | string;
  systemPromptName: string;
  runNumber: number;
  totalQuestions: number;
  correctCount: number;
  failedCount: number;
  accuracy: string;
  duration: string;
  failed: { question: string; answer: string }[];
}

//
//Valid model names
//   "gpt-5",         GPT-5 returns empty responses - may not be available or needs different API
//   "gpt-5-chat-latest" should support “temperature” parameter
//   "gpt-4o",  supports up to ~128,000 tokens for context
//   "gpt-4o-mini",
//   "gpt-4",      --- IGNORE ---
//   "gpt-3.5-turbo", --- IGNORE ---
//   "gpt-5-mini",  
//   "gpt-5-nano",
//   "gpt-4.1",   BEST CHOICE
//   "gpt-4.1-mini",
//   "gpt-4.1-nano",
//   "o3",
//   "o3-mini",
//   "o1",
//   "o1-mini",
//   "o4-mini"
// updated list of models suitable for chatbot assistant:
//    [
//      "gpt-5",
//      "gpt-5-mini",
//      "gpt-4.1",
//      "gpt-4.1-mini",
//      "o3",
//      "o3-mini",
//      "o4-mini",
//      "gpt-4o"
//   ]

class LLMTester {
  private config: Config;
  private questions: Question[];
  private openai: OpenAI;

  constructor() {
    this.config = this.loadConfig();
    this.questions = this.loadQuestions();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  private loadConfig(): Config {
    const configPath = path.join(process.cwd(), 'config.json');
    const configData = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configData);
  }

  private loadQuestions(): Question[] {
    const questionsPath = path.join(process.cwd(), `questions-${this.config.testSet}.json`);

    if (!fs.existsSync(questionsPath)) {
      throw new Error(`Questions file not found: questions-${this.config.testSet}.json. Available test sets: "en", "nl"`);
    }

    const questionsData = fs.readFileSync(questionsPath, 'utf-8');
    return JSON.parse(questionsData);
  }

  private randomizeQuestions(questions: Question[]): Question[] {
    const shuffled = [...questions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private randomizeOptions(options: { option: string; correct: boolean }[]): { option: string; correct: boolean }[] {
    const shuffled = [...options];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private constructUserPrompt(question: Question, randomizedOptions: { option: string; correct: boolean }[]): string {
    const letters = ['A', 'B', 'C', 'D'];
    let prompt = question.title + '\n';

    randomizedOptions.forEach((opt, index) => {
      prompt += `${letters[index]} - ${opt.option}\n`;
    });

    return prompt.trim();
  }

  private parseResponse(response: string): string | null {
    const match = response.match(/[ABCD]/);
    return match ? match[0] : null;
  }


  private async runTest(modelConfig: { name: string; temperature?: number }, systemPrompt: string, systemPromptName: string, runNumber: number): Promise<RunStats> {
    const tempDisplay = modelConfig.temperature !== undefined ? `temp:${modelConfig.temperature}` : "temp:N/A";
    console.log(`\nModel ${modelConfig.name} (${tempDisplay}) | Prompt[${systemPromptName}] | Run ${runNumber}`);

    const startTime = Date.now();
    const randomizedQuestions = this.randomizeQuestions(this.questions);
    const results: TestResult[] = [];

    for (const question of randomizedQuestions) {
      const randomizedOptions = this.randomizeOptions(question.options);

      try {
        const userPrompt = this.constructUserPrompt(question, randomizedOptions);
        const fullSystemPrompt = `${systemPrompt}\n\n${this.config.supersystemprompt}`;


        let responseText = "";

        if (modelConfig.name === "gpt-5") {
          // Responses API
          const resp = await this.openai.responses.create({
            model: "gpt-5",

            //input: fullSystemPrompt + "\n\n" + userPrompt,
            input: [
              { role: "system", content: fullSystemPrompt },
              { role: "user", content: userPrompt },
            ],

            // In Azure OpenAI / reasoning-models docs: for GPT-5 reasoning models, max_output_tokens must be at least 16
            max_output_tokens: 32,   // >= 16
            reasoning: { effort: "minimal" },   // minimal, low, medium, high
            text: { verbosity: "low" },
          });

          // KEEP THIS as reference for parsing reasoning model responses
          // resp.output[0].type = "reasoning"
          // resp.output[1].type = "message"  
          // resp.output[1].role = "assistant"
          // resp.output[1].content[0].text = "A"  (for example)
          // resp.output[1].content[0].type = "output_text"
          // resp.output.[0] as any)?.content?.[0]
          responseText = resp.output_text || "";

        } else {
          // Chat Completions API
          const apiParams: any = {
            model: modelConfig.name,
            messages: [
              { role: "system", content: fullSystemPrompt },
              { role: "user", content: userPrompt },
            ],
            max_tokens: 1,
          };

          if (modelConfig.temperature !== undefined) {
            apiParams.temperature = modelConfig.temperature;
          }

          const completion = await this.openai.chat.completions.create(apiParams);
          responseText = completion.choices[0]?.message?.content || "";
        }
        const chosenLetter = this.parseResponse(responseText);

        if (chosenLetter) {
          const letterIndex = ['A', 'B', 'C', 'D'].indexOf(chosenLetter);
          const chosenOption = randomizedOptions[letterIndex];

          results.push({
            question: question.title,
            chosenLetter,
            chosenText: chosenOption.option,
            correctness: chosenOption.correct
          });
        } else {
          results.push({
            question: question.title,
            chosenLetter: 'INVALID',
            chosenText: responseText,
            correctness: false
          });
        }
      } catch (error) {
        console.error(`Error with model ${modelConfig.name}: ${error}`);
        results.push({
          question: question.title,
          chosenLetter: 'ERROR',
          chosenText: `Error: ${error}`,
          correctness: false
        });
      }
    }

    const endTime = Date.now();
    const durationMs = endTime - startTime;
    const durationSec = (durationMs / 1000).toFixed(1);

    const correctCount = results.filter(r => r.correctness).length;
    const failedResults = results.filter(r => !r.correctness);
    const accuracy = ((correctCount / results.length) * 100).toFixed(1);

    const stats: RunStats = {
      modelName: modelConfig.name,
      modelTemperature: modelConfig.temperature !== undefined ? modelConfig.temperature : "N/A",
      systemPromptName,
      runNumber,
      totalQuestions: results.length,
      correctCount,
      failedCount: failedResults.length,
      accuracy: `${accuracy}%`,
      duration: `${durationSec}sec`,
      failed: failedResults.map(r => ({
        question: r.question,
        answer: `${r.chosenLetter} - "${r.chosenText}"`
      }))
    };

    console.log(`Correct: ${correctCount}/${results.length} | Accuracy: ${accuracy}% | Duration: ${durationSec}sec`);
    if (failedResults.length > 0) {
      console.log('Failed:');
      failedResults.forEach(failure => {
        console.log(`  Q: ${failure.question}`);
        console.log(`  Answer: ${failure.chosenLetter} - "${failure.chosenText}"`);
      });
    }

    return stats;
  }

  async run(): Promise<void> {
    console.log(`Starting LLM Testing with test set: ${this.config.testSet}\n`);

    if (!process.env.OPENAI_API_KEY) {
      console.log('Warning: Using hardcoded API key. Consider setting OPENAI_API_KEY environment variable.');
    }

    console.log(`Testing ${this.questions.length} questions from test set: ${this.config.testSet}`);

    const enabledModels = this.config.models.filter(m => m.enabled);
    const allStats: RunStats[] = [];

    const enabledSystemPrompts = this.config.systemPrompts.filter(p => p.enabled);

    for (const model of enabledModels) {
      for (const systemPromptConfig of enabledSystemPrompts) {
        for (let run = 1; run <= this.config.runs; run++) {
          const stats = await this.runTest(model, systemPromptConfig.prompt, systemPromptConfig.name, run);
          allStats.push(stats);
        }
      }
    }

    console.log(`\n=== SUMMARY (Test Set: ${this.config.testSet}) ===`);
    allStats.forEach(stats => {
      const tempDisplay = stats.modelTemperature !== "N/A" ? `temperature:${stats.modelTemperature}` : "temperature:N/A";
      console.log(`${stats.modelName} (${tempDisplay}) | Prompt[${stats.systemPromptName}] | Run ${stats.runNumber}: ${stats.correctCount}/${stats.totalQuestions} correct | Accuracy: ${stats.accuracy} | Duration: ${stats.duration}`);
    });
  }
}

if (require.main === module) {
  const tester = new LLMTester();
  tester.run().catch(console.error);
}
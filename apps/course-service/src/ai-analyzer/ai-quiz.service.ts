import {
  BadRequestException,
  BadGatewayException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Repository } from 'typeorm';

import { Lesson } from '../lessons/entities/lesson.entity';
import { AiQuizGeneration } from './entities/ai-analyzer-entity';
import { Article } from '../articles/entities/article.entity';
import { Quizs } from '../quizs/entities/quizs.entity';
import type { GenerateAiQuizDto } from './dto/generate-ai-quiz.dto';

type AiQuizType = 'multiple_choice' | 'true_false';

type AiQuizQuestion =
  | {
    type: 'multiple_choice';
    question: string;
    choices: string[];
    answerIndex: number;
    explanation: string;
  }
  | {
    type: 'true_false';
    question: string;
    choices: string[];
    answerIndex: number;
    explanation: string;
  };

type AiQuizResponse = {
  questions: AiQuizQuestion[];
};

@Injectable()
export class AiQuizService {
  private readonly modelName = process.env.HUGGINGFACE_MODEL;

  constructor(
    @InjectRepository(AiQuizGeneration)
    private readonly aiRepo: Repository<AiQuizGeneration>,

    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,

    @InjectRepository(Quizs)
    private readonly quizRepo: Repository<Quizs>,

    @InjectRepository(Article)
    private readonly articleRepo: Repository<Article>,
  ) { }

  private async callHuggingFace(prompt: string) {
    const apiKey = process.env.HUGGINGFACE_API_KEY;

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'HUGGINGFACE_API_KEY is not configured',
      );
    }

    const response = await axios.post(
      'https://router.huggingface.co/v1/chat/completions',
      {
        model: this.modelName,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert educational quiz generator. You MUST extract exact facts from the provided content and use them as the correct answer. NEVER invent or approximate values. Return ONLY valid JSON without markdown formatting.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30_000,
      },
    );

    return response.data;
  }

  private rethrowHuggingFaceAxiosError(error: unknown, message: string): never {
    if (!axios.isAxiosError(error)) {
      throw new ServiceUnavailableException(
        `HuggingFace request failed: ${message}`,
      );
    }

    const status = error.response?.status;
    const data = error.response?.data;

    if (status === 400) {
      const hfCode = data?.code ?? data?.error?.code;
      if (hfCode === 'model_not_supported') {
        throw new BadRequestException(
          `HuggingFace rejected request: ${message}. Hint: set HUGGINGFACE_MODEL to a model supported by your enabled HuggingFace Inference Provider(s), or enable a provider for this model in your HuggingFace account settings.`,
        );
      }

      throw new BadRequestException(`HuggingFace rejected request: ${message}`);
    }

    if (status === 401 || status === 403) {
      throw new UnauthorizedException(
        `HuggingFace authentication/permission failed: ${message}`,
      );
    }

    if (status === 429) {
      throw new HttpException(`HuggingFace rate limited: ${message}`, 429);
    }

    if (typeof status === 'number' && status >= 400 && status < 500) {
      throw new BadGatewayException(`HuggingFace client error: ${message}`);
    }

    throw new ServiceUnavailableException(
      `HuggingFace request failed: ${message}`,
    );
  }

  private safeStringify(value: unknown) {
    if (typeof value === 'string') {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private truncate(value: string, maxLength = 2_000) {
    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, maxLength)}…`;
  }

  private formatHttpException(error: HttpException) {
    const response = error.getResponse();

    if (typeof response === 'string') {
      return response;
    }

    const message = (response as any)?.message;

    if (Array.isArray(message)) {
      return message.join('; ');
    }

    if (typeof message === 'string') {
      return message;
    }

    return this.truncate(this.safeStringify(response));
  }

  private formatHuggingFaceError(error: unknown) {
    if (!axios.isAxiosError(error)) {
      const message = (error as any)?.message;
      return typeof message === 'string' ? message : this.safeStringify(error);
    }

    const status = error.response?.status;
    const statusText = error.response?.statusText;
    const data = error.response?.data;

    const upstreamError = data?.error ?? data;
    const upstreamText = this.truncate(this.safeStringify(upstreamError));

    if (status) {
      return statusText
        ? `HTTP ${status} ${statusText}: ${upstreamText}`
        : `HTTP ${status}: ${upstreamText}`;
    }

    return upstreamText || error.message;
  }

  private redactLessonContentForStorage(prompt: string) {
    const marker = '\nLesson Content:\n';
    const index = prompt.indexOf(marker);

    if (index === -1) {
      return this.truncate(prompt);
    }

    return `${prompt.slice(0, index + marker.length)}[REDACTED]`;
  }

  async generateQuizFromLesson(lessonId: number, options?: GenerateAiQuizDto) {
    const lesson = await this.lessonRepo.findOne({
      where: { lesson_id: lessonId },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const articles = await this.articleRepo
      .createQueryBuilder('article')
      .select(['article.article_content', 'article.article_id'])
      .where('article.lesson_id = :lessonId', { lessonId })
      .orderBy('article.article_id', 'ASC')
      .getMany();

    let content = '';

    if (articles && articles.length > 0) {
      const allBlocks: string[] = [];

      for (const article of articles) {
        if (Array.isArray(article.article_content)) {
          const blocks = article.article_content
            .map((block: any) => {
              if (typeof block === 'string') {
                return block.trim();
              }

              if (block && typeof block === 'object') {
                const text = block.article || block.text || block.content || '';
                return typeof text === 'string' ? text.trim() : '';
              }

              return '';
            })
            .filter((text) => text.length > 0);

          allBlocks.push(...blocks);
        }
      }

      content = allBlocks.join('\n\n').trim();

      Logger.debug(
        `[AI Quiz] Lesson ${lessonId}: Found ${articles.length} article(s) with ${allBlocks.length} total content blocks, ${content.length} chars`,
      );
    } else {
      Logger.warn(
        `[AI Quiz] Lesson ${lessonId}: No articles found`,
      );
    }

    if (!content) {
      Logger.warn(
        `[AI Quiz] Lesson ${lessonId}: Article content is empty, falling back to lesson description`,
      );

      const description =
        typeof lesson.lesson_description === 'string'
          ? lesson.lesson_description
          : '';

      content = description.trim()
        ? description
        : (lesson.lesson_title ?? '').trim();
    }

    if (!content) {
      throw new BadRequestException(
        `Lesson ${lessonId} has no content. Please add article content or lesson description first.`,
      );
    }

    const MAX_ARTICLE_LENGTH = 4000;
    const originalLength = content.length;
    content = content.slice(0, MAX_ARTICLE_LENGTH);

    if (originalLength > MAX_ARTICLE_LENGTH) {
      Logger.debug(
        `[AI Quiz] Lesson ${lessonId}: Content truncated from ${originalLength} to ${MAX_ARTICLE_LENGTH} chars`,
      );
    }

    Logger.debug(
      `[AI Quiz] Lesson ${lessonId}: Sending ${content.length} chars to AI`,
    );

    const prompt = this.buildPrompt(content, options);
    const promptForStorage = this.redactLessonContentForStorage(prompt);

    try {
      const response = await this.callHuggingFace(prompt);

      const aiContent = response?.choices?.[0]?.message?.content;

      if (!aiContent) {
        throw new BadRequestException('AI returned empty response');
      }

      const parsed = this.parseAndValidateQuizJson(aiContent);

      const saved = this.aiRepo.create({
        lessonId,
        prompt_used: promptForStorage,
        ai_response: parsed,
        model_name: this.modelName,
        status: 'PENDING',
      });

      return await this.aiRepo.save(saved);
    } catch (error: unknown) {
      const message =
        error instanceof HttpException
          ? this.formatHttpException(error)
          : this.formatHuggingFaceError(error);

      const failed = this.aiRepo.create({
        lessonId,
        prompt_used: promptForStorage,
        ai_response: {},
        model_name: this.modelName,
        status: 'REJECTED',
        error_message: message,
      });

      await this.aiRepo.save(failed);

      if (error instanceof HttpException) {
        throw error;
      }

      this.rethrowHuggingFaceAxiosError(error, message);
    }
  }

  async approveAiQuiz(aiQuizId: number) {
    const ai = await this.aiRepo.findOne({
      where: { ai_quiz_id: aiQuizId },
    });

    if (!ai) {
      throw new NotFoundException('AI quiz not found');
    }

    if (ai.status === 'APPROVED') {
      throw new BadRequestException('AI quiz already approved');
    }

    const validated = this.validateAiQuizResponse(ai.ai_response);
    const question = validated.questions[0];

    const correctChoice = question.choices[question.answerIndex];

    const quizData: Partial<Quizs> = {
      lessonId: ai.lessonId,
      quizsType: question.type,
      quizsQuestions: question.question,
      quizsOption: question.choices,
      quizsAnswer: correctChoice,
      quizsExplanation: question.explanation,
    };

    const existing = await this.quizRepo.findOne({
      where: { lessonId: ai.lessonId },
    });

    const quiz = existing
      ? Object.assign(existing, quizData)
      : this.quizRepo.create(quizData);

    const savedQuiz = await this.quizRepo.save(quiz);


    console.log(quizData);

    ai.status = 'APPROVED';
    await this.aiRepo.save(ai);

    return savedQuiz;
  }

  private parseAndValidateQuizJson(content: string): AiQuizResponse {
    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch {
      throw new BadRequestException('AI returned invalid JSON');
    }

    return this.validateAiQuizResponse(parsed);
  }

  private validateAiQuizResponse(data: unknown): AiQuizResponse {
    if (!data || typeof data !== 'object') {
      throw new BadRequestException('AI response must be JSON object');
    }

    const obj = data as Record<string, unknown>;
    const questions = obj.questions;

    if (!Array.isArray(questions) || questions.length < 1) {
      throw new BadRequestException('AI response must include questions[]');
    }

    const first = questions[0];

    if (!first || typeof first !== 'object') {
      throw new BadRequestException('AI response questions[0] invalid');
    }

    const typeRaw = first.type;
    const question = first.question;
    const choices = first.choices;
    const answerIndex = first.answerIndex;
    const explanation = first.explanation;

    const inferredType: AiQuizType =
      typeRaw === 'multiple_choice' || typeRaw === 'true_false'
        ? typeRaw
        : Array.isArray(choices) && choices.length === 2
          ? 'true_false'
          : 'multiple_choice';

    // Validate type consistency
    if (typeRaw === 'true_false' && Array.isArray(choices) && choices.length !== 2) {
      throw new BadRequestException('true_false type requires exactly 2 choices');
    }
    if (typeRaw === 'multiple_choice' && Array.isArray(choices) && choices.length !== 4) {
      throw new BadRequestException('multiple_choice type requires exactly 4 choices');
    }

    if (typeof question !== 'string' || !question.trim()) {
      throw new BadRequestException('Invalid question');
    }

    if (!Array.isArray(choices) || choices.some((c) => typeof c !== 'string')) {
      throw new BadRequestException('choices must be array of strings');
    }

    if (inferredType === 'multiple_choice') {
      if (choices.length !== 4) {
        throw new BadRequestException(
          'multiple_choice choices must be 4 strings',
        );
      }

      if (
        typeof answerIndex !== 'number' ||
        answerIndex < 0 ||
        answerIndex > 3
      ) {
        throw new BadRequestException(
          'multiple_choice answerIndex must be 0-3',
        );
      }
    } else {
      if (choices.length !== 2) {
        throw new BadRequestException('true_false choices must be 2 strings');
      }

      if (
        typeof answerIndex !== 'number' ||
        answerIndex < 0 ||
        answerIndex > 1
      ) {
        throw new BadRequestException('true_false answerIndex must be 0-1');
      }
    }

    if (typeof explanation !== 'string') {
      throw new BadRequestException('explanation must be string');
    }

    return {
      questions: [
        {
          type: inferredType,
          question,
          choices,
          answerIndex,
          explanation,
        },
      ],
    };
  }

  private buildPrompt(content: string, options?: GenerateAiQuizDto) {
    const targetLanguage = options?.language || 'English';

    const languageInstruction =
      targetLanguage.toLowerCase() === 'th' || targetLanguage.toLowerCase() === 'thai'
        ? 'Thai (ภาษาไทย)'
        : targetLanguage.toLowerCase() === 'en' || targetLanguage.toLowerCase() === 'english'
          ? 'English'
          : targetLanguage;

    const languageLine = `Language: ${languageInstruction}`;
    const difficultyLine = options?.difficulty
      ? `Difficulty: ${options.difficulty}`
      : '';

    const quizTypeLine = options?.quiz_type
      ? `Quiz Type: ${options.quiz_type}`
      : '';

    const admin = options?.admin ?? options?.prompt;

    const instructionLine = admin?.trim() ? `admin: ${admin.trim()}` : '';

    const meta = [languageLine, difficultyLine, quizTypeLine, instructionLine]
      .filter(Boolean)
      .join('\n');

    const isTrueFalse = options?.quiz_type === 'true_false';

    const choicesRule = isTrueFalse
      ? `- "choices" MUST be exactly 2 strings: ["True", "False"] (or the equivalent in the target language)\n- "answerIndex" must be 0 (True) or 1 (False)`
      : `- Choice 1: Use the EXACT value you extracted (this is the correct answer)\n- Choices 2-4: Create plausible but clearly wrong alternatives\n- All choices must be in the same format and language`;

    const outputFormatExample = isTrueFalse
      ? `{\n  "questions": [\n    {\n      "type": "true_false",\n      "question": "",\n      "choices": ["True", "False"],\n      "answerIndex": 0,\n      "explanation": ""\n    }\n  ]\n}`
      : `{\n  "questions": [\n    {\n      "type": "multiple_choice",\n      "question": "",\n      "choices": ["", "", "", ""],\n      "answerIndex": 0,\n      "explanation": ""\n    }\n  ]\n}`;

    return `<task>Generate 1 quiz question by carefully analyzing the lesson content below.</task>

${meta ? `<constraints>\n${meta}\n</constraints>\n` : ''}
<instructions>
YOU MUST FOLLOW THESE STEPS IN ORDER:

STEP 1: ANALYZE THE CONTENT
- Read ALL of the <lesson_content> carefully
- Identify specific facts: numbers, names, dates, terms, definitions
- Note the EXACT values as they appear (do not modify them)

STEP 2: SELECT ONE FACT
- Choose ONE clear, specific fact from the content
- The fact must be explicitly stated (not implied or inferred)
- Prefer facts with concrete values (numbers, specific names, dates)

STEP 3: EXTRACT THE EXACT VALUE
- Copy the EXACT value from the content (word-for-word, number-for-number)
- If it's a number, use the PRECISE number (e.g., "180" not "200" or "150")
- If it's a name/term, use the EXACT spelling

STEP 4: CREATE THE QUESTION
- Write a clear question testing this specific fact
- The question should have only ONE correct answer

STEP 5: CREATE ANSWER CHOICES
${choicesRule}

CRITICAL RULES:
- Return ONLY valid JSON (no markdown code blocks, no extra text)
- The correct answer MUST use the EXACT value from <lesson_content>
- If the content says "180 กิโลกรัม", one choice MUST be "180 กิโลกรัม" or "ประมาณ 180 กิโลกรัม"
- DO NOT round numbers (180 is NOT 200, NOT 150, NOT 100)
- DO NOT approximate or modify the value
- DO NOT create new numbers that don't appear in the content
- Wrong choices must be plausible alternative values (e.g., other numbers, other names, other dates)
- DO NOT use meta answers like "ไม่มีข้อมูล", "ไม่ทราบ", "ทั้งหมดข้างต้น", "ไม่มีคำตอบที่ถูกต้อง"
- Wrong choices must be clearly different from the correct value (not close approximations)
- The "explanation" field is REQUIRED and must explain why the correct answer is right, referencing the lesson content

LANGUAGE RULES (CRITICAL):
- ALL content must be in ${targetLanguage} ONLY
- Question must be in ${targetLanguage}
- ALL choices must be in ${targetLanguage}
- Explanation must be in ${targetLanguage}
- DO NOT mix languages (e.g., English question with Thai choices, or vice versa)
- If language is English, write "kilograms" not "กิโลกรัม"
- If language is Thai, write "กิโลกรัม" not "kilograms"
- Translate units and terms to match the target language
</instructions>

<output_format>
${outputFormatExample}
</output_format>

<lesson_content>
${content}
</lesson_content>`;
  }
}

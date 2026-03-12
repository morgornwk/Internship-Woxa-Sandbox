import { BadRequestException, BadGatewayException, HttpException, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
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
                            'You are an expert educational quiz generator. Return ONLY JSON.',
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                temperature: 0.4,
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
        const data = error.response?.data as any;

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
            throw new HttpException(
                `HuggingFace rate limited: ${message}`,
                429,
            );
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

        const upstreamError = (data as any)?.error ?? data;
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

        // โหลดเฉพาะ article ของ lesson นี้
        const article = await this.articleRepo
            .createQueryBuilder('article')
            .select(['article.article_content'])
            .where('article.lesson_id = :lessonId', { lessonId })
            .orderBy('article.updatedAt', 'DESC')
            .limit(1)
            .getOne();

        let content = '';

        if (Array.isArray(article?.article_content)) {
            content = article.article_content
                .map((block: any) => {
                    if (typeof block === 'string') return block;

                    if (block?.article) return block.article;
                    if (block?.text) return block.text;
                    if (block?.content) return block.content;

                    return '';
                })
                .join('\n')
                .trim();
        }

        // fallback ไปใช้ lesson description
        if (!content) {
            const description = typeof lesson.lesson_description === 'string'
                ? lesson.lesson_description
                : '';

            content = description.trim()
                ? description
                : (lesson.lesson_title ?? '').trim();
        }

        if (!content) {
            throw new BadRequestException('Lesson content is empty');
        }

        // limit length to avoid hitting HuggingFace max input tokens
        const MAX_ARTICLE_LENGTH = 4000;
        content = content.slice(0, MAX_ARTICLE_LENGTH);

        // console.log(`content sent to ai : `, content);

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
            const message = error instanceof HttpException
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

        const first = questions[0] as any;

        if (!first || typeof first !== 'object') {
            throw new BadRequestException('AI response questions[0] invalid');
        }

        const typeRaw = first.type;
        const question = first.question;
        const choices = first.choices;
        const answerIndex = first.answerIndex;
        const explanation = first.explanation;

        const inferredType: AiQuizType = typeRaw === 'multiple_choice' || typeRaw === 'true_false'
            ? typeRaw
            : Array.isArray(choices) && choices.length === 2
                ? 'true_false'
                : 'multiple_choice';

        if (typeof question !== 'string' || !question.trim()) {
            throw new BadRequestException('Invalid question');
        }

        if (!Array.isArray(choices) || choices.some((c) => typeof c !== 'string')) {
            throw new BadRequestException('choices must be array of strings');
        }

        if (inferredType === 'multiple_choice') {
            if (choices.length !== 4) {
                throw new BadRequestException('multiple_choice choices must be 4 strings');
            }

            if (
                typeof answerIndex !== 'number' ||
                answerIndex < 0 ||
                answerIndex > 3
            ) {
                throw new BadRequestException('multiple_choice answerIndex must be 0-3');
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
        const languageLine = options?.language
            ? `Language: ${options.language}`
            : '';

        const difficultyLine = options?.difficulty
            ? `Difficulty: ${options.difficulty}`
            : '';

        const quizTypeLine = options?.quiz_type
            ? `Quiz Type: ${options.quiz_type}`
            : '';

        const admin = options?.admin ?? options?.prompt;

        const instructionLine = admin?.trim()
            ? `admin: ${admin.trim()}`
            : '';

        const meta = [languageLine, difficultyLine, quizTypeLine, instructionLine]
            .filter(Boolean)
            .join('\n');

        return `
                Generate 1 quiz question from the lesson below.

                ${meta ? `Constraints:\n${meta}\n` : ''}

                Rules:
                - Return ONLY JSON (no markdown, no extra text)
                - Question must be based ONLY on the Lesson Content
                - Do NOT invent information outside the Lesson Content
                - Use facts from the Lesson Content
                - Provide realistic wrong answers
                - Write the question, all choices, and the explanation in ${options?.language ?? 'the opposite language of the Lesson Content'}
                - Use natural, grammatically correct wording in the output language
                - Do not mix Thai and English in the same sentence unless the lesson content requires a proper noun or technical term
                - If the Lesson Content is in English, translate the quiz output into Thai
                - If the Lesson Content is in Thai, translate the quiz output into English

                Return format:

                {
                    "questions": [
                        {
                        "type": "multiple_choice" | "true_false",
                        "question": "",
                        "choices": ["", "", "", ""],
                        "answerIndex": 0,
                        "explanation": ""
                        }
                    ]
                }

                Lesson Content:${content}
                `;
    }
}
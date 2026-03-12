import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Quizs } from './entities/quizs.entity';
import { QuizsCheckpoint } from './entities/checkpoint.entity';
import { QuizsResult, QuizsResultType, QuizsStatus } from './entities/quizs-result.entity';
import { CreateQuizsDto, CreateCheckpointDto, UpdateQuizsDto, UpdateCheckpointDto } from './dto';
import { Lesson, LessonType } from '../lessons/entities/lesson.entity';
import { Chapter } from '../chapters/entities/chapter.entity';
import { UserXp } from './entities/user-xp.entity';

@Injectable()
export class QuizService {
  private checkpointScoreFromLevelOrderIndex(levelOrderIndex?: number | null): number {
    const levelNumber = (levelOrderIndex ?? 0) + 1;
    const scoreByLevel: Record<number, number> = { 1: 5, 2: 10, 3: 15 };
    return scoreByLevel[levelNumber] ?? 5;
  }

  constructor(
    @InjectRepository(Quizs)
    private readonly quizsRepository: Repository<Quizs>,
    @InjectRepository(QuizsCheckpoint)
    private readonly checkpointRepository: Repository<QuizsCheckpoint>,
    @InjectRepository(QuizsResult)
    private readonly resultRepository: Repository<QuizsResult>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(Chapter)
    private readonly chapterRepository: Repository<Chapter>,
    @InjectRepository(UserXp)
    private readonly userXpRepository: Repository<UserXp>,
  ) { }

  private async syncChapterIsPublishedByChapterId(chapterId: number): Promise<void> {
    const hasPublishedLesson = await this.lessonRepository.exist({
      where: { chapter_id: chapterId, isPublished: true },
    });

    await this.chapterRepository.update(chapterId, { isPublished: hasPublishedLesson });
  }

  async createQuizs(dto: CreateQuizsDto): Promise<Quizs> {
    const existing = await this.quizsRepository.findOne({
      where: { lessonId: dto.lesson_id },
    });

    // ตรวจสอบว่า lesson มีอยู่จริง และเป็นประเภท QUIZ หรือไม่
    const data = {
      lessonId: dto.lesson_id,
      quizsType: dto.quizs_type,
      quizsQuestions: dto.quizs_questions,
      quizsOption: dto.quizs_option,
      quizsAnswer: dto.quizs_answer,
      quizsExplanation: dto.quizs_explanation,
    };

    // ถ้ามีอยู่แล้วให้ Update
    if (existing) {
      Object.assign(existing, data);
      return this.quizsRepository.save(existing);
    }

    const quiz = this.quizsRepository.create(data);
    return this.quizsRepository.save(quiz);
  }

  // ดึง quiz พร้อมสถานะสำหรับผู้ใช้
  async getQuizWithStatus(lessonId: number, userId: string) {
    const quiz = await this.quizsRepository.findOne({ where: { lessonId } });
    if (!quiz) {
      throw new NotFoundException(`Quiz for lesson ${lessonId} not found`);
    }

    const result = await this.resultRepository.findOne({
      where: { lessonId, userId, type: QuizsResultType.QUIZ },
    });

    // ถ้ายังไม่เคยทำ quiz นี้เลยส่งข้อมูล quiz พร้อมสถานะ NOT_ATTEMPTED (ยังไม่พยายามทำ) ไม่ส่งคำตอบหรือคำอธิบายกลับไปหา frontend
    if (!result) {
      return {
        quizs_id: quiz.quizsId,
        quizs_type: quiz.quizsType,
        quizs_question: quiz.quizsQuestions,
        quizs_option: quiz.quizsOption,
        lesson_id: quiz.lessonId,
        quizs_answer: null,
        quizs_explanation: null,
        status: 'NOT_ATTEMPTED',
        user_answer: null,
        is_correct: null,
        completed_at: null,
      };
    }

    // ถ้าทำ quiz แล้วแต่ยังไม่มีคำตอบ (สถานะ PENDING) แสดงข้อมูล quiz พร้อมสถานะ PENDING แต่ไม่ต้องส่งคำตอบหรือคำอธิบายกลับไปหา frontend
    const attempted = result.userAnswer != null;
    if (!attempted) {
      return {
        quizs_id: quiz.quizsId,
        quizs_type: quiz.quizsType,
        quizs_question: quiz.quizsQuestions,
        quizs_option: quiz.quizsOption,
        lesson_id: quiz.lessonId,
        quizs_answer: null,
        quizs_explanation: null,
        status: result.status,
        user_answer: null,
        is_correct: null,
        completed_at: null,
      };
    }

    return {
      quizs_id: quiz.quizsId,
      quizs_type: quiz.quizsType,
      quizs_question: quiz.quizsQuestions,
      quizs_option: quiz.quizsOption,
      lesson_id: quiz.lessonId,
      quizs_answer: quiz.quizsAnswer,
      quizs_explanation: quiz.quizsExplanation,
      status: result.status === QuizsStatus.PENDING ? QuizsStatus.COMPLETED : result.status,
      user_answer: result.userAnswer,
      is_correct: result.isCorrect,
      completed_at: result.updatedAt,
    };
  }

  // ตรวจคำตอบ quiz และบันทึกผล
  async checkAndSaveAnswer(
    lessonId: number,
    userId: string,
    answer: any,
  ) {
    const quiz = await this.quizsRepository.findOne({
      where: { lessonId },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // ตรวจสอบรูปแบบคำตอบเบื้องต้น (เช็คว่าเป็น array หรือ object ตามประเภท quiz)
    const existingResult = await this.resultRepository.findOne({
      where: { lessonId, userId, type: QuizsResultType.QUIZ },
    });

    // เช็คว่าตอบคำถามนี้ไปแล้วหรือยัง ถ้าตอบไปแล้วไม่ว่าจะถูกหรือผิดก็ไม่ให้ตอบซ้ำอีก (single attempt) และถ้าตอบไปแล้วจะไม่ให้แก้ไขคำตอบ
    if (existingResult) {
      const alreadyAttempted = existingResult.userAnswer != null;
      const alreadyFinal = existingResult.status === QuizsStatus.COMPLETED;

      if (alreadyAttempted || alreadyFinal) {
        throw new ConflictException('This quiz has already been attempted and cannot be answered again.');
      }
    }

    // ตรวจคำตอบว่าถูกมั้ย
    const isCorrect = isEqual(
      quiz.quizsAnswer,
      answer,
    );

    // เช็คว่าผู้ใช้มีผลลัพธ์ของ quiz นี้อยู่แล้วหรือไม่ ถ้ามีให้ update ถ้าไม่มีให้สร้างใหม่
    let result = existingResult;
    if (!result) {
      result = this.resultRepository.create({
        lessonId,
        userId,
        type: QuizsResultType.QUIZ,
        checkpointId: null,
      });
    }

    // บันทึกคำตอบและสถานะ (ถ้าตอบแล้วจะเปลี่ยนสถานะเป็น COMPLETED ไม่ว่าจะถูกหรือผิด)
    result.userAnswer = answer;
    result.isCorrect = isCorrect;
    result.status = QuizsStatus.COMPLETED;

    await this.resultRepository.save(result);

    // ถ้าตอบถูกต้องจะคำนวณ XP และอัปเดต progress ของผู้ใช้ในบทนั้น ๆ ถ้าถูกจะได้ XP ถ้าผิดจะไม่ได้
    if (isCorrect) {
      const lesson = await this.lessonRepository.findOne({
        where: { lesson_id: lessonId },
      });

      if (lesson) {
        let userXp = await this.userXpRepository.findOne({
          where: {
            userId,
            chapterId: lesson.chapter_id,
          },
        });

        // คำนวณ XP ของบทนั้น ๆ โดยดูจาก checkpoint ทั้งหมดในบท (ถ้าบทไหนไม่มี checkpoint เลยจะใช้ค่า default เป็น 5 XP ต่อบท)
        const lessonsInChapter = await this.lessonRepository.find({ where: { chapter_id: lesson.chapter_id } });
        const lessonIds = lessonsInChapter.map((l) => l.lesson_id);
        const checkpointsInChapter = await this.checkpointRepository.find({ where: { lessonId: In(lessonIds) } });
        const chapterTotalXp = checkpointsInChapter.reduce((s, c) => s + (c.checkpointScore ?? 5), 0);

        // ถ้ายังไม่มี user_xp ของบทนี้ → สร้างใหม่ (xpEarned/xpTotal)
        if (!userXp) {
          const otherRaw = await this.userXpRepository
            .createQueryBuilder('ux')
            .select('COALESCE(SUM(ux.xpEarned), 0)', 'sum')
            .where('ux.userId = :userId', { userId })
            .andWhere('ux.chapterId != :chapterId', { chapterId: lesson.chapter_id })
            .getRawOne<{ sum: string }>();

          const sumOther = Number(otherRaw?.sum ?? 0);
          const cumulative = sumOther + 0; // quiz ไม่ให้ XP

          userXp = this.userXpRepository.create({
            userId,
            chapterId: lesson.chapter_id,
            xpEarned: 0,
            xpTotal: cumulative,
            checkpointStatus: 'COMPLETED',
            completedAt: new Date(),
            lastAttemptAt: new Date(),
          });

          // ถ้ามีอยู่แล้วอัพเดต (xpEarned/xpTotal)
        } else {
          const otherRaw = await this.userXpRepository
            .createQueryBuilder('ux')
            .select('COALESCE(SUM(ux.xpEarned), 0)', 'sum')
            .where('ux.userId = :userId', { userId })
            .andWhere('ux.chapterId != :chapterId', { chapterId: lesson.chapter_id })
            .getRawOne<{ sum: string }>();

          const sumOther = Number(otherRaw?.sum ?? 0);
          const cumulative = sumOther + 0; // quiz ไม่ให้ XP

          userXp.checkpointStatus = 'COMPLETED';
          userXp.completedAt = new Date();
          userXp.lastAttemptAt = new Date();
          userXp.xpTotal = cumulative;
        }

        await this.userXpRepository.save(userXp);
      }
    }

    return {
      is_correct: isCorrect,
      quizs_answer: quiz.quizsAnswer,
      quizs_explanation: quiz.quizsExplanation,
    };
  }


  // ข้าม quiz โดยบันทึกสถานะเป็น SKIPPED
  async skipQuiz(lessonId: number, userId: string) {
    let result = await this.resultRepository.findOne({
      where: { lessonId, userId, type: QuizsResultType.QUIZ },
    });

    // เช็คว่าข้ามคำถามนี้ไปแล้วหรือยัง ถ้าข้ามไปแล้วไม่ว่าจะถูกหรือผิดก็ไม่ให้ข้ามซ้ำอีก (single attempt)
    if (!result) {
      result = this.resultRepository.create({
        lessonId,
        userId,
        type: QuizsResultType.QUIZ,
        checkpointId: null,
      });
    }
    result.status = QuizsStatus.SKIPPED;

    return this.resultRepository.save(result);
  }

  // CRUD operations สำหรับ quiz และ checkpoint
  async findAllQuizs(): Promise<Array<{ quiz_id: number; lessonId: number; quizs_type: string; quizs_question: string }>> {
    const rows = await this.quizsRepository.find();
    return rows.map((q) => ({
      quiz_id: q.quizsId,
      lessonId: q.lessonId,
      quizs_type: q.quizsType,
      quizs_question: q.quizsQuestions,
      quizs_result: q.quizsAnswer,
    }));
  }

  async findOneQuizsByLesson(lessonId: number): Promise<Quizs> {
    const quiz = await this.quizsRepository.findOne({ where: { lessonId } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    return quiz;
  }

  async findOneCheckpointById(
    checkpointId: number,
  ): Promise<QuizsCheckpoint> {

    const checkpoint = await this.checkpointRepository.findOne({
      where: { checkpointId },
    });

    if (!checkpoint) {
      throw new NotFoundException('Checkpoint not found');
    }

    return checkpoint;
  }

  async findOneCheckpointByLessonId(
    lessonId: number,
  ): Promise<QuizsCheckpoint> {
    const checkpoint = await this.checkpointRepository.findOne({
      where: { lessonId },
      order: { checkpointId: 'DESC' },
    });

    if (!checkpoint) {
      throw new NotFoundException('Checkpoint not found');
    }

    const lesson = await this.lessonRepository.findOne({ where: { lesson_id: lessonId } });
    if (!lesson || lesson.lesson_type !== LessonType.CHECKPOINT) {
      throw new NotFoundException('Checkpoint not found');
    }

    return checkpoint;
  }

  // อัปเดต quiz ตาม lesson ID
  async updateQuizs(lessonId: number, dto: Partial<UpdateQuizsDto>): Promise<Quizs> {
    const quiz = await this.findOneQuizsByLesson(lessonId);
    Object.assign(quiz, {
      quizsType: dto.quizs_type ?? quiz.quizsType,
      quizsQuestions: dto.quizs_questions ?? quiz.quizsQuestions,
      quizsOption: dto.quizs_option ?? quiz.quizsOption,
      quizsAnswer: dto.quizs_answer ?? quiz.quizsAnswer,
      quizsExplanation: dto.quizs_explanation ?? quiz.quizsExplanation,
    });
    return this.quizsRepository.save(quiz);
  }

  // อัปเดต checkpoint ตาม checkpoint ID
  async updateCheckpoint(
    checkpointId: number,
    dto: Partial<UpdateCheckpointDto>,
  ): Promise<QuizsCheckpoint> {

    const checkpoint = await this.checkpointRepository.findOne({
      where: { checkpointId },
    });

    if (!checkpoint) {
      throw new NotFoundException('Checkpoint not found');
    }

    // ถ้า lesson ของ checkpoint นี้มีอยู่จริง และเป็นประเภท CHECKPOINT ให้คำนวณคะแนนใหม่ตาม level ของบทเรียน
    const lesson = await this.lessonRepository.findOne({
      where: { lesson_id: checkpoint.lessonId },
      relations: { chapter: { level: true } },
    });

    // ถ้า lesson ไม่ใช่ประเภท CHECKPOINT หรือไม่มีบทเรียนที่เกี่ยวข้องก็ไม่ต้องคำนวณคะแนนใหม่
    if (lesson?.chapter?.level) {
      checkpoint.checkpointScore = this.checkpointScoreFromLevelOrderIndex(
        lesson.chapter.level.level_orderIndex,
      );
    }

    // อัปเดตข้อมูล checkpoint ตาม DTO ที่ส่งมา (ถ้า field ไหนใน DTO เป็น undefined ให้เก็บค่าเดิมไว้)
    Object.assign(checkpoint, {
      checkpointType: dto.checkpoint_type ?? checkpoint.checkpointType,
      checkpointQuestions: dto.checkpoint_questions ?? checkpoint.checkpointQuestions,
      checkpointOption: dto.checkpoint_option ?? checkpoint.checkpointOption,
      checkpointAnswer: dto.checkpoint_answer ?? checkpoint.checkpointAnswer,
      checkpointExplanation: dto.checkpoint_explanation ?? checkpoint.checkpointExplanation,
    });

    return this.checkpointRepository.save(checkpoint);
  }

  async updateCheckpointByLessonId(
    lessonId: number,
    dto: Partial<UpdateCheckpointDto>,
  ): Promise<QuizsCheckpoint> {
    const checkpoint = await this.findOneCheckpointByLessonId(lessonId);
    const updatedCheckpoint = await this.updateCheckpoint(checkpoint.checkpointId, dto);

    await this.lessonRepository.update(lessonId, { isPublished: true });

    const lesson = await this.lessonRepository.findOne({
      where: { lesson_id: lessonId },
    });

    if (lesson) {
      await this.syncChapterIsPublishedByChapterId(lesson.chapter_id);
    }
    return updatedCheckpoint;
  }

  async removeQuizs(lessonId: number): Promise<{ message: string }> {
    const quiz = await this.findOneQuizsByLesson(lessonId);
    await this.quizsRepository.remove(quiz);

    // ลบค่า lesson_description ของ lesson ที่ผูกกับ quiz
    const lesson = await this.lessonRepository.findOne({ where: { lesson_id: lessonId } });
    let descCleared = false;
    if (lesson) {
      if (lesson.lesson_description !== null && lesson.lesson_description !== undefined) {
        lesson.lesson_description = null;
        await this.lessonRepository.save(lesson);
        descCleared = true;
      }
    }

    const msg = descCleared
      ? `Quiz ${lessonId} deleted and lesson_description cleared.`
      : `Quiz ${lessonId} deleted.`;

    return { message: msg };
  }

  async removeCheckpointByLessonId(lessonId: number): Promise<{ message: string }> {
    const checkpoint = await this.findOneCheckpointByLessonId(lessonId);
    await this.checkpointRepository.remove(checkpoint);

    // ลบค่า lesson_description ของ lesson ที่ผูกกับ checkpoint
    const lesson = await this.lessonRepository.findOne({ where: { lesson_id: lessonId } });
    let descCleared = false;
    if (lesson) {
      if (lesson.lesson_description !== null && lesson.lesson_description !== undefined) {
        lesson.lesson_description = null;
        await this.lessonRepository.save(lesson);
        descCleared = true;
      }

      // Prevent published checkpoint lessons from existing without checkpoint content.
      if (lesson.lesson_type === LessonType.CHECKPOINT && lesson.isPublished) {
        await this.lessonRepository.update(lessonId, { isPublished: false });
      }

      await this.syncChapterIsPublishedByChapterId(lesson.chapter_id);
    }

    const msg = descCleared
      ? `Checkpoint ${lessonId} deleted and lesson_description cleared.`
      : `Checkpoint ${lessonId} deleted.`;

    return { message: msg };
  }


  // Checkpoint CRUD operations
  async createCheckpoint(dto: CreateCheckpointDto): Promise<QuizsCheckpoint> {
    const lesson = await this.lessonRepository.findOne({
      where: { lesson_id: dto.lesson_id },
      relations: { chapter: { level: true } },
    });
    if (!lesson) {
      throw new NotFoundException(`Lesson ${dto.lesson_id} not found`);
    }

    if (lesson.lesson_type !== LessonType.CHECKPOINT) {
      throw new BadRequestException('lesson is not type CHECKPOINT');
    }

    const checkpointScore = lesson?.chapter?.level
      ? this.checkpointScoreFromLevelOrderIndex(lesson.chapter.level.level_orderIndex)
      : 5;

    const existing = await this.checkpointRepository.findOne({
      where: { lessonId: dto.lesson_id },
      order: { checkpointId: 'DESC' },
    });

    // เตรียมข้อมูลสำหรับสร้างหรืออัปเดต checkpoint
    const data = {
      lessonId: dto.lesson_id,
      checkpointScore,
      checkpointType: dto.checkpoint_type,
      checkpointQuestions: dto.checkpoint_questions,
      checkpointOption: dto.checkpoint_option,
      checkpointAnswer: dto.checkpoint_answer,
      checkpointExplanation: dto.checkpoint_explanation,
    };

    // ถ้ามีอยู่แล้วให้ Update
    if (existing) {
      Object.assign(existing, data);
      const saved = await this.checkpointRepository.save(existing);

      // อัปเดต lesson ให้ isPublished = true
      await this.lessonRepository.update(dto.lesson_id, { isPublished: true });

      await this.syncChapterIsPublishedByChapterId(lesson.chapter_id);
      return saved;
    }

    // ถ้าไม่มีให้สร้างใหม่
    const checkpoint = this.checkpointRepository.create(data);
    const saved = await this.checkpointRepository.save(checkpoint);

    // อัปเดต lesson ให้ isPublished = true
    await this.lessonRepository.update(dto.lesson_id, { isPublished: true });

    await this.syncChapterIsPublishedByChapterId(lesson.chapter_id);
    return saved;
  }

  async findCheckpointsByLesson(
    lessonId: number,
    userId: string,
  ) {
    const lesson = await this.lessonRepository.findOne({
      where: { lesson_id: lessonId },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${lessonId} not found`);
    }

    // ถ้า lesson ไม่ใช่ประเภท CHECKPOINT ให้คืนค่าเป็น array ว่าง
    if (lesson.lesson_type !== LessonType.CHECKPOINT) {
      return [];
    }

    // โหลดข้อมูล checkpoint ทั้งหมดของบทเรียนนี้
    const checkpoints = await this.checkpointRepository.find({
      where: { lessonId },
    });

    // ถ้าไม่มี checkpoint เลยก็คืนค่าเป็น array ว่าง
    if (!checkpoints.length) {
      return [];
    }

    // โหลดผลลัพธ์ของผู้ใช้สำหรับ checkpoint ทั้งหมดนี้ในครั้งเดียว
    const checkpointIds = checkpoints.map((c) => c.checkpointId);

    const results = await this.resultRepository.find({
      where: {
        userId,
        type: QuizsResultType.CHECKPOINT,
        checkpointId: In(checkpointIds),
      },
    })

    const resultByCheckpointId = new Map(
      results.map((r) => [r.checkpointId, r] as const)
    );

    // รวมข้อมูล checkpoint กับผลลัพธ์ของผู้ใช้เพื่อส่งกลับไปให้ frontend แสดงสถานะการทำ checkpoint ของผู้ใช้แต่ละข้อ
    return checkpoints.map((c) => {
      const r = resultByCheckpointId.get(c.checkpointId) ?? null;

      const attempted = r?.userAnswer != null;
      const isCorrect = attempted ? r?.isCorrect === true : false;
      const isSkipped = r?.status === QuizsStatus.SKIPPED;

      const checkpointStatus = isCorrect ? 'COMPLETED' : isSkipped ? 'SKIPPED' : 'PENDING';

      // ถ้ายังไม่เคยตอบ ไม่ต้องแสดงคำตอบที่ถูกต้องและเฉลย
      const correctScore = c.checkpointScore ?? 5;
      const showSolution = attempted || isSkipped;

      return {
        checkpoint_id: c.checkpointId,
        lesson_id: c.lessonId,
        chapter_id: lesson.chapter_id,
        type: c.checkpointType,
        question: c.checkpointQuestions,
        options: c.checkpointOption ?? null,

        // ข้อมูลสำหรับแสดงสถานะการทำ checkpoint ของผู้ใช้
        student_progress: {
          correct_answer: showSolution ? c.checkpointAnswer : null,
          user_answer: r?.userAnswer ?? null,
          is_correct: attempted ? (r?.isCorrect ?? null) : null,
          feedback: isSkipped ? 'ข้ามแล้ว' : attempted ? (isCorrect ? 'ผ่านแล้ว' : 'เกือบถูกแล้ว !') : null,
          checkpoint_status: checkpointStatus,
        },

        // ข้อมูลสำหรับแสดงเฉลยและคำอธิบายของ checkpoint (ถ้ายังไม่เคยตอบ ไม่ต้องแสดงคำตอบที่ถูกต้องและเฉลย)
        checkpoint_explanation: showSolution ? (c.checkpointExplanation ?? null) : null,
        score: attempted ? (isCorrect ? correctScore : 0) : isSkipped ? 0 : null,
      };
    });
  }

  async skipCheckpoint(checkpointId: number, userId: string) {
    const checkpoint = await this.checkpointRepository.findOne({
      where: { checkpointId },
    });

    if (!checkpoint) {
      throw new NotFoundException('Checkpoint not found');
    }

    // โหลดผลลัพธ์ของผู้ใช้สำหรับ checkpoint นี้
    const existing = await this.resultRepository.findOne({
      where: {
        userId,
        type: QuizsResultType.CHECKPOINT,
        checkpointId,
      },
    });

    // ถ้าตอบถูกไปแล้วไม่ว่าจะถูกหรือผิดก็ไม่ให้ข้ามอีก และถ้าตอบไปแล้วจะไม่ให้แก้ไขคำตอบ
    if (existing?.isCorrect === true && existing.userAnswer != null) {
      throw new ConflictException('This checkpoint has already been completed and cannot be skipped.');
    }

    // ถ้าข้ามไปแล้วไม่ว่าจะถูกหรือผิดก็ไม่ให้ข้ามซ้ำอีก (single attempt) และถ้าข้ามไปแล้วจะไม่ให้แก้ไขคำตอบ
    if (existing?.status === QuizsStatus.SKIPPED) {
      return {
        checkpoint_id: checkpoint.checkpointId,
        lesson_id: checkpoint.lessonId,
        user_answer: null,
        is_correct: null,
        score: 0,
        correct_answer: checkpoint.checkpointAnswer,
        checkpoint_explanation: checkpoint.checkpointExplanation ?? null,
        feedback: 'ข้ามแล้ว',
        checkpoint_status: 'SKIPPED',
      };
    }

    // บันทึกผลเป็น SKIPPED (ถ้ายังไม่มีผลลัพธ์ หรือเคยตอบผิดมาก่อน)
    let toSave = existing;
    if (!toSave) {
      toSave = this.resultRepository.create({
        userId,
        lessonId: checkpoint.lessonId,
        type: QuizsResultType.CHECKPOINT,
        checkpointId,
      });

    // ถ้าไม่มีผลลัพธ์เดิมเลย ให้สร้างใหม่โดยกำหนด type เป็น CHECKPOINT และ checkpointId ตาม checkpoint ที่กำลังข้าม
    } else {
      toSave.type = QuizsResultType.CHECKPOINT;
      toSave.checkpointId = checkpoint.checkpointId;
    }

    // ไม่ว่าจะมีผลลัพธ์เดิมหรือไม่ ให้บันทึกสถานะเป็น SKIPPED และ userAnswer/isCorrect เป็น null
    toSave.status = QuizsStatus.SKIPPED;
    toSave.userAnswer = null;
    toSave.isCorrect = null;
    await this.resultRepository.save(toSave);

    return {
      checkpoint_id: checkpoint.checkpointId,
      lesson_id: checkpoint.lessonId,
      user_answer: null,
      is_correct: null,
      score: 0,
      correct_answer: checkpoint.checkpointAnswer,
      checkpoint_explanation: checkpoint.checkpointExplanation ?? null,
      feedback: 'ข้ามแล้ว',
      checkpoint_status: 'SKIPPED',
    };
  }

  private async syncUserXp(
    userId: string,
    chapterId: number,
  ) {
    // โหลดข้อมูล checkpoint ทั้งหมดในบทนี้เพื่อคำนวณ XP สูงสุดที่ผู้ใช้จะได้รับจากบทนี้
    const lessonsInChapter = await this.lessonRepository.find({
      where: { chapter_id: chapterId },
    });

    const lessonIds = lessonsInChapter.map((l) => l.lesson_id);

    // ถ้าไม่มีบทเรียนในบทนี้เลยก็ไม่ต้องคำนวณ XP
    const checkpoints = lessonIds.length
      ? await this.checkpointRepository.find({ where: { lessonId: In(lessonIds) } })
      : [];

    const totalXp = checkpoints.reduce((sum, c) => sum + (c.checkpointScore ?? 5), 0);

    // โหลดผลลัพธ์ของผู้ใช้สำหรับ checkpoint ทั้งหมดในบทนี้
    const checkpointIds = checkpoints.map((c) => c.checkpointId);

    // ถ้าไม่มี checkpoint เลยก็ไม่ต้องคำนวณ XP และไม่ต้องอัปเดต user_xp
    const results = checkpointIds.length
      ? await this.resultRepository.find({
        where: {
          userId,
          type: QuizsResultType.CHECKPOINT,
          checkpointId: In(checkpointIds),
        },
      })
      : [];

    // คำนวณ XP ที่ผู้ใช้ได้รับจากบทนี้โดยการรวมคะแนนของ checkpoint ที่ตอบถูกทั้งหมดในบทนี้
    const earnedXp = results.reduce((sum, r) => {
      if (r.isCorrect) {
        const cp = checkpoints.find((c) => c.checkpointId === r.checkpointId);
        return sum + (cp?.checkpointScore ?? 5);
      }
      return sum;
    }, 0);

    let userXp = await this.userXpRepository.findOne({
      where: { userId, chapterId },
    });

    // คำนวณ cumulative xpTotal = sum(xpEarned ของบทอื่น ๆ) + earnedXp ของบทนี้
    const otherRaw = await this.userXpRepository
      .createQueryBuilder('ux')
      .select('COALESCE(SUM(ux.xpEarned), 0)', 'sum')
      .where('ux.userId = :userId', { userId })
      .andWhere('ux.chapterId != :chapterId', { chapterId })
      .getRawOne<{ sum: string }>();

    const sumOther = Number(otherRaw?.sum ?? 0);
    const cumulativeTotal = sumOther + earnedXp;

    // ถ้ายังไม่มี user_xp ของบทนี้ → สร้างใหม่ (userId, chapterId, xpEarned, xpTotal, checkpointStatus, completedAt, lastAttemptAt)
    if (!userXp) {
      userXp = this.userXpRepository.create({
        userId,
        chapterId,
        xpEarned: earnedXp,
        xpTotal: cumulativeTotal,
        checkpointStatus: earnedXp === totalXp ? 'COMPLETED' : 'PENDING',
        completedAt: earnedXp === totalXp ? new Date() : null,
        lastAttemptAt: new Date(),
      });
    // ถ้ามีอยู่แล้วอัพเดต (xpEarned, xpTotal, checkpointStatus, completedAt, lastAttemptAt)
    } else {
      userXp.xpEarned = earnedXp;
      userXp.xpTotal = cumulativeTotal;
      userXp.lastAttemptAt = new Date();

      // ถ้า earnedXp เท่ากับ totalXp แสดงว่าผู้ใช้ทำ checkpoint ในบทนี้ผ่านทั้งหมดแล้ว ให้เปลี่ยนสถานะเป็น COMPLETED และบันทึกวันที่ทำสำเร็จ
      if (earnedXp === totalXp && totalXp > 0) {
        userXp.checkpointStatus = 'COMPLETED';
        userXp.completedAt = new Date();
      }
    }

    await this.userXpRepository.save(userXp);
  }

  // function skip checkpoint ทั้งบทเรียน (ใช้ในกรณีที่ผู้ใช้ข้ามบทเรียนที่มี checkpoint หลายข้อ)
  async skipCheckpointsByLesson(lessonId: number, userId: string) {
    const checkpoints = await this.checkpointRepository.find({
      where: { lessonId },
    });

    if (!checkpoints.length) {
      return [];
    }

    return Promise.all(
      checkpoints.map((c) => this.skipCheckpoint(c.checkpointId, userId)),
    );
  }

  // ตรวจคำตอบ checkpoint และบันทึกผล
  async checkCheckpointAnswer(
    checkpointId: number,
    userId: string,
    answer: any,
  ) {
    const checkpoint = await this.checkpointRepository.findOne({
      where: { checkpointId },
    });

    if (!checkpoint) {
      throw new NotFoundException('Checkpoint not found');
    }

    // โหลดผลลัพธ์ของผู้ใช้สำหรับ checkpoint นี้
    const existing = await this.resultRepository.findOne({
      where: {
        userId,
        type: QuizsResultType.CHECKPOINT,
        checkpointId,
      },
    });

    // ถ้าตอบถูกไปแล้วไม่ว่าจะถูกหรือผิดก็ไม่ให้ตอบอีก และถ้าตอบไปแล้วจะไม่ให้แก้ไขคำตอบ
    if (existing?.isCorrect === true && existing.userAnswer != null) {
      throw new ConflictException(
        'This checkpoint has already been completed.',
      );
    }

    // isEqual ฟังก์ชันช่วยเปรียบเทียบคำตอบแบบ deep equality (รองรับการเปรียบเทียบ array/object โดยไม่สนใจลำดับ)
    const isCorrect = isEqual(checkpoint.checkpointAnswer, answer);
    const correctScore = checkpoint.checkpointScore ?? 5;
    const score = isCorrect ? correctScore : 0;

    // เช็คว่าผู้ใช้มีผลลัพธ์ของ checkpoint นี้อยู่แล้วหรือไม่ ถ้ามีให้ update ถ้าไม่มีให้สร้างใหม่
    const toSave =
      existing ??
      this.resultRepository.create({
        userId,
        lessonId: checkpoint.lessonId,
        type: QuizsResultType.CHECKPOINT,
        checkpointId,
      });

    // บันทึกคำตอบและสถานะ (ถ้าตอบแล้วจะเปลี่ยนสถานะเป็น COMPLETED ไม่ว่าจะถูกหรือผิด)
    toSave.userAnswer = answer;
    toSave.isCorrect = isCorrect;
    toSave.status = isCorrect
      ? QuizsStatus.COMPLETED
      : QuizsStatus.PENDING;

    await this.resultRepository.save(toSave);

    // ถ้าตอบถูกต้องจะคำนวณ XP และอัปเดต progress ของผู้ใช้ในบทนั้น ๆ ถ้าถูกจะได้ XP ถ้าผิดจะไม่ได้
    const lesson = await this.lessonRepository.findOne({
      where: { lesson_id: checkpoint.lessonId },
    });

    if (lesson) {
      await this.syncUserXp(
        userId,
        lesson.chapter_id,
      );
    }

    return {
      checkpoint_id: checkpoint.checkpointId,
      lesson_id: checkpoint.lessonId,
      chapter_id: lesson?.chapter_id ?? null,
      user_answer: answer,
      is_correct: isCorrect,
      score,
      correct_answer: checkpoint.checkpointAnswer,
      checkpoint_explanation:
        checkpoint.checkpointExplanation ?? null,
      feedback: isCorrect
        ? 'ยอดเยี่ยมมาก !'
        : 'เกือบถูกแล้ว !',
      checkpoint_status: isCorrect
        ? 'COMPLETED'
        : 'PENDING',
    };
  }
}

// ฟังก์ชันช่วยเปรียบเทียบคำตอบแบบ deep equality (รองรับการเปรียบเทียบ array/object โดยไม่สนใจลำดับ)
function normalize(value: any): any {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const lowered = trimmed.toLowerCase();

    if (lowered === 'true' || trimmed === 'ถูก') {
      return true;
    }

    if (lowered === 'false' || trimmed === 'ผิด') {
      return false;
    }

    if (!isNaN(Number(trimmed))) {
      return Number(trimmed);
    }

    return lowered;
  }

  if (Array.isArray(value)) {
    return value.map(normalize).sort();
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = normalize(value[key]);
        return acc;
      }, {} as any);
  }

  return value;
}

function isEqual(a: any, b: any): boolean {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}
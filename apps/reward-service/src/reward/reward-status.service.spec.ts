import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { RewardStatusService } from './reward-status.service';
import { Reward } from './entities/rewards.entity';

describe('RewardStatusService', () => {
  let service: RewardStatusService;

  const executeMock = jest.fn();
  const andWhereMock = jest.fn();
  const whereMock = jest.fn();
  const setMock = jest.fn();
  const updateMock = jest.fn();
  const createQueryBuilderMock = jest.fn();

  beforeEach(async () => {
    executeMock.mockResolvedValue({ affected: 2 });
    andWhereMock.mockReturnValue({ andWhere: andWhereMock, execute: executeMock });
    whereMock.mockReturnValue({ andWhere: andWhereMock });
    setMock.mockReturnValue({ where: whereMock });
    updateMock.mockReturnValue({ set: setMock });
    createQueryBuilderMock.mockReturnValue({ update: updateMock });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RewardStatusService,
        {
          provide: getRepositoryToken(Reward, 'reward'),
          useValue: {
            createQueryBuilder: createQueryBuilderMock,
          },
        },
      ],
    }).compile();

    service = module.get<RewardStatusService>(RewardStatusService);

    jest.clearAllMocks();
    executeMock.mockResolvedValue({ affected: 2 });
    andWhereMock.mockReturnValue({ andWhere: andWhereMock, execute: executeMock });
    whereMock.mockReturnValue({ andWhere: andWhereMock });
    setMock.mockReturnValue({ where: whereMock });
    updateMock.mockReturnValue({ set: setMock });
    createQueryBuilderMock.mockReturnValue({ update: updateMock });
  });

  it('returns false for active status when redeem end date is already expired', () => {
    const now = new Date('2026-03-12T12:00:00.000Z');
    const expiredEndDate = '2026-03-12T11:59:59.000Z';

    expect(service.resolveActiveStatus(true, expiredEndDate, now)).toBe(false);
  });

  it('keeps inactive status false even when redeem end date is in the future', () => {
    const now = new Date('2026-03-12T12:00:00.000Z');
    const futureEndDate = '2026-03-12T12:30:00.000Z';

    expect(service.resolveActiveStatus(false, futureEndDate, now)).toBe(false);
  });

  it('treats stored Date values as Bangkok wall-clock timestamps when resolving status', () => {
    const now = new Date('2026-03-30T17:49:00.000Z');
    const futureEndDate = new Date('2026-03-31T01:18:00.000Z');

    expect(service.resolveActiveStatus(true, futureEndDate, now)).toBe(true);
  });

  it('treats stored Date values as not started before Bangkok redeem_start_date', () => {
    const now = new Date('2026-03-12T17:40:00.000Z');
    const redeemStartDate = new Date('2026-03-13T00:48:00.000Z');

    expect(service.hasStarted(redeemStartDate, now)).toBe(false);
  });

  it('updates expired rewards to is_active false during sync', async () => {
    const affected = await service.syncExpiredRewards();

    expect(createQueryBuilderMock).toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith(Reward);
    expect(setMock).toHaveBeenCalledWith({ is_active: false });
    expect(whereMock).toHaveBeenCalledWith('is_active = :active', { active: true });
    expect(andWhereMock).toHaveBeenNthCalledWith(1, 'redeem_end_date IS NOT NULL');
    expect(andWhereMock).toHaveBeenNthCalledWith(2, `redeem_end_date < (NOW() AT TIME ZONE 'Asia/Bangkok')`);
    expect(affected).toBe(2);
  });
});
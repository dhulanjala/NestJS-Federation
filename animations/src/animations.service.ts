import { Injectable } from '@nestjs/common';
import { Animation } from './animation.model';

@Injectable()
export class AnimationsService {
  private readonly animations: Animation[] = [
    { id: 'a1', title: 'Bounce In', durationMs: 400, ownerId: '1' },
    { id: 'a2', title: 'Fade Out', durationMs: 250, ownerId: '1' },
    { id: 'a3', title: 'Spin Loop', durationMs: 1200, ownerId: '2' },
    { id: 'a4', title: 'Slide Up', durationMs: 300, ownerId: '3' },
  ];

  private naiveLookupCount = 0;

  findAll(): Animation[] {
    return this.animations;
  }

  findById(id: string): Animation | undefined {
    return this.animations.find((a) => a.id === id);
  }

  // Deliberately naive "DB call" — looks up one owner at a time. Called
  // once per parent User object when there's no batching, which is the
  // N+1 this project demonstrates.
  findByOwnerIdNaive(ownerId: string): Animation[] {
    this.naiveLookupCount++;
    console.log(`[animations] naive lookup #${this.naiveLookupCount} for ownerId=${ownerId}`);
    return this.animations.filter((a) => a.ownerId === ownerId);
  }

  // The batched version DataLoader calls with ALL pending ownerIds at once.
  findByOwnerIdsBatched(ownerIds: readonly string[]): Animation[][] {
    console.log(`[animations] batched lookup for ownerIds=[${ownerIds.join(', ')}]`);
    return ownerIds.map((id) => this.animations.filter((a) => a.ownerId === id));
  }
}

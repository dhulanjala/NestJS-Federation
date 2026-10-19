import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { Animation } from './animation.model';
import { AnimationsService } from './animations.service';

// Scope.REQUEST means Nest constructs a fresh instance of this class per
// GraphQL request — so the DataLoader inside it naturally starts empty
// each time. DataLoader collects every `.load(ownerId)` call made during
// one tick of the event loop and fires `findByOwnerIdsBatched` exactly
// once with all of them — that's what collapses the per-user N+1 into
// one call. Any resolver that injects this class becomes request-scoped
// too, which is expected and fine.
@Injectable({ scope: Scope.REQUEST })
export class AnimationsLoader {
  private readonly loader: DataLoader<string, Animation[]>;

  constructor(private readonly animationsService: AnimationsService) {
    this.loader = new DataLoader<string, Animation[]>(async (ownerIds) =>
      this.animationsService.findByOwnerIdsBatched(ownerIds),
    );
  }

  load(ownerId: string): Promise<Animation[]> {
    return this.loader.load(ownerId);
  }
}

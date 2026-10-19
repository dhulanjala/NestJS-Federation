import { Injectable } from '@nestjs/common';
import { Project } from './project.model';

@Injectable()
export class ProjectsService {
  private readonly projects: Project[] = [
    // a1 has two projects on purpose — that's the "one animation, many
    // projects" multiplicity this subgraph demonstrates.
    { id: 'p1', name: 'Marketing Site', animationId: 'a1' },
    { id: 'p2', name: 'Product Launch Page', animationId: 'a1' },
    { id: 'p3', name: 'Mobile App', animationId: 'a3' },
  ];

  findAll(): Project[] {
    return this.projects;
  }

  findById(id: string): Project | undefined {
    return this.projects.find((p) => p.id === id);
  }

  findByAnimationId(animationId: string): Project[] {
    return this.projects.filter((p) => p.animationId === animationId);
  }
}

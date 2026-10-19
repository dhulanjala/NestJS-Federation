import { Injectable } from '@nestjs/common';
import { User } from './user.model';

@Injectable()
export class UsersService {
  private readonly users: User[] = [
    { id: '1', name: 'Ada Lovelace', email: 'ada@example.com' },
    { id: '2', name: 'Grace Hopper', email: 'grace@example.com' },
    { id: '3', name: 'Alan Turing', email: 'alan@example.com' },
  ];

  findAll(): User[] {
    return this.users;
  }

  findById(id: string): User | undefined {
    return this.users.find((u) => u.id === id);
  }
}

import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(private prisma: PrismaService) {
    super();
  }

  serializeUser(user: any, done: (err: Error | null, user: any) => void) {
    done(null, { id: user.id, email: user.email, role: user.role });
  }

  async deserializeUser(payload: any, done: (err: Error | null, user: any) => void) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.id },
    });
    
    if (user) {
      done(null, user);
    } else {
      done(new Error('User not found'), null);
    }
  }
}
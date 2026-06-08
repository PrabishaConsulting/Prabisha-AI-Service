import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException, HttpStatus } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class LoginThrottlerInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const session = request.session;

    if (session) {
      const now = Date.now();
      const lastHit = session.lastAuthInitiated;

      // Drop requests hitting less than 2.5 seconds apart
      if (lastHit && (now - lastHit < 2500)) {
        console.warn(`[${new Date().toLocaleTimeString()}] Blocked duplicate rapid /auth/central execution loop`);
        throw new HttpException('Authentication in progress, please wait...', HttpStatus.TOO_MANY_REQUESTS);
      }

      // Track the execution timestamp
      session.lastAuthInitiated = now;
    }

    return next.handle();
  }
}
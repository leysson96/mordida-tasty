import { BadRequestException, CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { catchError, throwError } from 'rxjs';

@Injectable()
export class UploadErrorInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(catchError((error: unknown) => {
      // Nest's adapter matches old message text; Multer 2.5 keeps the stable error code.
      if (error instanceof Error && error.name === 'MulterError' &&
          'code' in error && error.code === 'LIMIT_UNEXPECTED_FILE') {
        return throwError(() => new BadRequestException('Unexpected file field'));
      }
      return throwError(() => error);
    }));
  }
}

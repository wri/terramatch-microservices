import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  data: T;
}

/**
 * Transforms all method responses into a JSON API response structure.
 * TODO: support additional properties (beyond just data) on the response structure. This will
 *   likely involve returning a custom response object in those cases that this interceptor knows
 *   to look for.
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<Response<T>> {
    return next.handle().pipe(map(data => ({ data })));
  }
}

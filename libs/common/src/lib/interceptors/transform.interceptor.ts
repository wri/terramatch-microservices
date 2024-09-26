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

function transform<T>(data: any) {
  const { type, ...attributes } = data.attributes;

  return {
    data: { type, id: data.id, attributes }
  } as Response<T>;
}

/**
 * Transforms all method responses into a JSON API response structure.
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept = (
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<Response<T>> => next.handle().pipe(map(transform<T>));
}

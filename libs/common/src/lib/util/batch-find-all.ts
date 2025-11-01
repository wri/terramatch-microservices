import { Model } from "sequelize-typescript";
import { PaginatedQueryBuilder } from "./paginated-query.builder";
import { InternalServerErrorException } from "@nestjs/common";

export async function* batchFindAll<T extends Model<T>>(builder: PaginatedQueryBuilder<T>): AsyncGenerator<T[]> {
  if (builder.pageSize == null) {
    throw new InternalServerErrorException("batchFindAll requires a page size to be defined");
  }

  const total = await builder.paginationTotal();
  const totalPages = Math.ceil(total / builder.pageSize);
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    builder.pageNumber(pageNumber);
    yield await builder.execute();
  }
}

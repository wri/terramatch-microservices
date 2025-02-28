import { User } from "../libs/database/src/lib/entities";

beforeAll(async () => {
  await User.sequelize!.sync();
});

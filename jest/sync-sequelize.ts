import { User } from "../libs/database/src/lib/entities";

beforeAll(async () => {
  try {
    await User.sequelize!.sync();
  } catch (e) {
    console.error("Failed to sync database:", e);
    throw e;
  }
});

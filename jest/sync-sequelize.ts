import { User } from "../libs/database/src/lib/entities";

// First sync on an empty test DB creates 80+ tables and can exceed Jest's default 5s hook timeout.
beforeAll(async () => {
  try {
    await User.sequelize!.sync();
  } catch (e) {
    console.error("Failed to sync database:", e);
    throw e;
  }
}, 120_000);

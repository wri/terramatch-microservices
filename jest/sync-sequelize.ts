import { User } from "../libs/database/src/lib/entities";

// Full schema sync (used by setup-test-database.sh) can take well over Jest's default 5s hook
// timeout. When that fires, afterAll closes the pool while sync is still running and Sequelize
// throws "ConnectionManager.getConnection was called after the connection manager was closed!".
beforeAll(async () => {
  try {
    await User.sequelize!.sync();
  } catch (e) {
    console.error("Failed to sync database:", e);
    throw e;
  }
}, 120_000);

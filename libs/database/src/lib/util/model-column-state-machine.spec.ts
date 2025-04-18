import { Model, Sequelize, Table } from "sequelize-typescript";
import { StateMachineColumn, StateMachineException, States, transitions } from "./model-column-state-machine";
import { SEQUELIZE_GLOBAL_HOOKS } from "../sequelize-config.service";

const hook = jest.fn(() => undefined);
const transitionValid = jest.fn(() => true);

type StubStatus = "first" | "second" | "third" | "final";
const StubStates: States<StubModel, StubStatus> = {
  default: "first",

  transitions: transitions()
    .from("first", () => ["second", "final"])
    .from("second", () => ["third", "final"])
    .from("third", () => ["final"]).transitions,

  transitionValidForModel: transitionValid,

  afterTransitionHooks: {
    final: hook
  }
};

@Table({})
class StubModel extends Model<StubModel> {
  @StateMachineColumn(StubStates)
  status: StubStatus;
}

const sequelize = new Sequelize({
  dialect: "sqlite",
  database: "test_db",
  storage: ":memory:",
  logging: false,
  models: [StubModel],
  hooks: SEQUELIZE_GLOBAL_HOOKS
});

async function createModel(status?: StubStatus) {
  const model = new StubModel();
  if (status != null) model.status = status;
  await model.save();
  return model;
}

describe("ModelColumnStateMachine", () => {
  beforeAll(async () => {
    await sequelize.sync();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    transitionValid.mockClear();
    hook.mockClear();
  });

  it("should return the current status string from the model attribute getter", async () => {
    expect((await createModel()).status).toBe("first");
    expect((await createModel("second")).status).toBe("second");
  });

  it("should allow a new model to start with any state", async () => {
    expect(() => (new StubModel().status = "third")).not.toThrow(StateMachineException);
  });

  it("should throw when the transition is not defined", async () => {
    const model = new StubModel();
    model.isNewRecord = false;
    expect(() => (model.status = "third")).toThrow(StateMachineException);
  });

  it("should throw if the current state is not defined in the SM", async () => {
    const model = await createModel("foo" as StubStatus);
    expect(() => (model.status = "first")).toThrow(StateMachineException);
    expect(() => (model.status = "second")).toThrow(StateMachineException);
    expect(() => (model.status = "third")).toThrow(StateMachineException);
    expect(() => (model.status = "final")).toThrow(StateMachineException);
  });

  it("should serialize to the string value of the state", async () => {
    let result = JSON.parse(JSON.stringify(await createModel()));
    expect(result.status).toBe("first");
    result = JSON.parse(JSON.stringify(await createModel("final")));
    expect(result.status).toBe("final");
  });

  it("should allow a transition to the current status", async () => {
    const model = await createModel("second");
    expect(() => (model.status = "second")).not.toThrow(StateMachineException);
  });

  it("should check validations with defined validator", async () => {
    const model = await createModel();
    model.status = "second";
    expect(transitionValid).toHaveBeenCalledWith("first", "second", model);

    transitionValid.mockClear();
    transitionValid.mockReturnValueOnce(false);
    expect(() => (model.status = "third")).toThrow(StateMachineException);
    expect(transitionValid).toHaveBeenCalledWith("second", "third", model);
  });

  it("should process after save hooks", async () => {
    const model = await createModel("second");
    await model.update({ status: "third" });
    expect(hook).not.toHaveBeenCalled();

    await model.update({ status: "final" });
    expect(hook).toHaveBeenCalledTimes(1);
  });
});

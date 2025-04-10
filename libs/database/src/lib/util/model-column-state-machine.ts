import { Column, Model } from "sequelize-typescript";
import { Attributes, STRING } from "sequelize";
import { HttpException, HttpStatus } from "@nestjs/common";

export type States<M extends Model, S extends string> = {
  default: S;
  transitions: Partial<Record<S, S[]>>;

  /**
   * If specified, this function can be used to perform extra validations for a transition within
   * the context of the model it's attached to. If the function is defined and returns false, the
   * transition will be rejected with a StateMachineError.
   *
   * @param from The "from" state for the transition
   * @param to The "to" state for the transition
   * @param model The model the transition will be applied to.
   */
  transitionValidForModel?: (from: S, to: S, model: M) => boolean;

  /**
   * Specify hooks that should be fired when a given state is transitioned to. The callback
   * will be executed after the model has been saved.
   *
   * Note: This means that if multiple transitions are executed on a given model column without
   * a save to the database in between, this hook will only fire after the _last_ transition. To
   * ensure the hook fires for every transition, make sure to save the model state between
   * successive transitions.
   */
  afterTransitionHooks?: Partial<Record<S, (from: S, model: M) => void>>;
};

// Extends HttpException so these errors bubble up to the API consumer
export class StateMachineException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.BAD_REQUEST);
  }
}

export type StateMachineModel<M extends Model, S extends string> = M & {
  _stateMachines?: Record<string, ModelColumnStateMachine<M, S>>;
};

function ensureStateMachine<M extends Model, S extends string>(
  model: StateMachineModel<M, S>,
  propertyName: keyof Attributes<M>,
  states: States<M, S>
) {
  if (model._stateMachines == null) model._stateMachines = {};
  if (model._stateMachines[propertyName as string] == null) {
    model._stateMachines[propertyName as string] = new ModelColumnStateMachine(model, propertyName, states);
  }
  return model._stateMachines[propertyName as string];
}

export function getStateMachine<M extends Model, S extends string>(model: M, propertyName: keyof Attributes<M>) {
  return (model as StateMachineModel<M, S>)._stateMachines?.[propertyName as string];
}

const METADATA_KEY = Symbol("model-column-state-machine");

export const getStateMachineProperties = <M extends Model>(model: M): (keyof Attributes<M>)[] =>
  Reflect.getMetadata(METADATA_KEY, model) ?? [];

/**
 * Apply to any string column in a database model class to enforce state machine mechanics.
 */
export const StateMachineColumn =
  <M extends Model, S extends string>(states: States<M, S>) =>
  (target: M, propertyName: string, propertyDescriptor?: PropertyDescriptor) => {
    // Will cause the `afterSave` method of the state machine to be called when the model is
    // saved. See sequelize-config.service.ts
    Reflect.defineMetadata(METADATA_KEY, [...getStateMachineProperties(target), propertyName], target);

    // Define the sequelize column as we need it. To consumers of the model, it will appear to be a
    // column of type S. If access to the underlying state machine is needed, use getStateMachine()
    Column({
      type: STRING,
      defaultValue: states.default,

      get(this: StateMachineModel<M, S>) {
        return ensureStateMachine(this, propertyName as keyof Attributes<M>, states).current;
      },

      set(this: StateMachineModel<M, S>, value: S) {
        ensureStateMachine(this, propertyName as keyof Attributes<M>, states).transitionTo(value);
      }
    })(target, propertyName, propertyDescriptor);
  };

export class ModelColumnStateMachine<M extends Model, S extends string> {
  constructor(
    protected readonly model: M,
    protected readonly column: keyof Attributes<M>,
    protected readonly states: States<M, S>
  ) {}

  protected fromState?: S;

  get current(): S {
    return this.model.getDataValue(this.column) as S;
  }

  /**
   * Allows this object to serialize to the string value of its DB column when included in an API DTO.
   */
  toJSON() {
    return this.current;
  }

  canBe(from: S, to: S) {
    if (!Object.keys(this.states.transitions).includes(from)) {
      throw new StateMachineException(`Current state is not defined [${from}]`);
    }

    return from === to || this.states.transitions[from]?.includes(to) === true;
  }

  transitionTo(to: S) {
    this.validateTransition(to);

    this.fromState = this.current;
    this.model.setDataValue(this.column, to);
  }

  validateTransition(to: S) {
    if (this.model.isNewRecord) return;

    if (!this.canBe(this.current, to)) {
      throw new StateMachineException(`Transition not valid [from=${this.current}, to=${to}]`);
    }

    if (
      this.states.transitionValidForModel != null &&
      !this.states.transitionValidForModel(this.current, to, this.model)
    ) {
      throw new StateMachineException(
        `Transition not valid for model [from=${this.current}, to=${to}, id=${this.model.id}]`
      );
    }
  }

  afterSave() {
    if (this.fromState == null) return;

    const fromState = this.fromState;
    this.fromState = undefined;
    this.states.afterTransitionHooks?.[this.current]?.(fromState, this.model);
  }
}

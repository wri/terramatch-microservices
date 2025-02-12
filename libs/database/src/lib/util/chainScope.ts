import { ScopeOptions } from "sequelize";
import { Model, ModelCtor } from "sequelize-typescript";

type Scope = string | ScopeOptions;
type ModelWithScopes<T extends Model<T>> = ModelCtor<T> & { _chainedScopes?: Scope[] };

/**
 * Sequelize doesn't support scope method chaining out of the box. If you want to apply the "visible"
 * and "collection" scopes from TreeSpecies, you have to call
 * TreeSpecies.scope(["visible", { method: ["collection", collection]}) in a single call. If you
 * instead do: TreeSpecies.scope("visible").scope({ method: ["collection", collection] }), then
 * the second call to scope overrides the first, and you only get the second scope applied.
 *
 * This method makes scope chaining possible. Under the hood, when you call Model.scope() in Sequelize,
 * you get a new class that extends the model with the scope applied. We can piggyback on that
 * pattern and cache our list of applied scopes on the generated class.
 *
 * To use, create scopes on your model with the @Scopes decorator, then in the model itself, create
 * a static function for each scope. Example from TreeSpecies:
 *
 *   static visible() {
 *     return chainScope(this, "visible") as typeof TreeSpecies;
 *   }
 *
 *   static siteReports(ids: number[] | Literal) {
 *     return chainScope(this, { method: ["siteReports", ids] }) as typeof TreeSpecies;
 *   }
 *
 *   static collection(collection: string) {
 *     return chainScope(this, { method: ["collection", collection] }) as typeof TreeSpecies;
 *   }
 *
 * "as typeof TreeSpecies" is necessary to make the chaining work. With that in place, a call
 * like this will isolate the `sum()` to both scopes:
 * await TreeSpecies.visible().collection("treesPlanted").sum("amount")
 */
export function chainScope<T extends Model<T>>(model: ModelCtor<T>, scope: Scope) {
  let ScopedModel = model as ModelWithScopes<T>;

  const activeScopes = [...(ScopedModel._chainedScopes ?? []), scope];
  ScopedModel = model.scope(activeScopes) as ModelWithScopes<T>;
  ScopedModel._chainedScopes = activeScopes;
  return ScopedModel;
}

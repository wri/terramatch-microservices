import { ScopeOptions } from "sequelize";
import { Model, ModelCtor } from "sequelize-typescript";

type Scope = string | ScopeOptions;
type ModelWithScopes<T extends Model> = ModelCtor<T> & { _chainedScopes?: Scope[] };

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
 * IMPORTANT NOTE ABOUT DEFAULT SCOPES: It is extremely difficult to inject code into the scope
 * process in Sequelize. It turns out there is no way to find out what the current scope looks like
 * through the public API and utilizing private internals could easily mean breaking changes from
 * minor library updates. Therefore, this library has to choose either to a) always apply the default
 * scope when the first chained scope call is made, b) always ignore the default scope, or c)
 * complicate the function params by making it optional. For now, this code follows (a), meaning
 * that even if code calls FooModel.unscoped().collection("foos-planted").project(42) where
 * collection() and project() are scope chaining methods, the default scope will still apply. To work
 * around this, use Sequelize's scoping mechanism directly. In this case that would mean something
 * like: FooModel.scope([{ method: ["collection", "foos-planted"] }, { method: ["project", 42] }])
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
export function chainScope<T extends Model>(model: ModelCtor<T>, scopeName: string, ...args: unknown[]) {
  let ScopedModel = model as ModelWithScopes<T>;

  const scope: Scope = args.length === 0 ? scopeName : { method: [scopeName, ...args] };

  const currentScopes =
    ScopedModel._chainedScopes ?? (ScopedModel.options.defaultScope == null ? [] : ["defaultScope"]);
  const activeScopes = [...currentScopes, scope];
  ScopedModel = model.scope(activeScopes) as ModelWithScopes<T>;
  ScopedModel._chainedScopes = activeScopes;
  return ScopedModel;
}

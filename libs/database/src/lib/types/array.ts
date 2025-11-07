/**
 * A quick method to pass into an array to filter out null / undefined, and correctly type the result.
 *
 * ex:
 * const foo: (string | null)[] = ["one", null, "two", "three"];
 * foo.filter(isNotNull); // results in ["one", "two", "three"], and the type is `string[]` without any 'as' statement.
 */
export const isNotNull = <T>(value: T | null | undefined): value is T => value != null;

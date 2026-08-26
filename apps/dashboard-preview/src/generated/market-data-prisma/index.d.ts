
/**
 * Client
**/

import * as runtime from './runtime/client.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model ForecastCurrentRun
 * 
 */
export type ForecastCurrentRun = $Result.DefaultSelection<Prisma.$ForecastCurrentRunPayload>
/**
 * Model ForecastCurrentPoint
 * 
 */
export type ForecastCurrentPoint = $Result.DefaultSelection<Prisma.$ForecastCurrentPointPayload>
/**
 * Model ForecastVerificationRun
 * 
 */
export type ForecastVerificationRun = $Result.DefaultSelection<Prisma.$ForecastVerificationRunPayload>
/**
 * Model ForecastVerificationMetric
 * 
 */
export type ForecastVerificationMetric = $Result.DefaultSelection<Prisma.$ForecastVerificationMetricPayload>
/**
 * Model ForecastVerificationPoint
 * 
 */
export type ForecastVerificationPoint = $Result.DefaultSelection<Prisma.$ForecastVerificationPointPayload>
/**
 * Model RollingDailyVerificationRecord
 * 
 */
export type RollingDailyVerificationRecord = $Result.DefaultSelection<Prisma.$RollingDailyVerificationRecordPayload>
/**
 * Model RollingDailyCurrentForecastSnapshot
 * 
 */
export type RollingDailyCurrentForecastSnapshot = $Result.DefaultSelection<Prisma.$RollingDailyCurrentForecastSnapshotPayload>
/**
 * Model RollingDailyCalibrationGroup
 * 
 */
export type RollingDailyCalibrationGroup = $Result.DefaultSelection<Prisma.$RollingDailyCalibrationGroupPayload>
/**
 * Model RollingDailyMaintenanceState
 * 
 */
export type RollingDailyMaintenanceState = $Result.DefaultSelection<Prisma.$RollingDailyMaintenanceStatePayload>

/**
 * Enums
 */
export namespace $Enums {
  export const ForecastTargetBasis: {
  MONTHLY_AVERAGE: 'MONTHLY_AVERAGE',
  POINT_IN_TIME: 'POINT_IN_TIME',
  END_OF_PERIOD: 'END_OF_PERIOD'
};

export type ForecastTargetBasis = (typeof ForecastTargetBasis)[keyof typeof ForecastTargetBasis]


export const RollingDailyVerificationMaturityStatus: {
  MATURED: 'MATURED',
  NOT_YET_MATURED: 'NOT_YET_MATURED'
};

export type RollingDailyVerificationMaturityStatus = (typeof RollingDailyVerificationMaturityStatus)[keyof typeof RollingDailyVerificationMaturityStatus]


export const RollingDailyCalibrationStatus: {
  AVAILABLE: 'AVAILABLE',
  INSUFFICIENT_CALIBRATION_HISTORY: 'INSUFFICIENT_CALIBRATION_HISTORY'
};

export type RollingDailyCalibrationStatus = (typeof RollingDailyCalibrationStatus)[keyof typeof RollingDailyCalibrationStatus]

}

export type ForecastTargetBasis = $Enums.ForecastTargetBasis

export const ForecastTargetBasis: typeof $Enums.ForecastTargetBasis

export type RollingDailyVerificationMaturityStatus = $Enums.RollingDailyVerificationMaturityStatus

export const RollingDailyVerificationMaturityStatus: typeof $Enums.RollingDailyVerificationMaturityStatus

export type RollingDailyCalibrationStatus = $Enums.RollingDailyCalibrationStatus

export const RollingDailyCalibrationStatus: typeof $Enums.RollingDailyCalibrationStatus

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient({
 *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
 * })
 * // Fetch zero or more ForecastCurrentRuns
 * const forecastCurrentRuns = await prisma.forecastCurrentRun.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://pris.ly/d/client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient({
   *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
   * })
   * // Fetch zero or more ForecastCurrentRuns
   * const forecastCurrentRuns = await prisma.forecastCurrentRun.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://pris.ly/d/client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/orm/prisma-client/queries/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>

  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.forecastCurrentRun`: Exposes CRUD operations for the **ForecastCurrentRun** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ForecastCurrentRuns
    * const forecastCurrentRuns = await prisma.forecastCurrentRun.findMany()
    * ```
    */
  get forecastCurrentRun(): Prisma.ForecastCurrentRunDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.forecastCurrentPoint`: Exposes CRUD operations for the **ForecastCurrentPoint** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ForecastCurrentPoints
    * const forecastCurrentPoints = await prisma.forecastCurrentPoint.findMany()
    * ```
    */
  get forecastCurrentPoint(): Prisma.ForecastCurrentPointDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.forecastVerificationRun`: Exposes CRUD operations for the **ForecastVerificationRun** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ForecastVerificationRuns
    * const forecastVerificationRuns = await prisma.forecastVerificationRun.findMany()
    * ```
    */
  get forecastVerificationRun(): Prisma.ForecastVerificationRunDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.forecastVerificationMetric`: Exposes CRUD operations for the **ForecastVerificationMetric** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ForecastVerificationMetrics
    * const forecastVerificationMetrics = await prisma.forecastVerificationMetric.findMany()
    * ```
    */
  get forecastVerificationMetric(): Prisma.ForecastVerificationMetricDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.forecastVerificationPoint`: Exposes CRUD operations for the **ForecastVerificationPoint** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ForecastVerificationPoints
    * const forecastVerificationPoints = await prisma.forecastVerificationPoint.findMany()
    * ```
    */
  get forecastVerificationPoint(): Prisma.ForecastVerificationPointDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.rollingDailyVerificationRecord`: Exposes CRUD operations for the **RollingDailyVerificationRecord** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more RollingDailyVerificationRecords
    * const rollingDailyVerificationRecords = await prisma.rollingDailyVerificationRecord.findMany()
    * ```
    */
  get rollingDailyVerificationRecord(): Prisma.RollingDailyVerificationRecordDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.rollingDailyCurrentForecastSnapshot`: Exposes CRUD operations for the **RollingDailyCurrentForecastSnapshot** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more RollingDailyCurrentForecastSnapshots
    * const rollingDailyCurrentForecastSnapshots = await prisma.rollingDailyCurrentForecastSnapshot.findMany()
    * ```
    */
  get rollingDailyCurrentForecastSnapshot(): Prisma.RollingDailyCurrentForecastSnapshotDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.rollingDailyCalibrationGroup`: Exposes CRUD operations for the **RollingDailyCalibrationGroup** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more RollingDailyCalibrationGroups
    * const rollingDailyCalibrationGroups = await prisma.rollingDailyCalibrationGroup.findMany()
    * ```
    */
  get rollingDailyCalibrationGroup(): Prisma.RollingDailyCalibrationGroupDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.rollingDailyMaintenanceState`: Exposes CRUD operations for the **RollingDailyMaintenanceState** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more RollingDailyMaintenanceStates
    * const rollingDailyMaintenanceStates = await prisma.rollingDailyMaintenanceState.findMany()
    * ```
    */
  get rollingDailyMaintenanceState(): Prisma.RollingDailyMaintenanceStateDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 7.8.0
   * Query Engine version: 3c6e192761c0362d496ed980de936e2f3cebcd3a
   */
  export type PrismaVersion = {
    client: string
    engine: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import Bytes = runtime.Bytes
  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    ForecastCurrentRun: 'ForecastCurrentRun',
    ForecastCurrentPoint: 'ForecastCurrentPoint',
    ForecastVerificationRun: 'ForecastVerificationRun',
    ForecastVerificationMetric: 'ForecastVerificationMetric',
    ForecastVerificationPoint: 'ForecastVerificationPoint',
    RollingDailyVerificationRecord: 'RollingDailyVerificationRecord',
    RollingDailyCurrentForecastSnapshot: 'RollingDailyCurrentForecastSnapshot',
    RollingDailyCalibrationGroup: 'RollingDailyCalibrationGroup',
    RollingDailyMaintenanceState: 'RollingDailyMaintenanceState'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]



  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "forecastCurrentRun" | "forecastCurrentPoint" | "forecastVerificationRun" | "forecastVerificationMetric" | "forecastVerificationPoint" | "rollingDailyVerificationRecord" | "rollingDailyCurrentForecastSnapshot" | "rollingDailyCalibrationGroup" | "rollingDailyMaintenanceState"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      ForecastCurrentRun: {
        payload: Prisma.$ForecastCurrentRunPayload<ExtArgs>
        fields: Prisma.ForecastCurrentRunFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ForecastCurrentRunFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastCurrentRunPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ForecastCurrentRunFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastCurrentRunPayload>
          }
          findFirst: {
            args: Prisma.ForecastCurrentRunFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastCurrentRunPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ForecastCurrentRunFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastCurrentRunPayload>
          }
          findMany: {
            args: Prisma.ForecastCurrentRunFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastCurrentRunPayload>[]
          }
          create: {
            args: Prisma.ForecastCurrentRunCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastCurrentRunPayload>
          }
          createMany: {
            args: Prisma.ForecastCurrentRunCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ForecastCurrentRunCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastCurrentRunPayload>[]
          }
          delete: {
            args: Prisma.ForecastCurrentRunDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastCurrentRunPayload>
          }
          update: {
            args: Prisma.ForecastCurrentRunUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastCurrentRunPayload>
          }
          deleteMany: {
            args: Prisma.ForecastCurrentRunDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ForecastCurrentRunUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ForecastCurrentRunUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastCurrentRunPayload>[]
          }
          upsert: {
            args: Prisma.ForecastCurrentRunUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastCurrentRunPayload>
          }
          aggregate: {
            args: Prisma.ForecastCurrentRunAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateForecastCurrentRun>
          }
          groupBy: {
            args: Prisma.ForecastCurrentRunGroupByArgs<ExtArgs>
            result: $Utils.Optional<ForecastCurrentRunGroupByOutputType>[]
          }
          count: {
            args: Prisma.ForecastCurrentRunCountArgs<ExtArgs>
            result: $Utils.Optional<ForecastCurrentRunCountAggregateOutputType> | number
          }
        }
      }
      ForecastCurrentPoint: {
        payload: Prisma.$ForecastCurrentPointPayload<ExtArgs>
        fields: Prisma.ForecastCurrentPointFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ForecastCurrentPointFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastCurrentPointPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ForecastCurrentPointFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastCurrentPointPayload>
          }
          findFirst: {
            args: Prisma.ForecastCurrentPointFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastCurrentPointPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ForecastCurrentPointFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastCurrentPointPayload>
          }
          findMany: {
            args: Prisma.ForecastCurrentPointFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastCurrentPointPayload>[]
          }
          create: {
            args: Prisma.ForecastCurrentPointCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastCurrentPointPayload>
          }
          createMany: {
            args: Prisma.ForecastCurrentPointCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ForecastCurrentPointCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastCurrentPointPayload>[]
          }
          delete: {
            args: Prisma.ForecastCurrentPointDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastCurrentPointPayload>
          }
          update: {
            args: Prisma.ForecastCurrentPointUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastCurrentPointPayload>
          }
          deleteMany: {
            args: Prisma.ForecastCurrentPointDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ForecastCurrentPointUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ForecastCurrentPointUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastCurrentPointPayload>[]
          }
          upsert: {
            args: Prisma.ForecastCurrentPointUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastCurrentPointPayload>
          }
          aggregate: {
            args: Prisma.ForecastCurrentPointAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateForecastCurrentPoint>
          }
          groupBy: {
            args: Prisma.ForecastCurrentPointGroupByArgs<ExtArgs>
            result: $Utils.Optional<ForecastCurrentPointGroupByOutputType>[]
          }
          count: {
            args: Prisma.ForecastCurrentPointCountArgs<ExtArgs>
            result: $Utils.Optional<ForecastCurrentPointCountAggregateOutputType> | number
          }
        }
      }
      ForecastVerificationRun: {
        payload: Prisma.$ForecastVerificationRunPayload<ExtArgs>
        fields: Prisma.ForecastVerificationRunFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ForecastVerificationRunFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationRunPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ForecastVerificationRunFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationRunPayload>
          }
          findFirst: {
            args: Prisma.ForecastVerificationRunFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationRunPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ForecastVerificationRunFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationRunPayload>
          }
          findMany: {
            args: Prisma.ForecastVerificationRunFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationRunPayload>[]
          }
          create: {
            args: Prisma.ForecastVerificationRunCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationRunPayload>
          }
          createMany: {
            args: Prisma.ForecastVerificationRunCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ForecastVerificationRunCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationRunPayload>[]
          }
          delete: {
            args: Prisma.ForecastVerificationRunDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationRunPayload>
          }
          update: {
            args: Prisma.ForecastVerificationRunUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationRunPayload>
          }
          deleteMany: {
            args: Prisma.ForecastVerificationRunDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ForecastVerificationRunUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ForecastVerificationRunUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationRunPayload>[]
          }
          upsert: {
            args: Prisma.ForecastVerificationRunUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationRunPayload>
          }
          aggregate: {
            args: Prisma.ForecastVerificationRunAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateForecastVerificationRun>
          }
          groupBy: {
            args: Prisma.ForecastVerificationRunGroupByArgs<ExtArgs>
            result: $Utils.Optional<ForecastVerificationRunGroupByOutputType>[]
          }
          count: {
            args: Prisma.ForecastVerificationRunCountArgs<ExtArgs>
            result: $Utils.Optional<ForecastVerificationRunCountAggregateOutputType> | number
          }
        }
      }
      ForecastVerificationMetric: {
        payload: Prisma.$ForecastVerificationMetricPayload<ExtArgs>
        fields: Prisma.ForecastVerificationMetricFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ForecastVerificationMetricFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationMetricPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ForecastVerificationMetricFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationMetricPayload>
          }
          findFirst: {
            args: Prisma.ForecastVerificationMetricFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationMetricPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ForecastVerificationMetricFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationMetricPayload>
          }
          findMany: {
            args: Prisma.ForecastVerificationMetricFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationMetricPayload>[]
          }
          create: {
            args: Prisma.ForecastVerificationMetricCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationMetricPayload>
          }
          createMany: {
            args: Prisma.ForecastVerificationMetricCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ForecastVerificationMetricCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationMetricPayload>[]
          }
          delete: {
            args: Prisma.ForecastVerificationMetricDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationMetricPayload>
          }
          update: {
            args: Prisma.ForecastVerificationMetricUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationMetricPayload>
          }
          deleteMany: {
            args: Prisma.ForecastVerificationMetricDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ForecastVerificationMetricUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ForecastVerificationMetricUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationMetricPayload>[]
          }
          upsert: {
            args: Prisma.ForecastVerificationMetricUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationMetricPayload>
          }
          aggregate: {
            args: Prisma.ForecastVerificationMetricAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateForecastVerificationMetric>
          }
          groupBy: {
            args: Prisma.ForecastVerificationMetricGroupByArgs<ExtArgs>
            result: $Utils.Optional<ForecastVerificationMetricGroupByOutputType>[]
          }
          count: {
            args: Prisma.ForecastVerificationMetricCountArgs<ExtArgs>
            result: $Utils.Optional<ForecastVerificationMetricCountAggregateOutputType> | number
          }
        }
      }
      ForecastVerificationPoint: {
        payload: Prisma.$ForecastVerificationPointPayload<ExtArgs>
        fields: Prisma.ForecastVerificationPointFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ForecastVerificationPointFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationPointPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ForecastVerificationPointFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationPointPayload>
          }
          findFirst: {
            args: Prisma.ForecastVerificationPointFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationPointPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ForecastVerificationPointFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationPointPayload>
          }
          findMany: {
            args: Prisma.ForecastVerificationPointFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationPointPayload>[]
          }
          create: {
            args: Prisma.ForecastVerificationPointCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationPointPayload>
          }
          createMany: {
            args: Prisma.ForecastVerificationPointCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ForecastVerificationPointCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationPointPayload>[]
          }
          delete: {
            args: Prisma.ForecastVerificationPointDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationPointPayload>
          }
          update: {
            args: Prisma.ForecastVerificationPointUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationPointPayload>
          }
          deleteMany: {
            args: Prisma.ForecastVerificationPointDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ForecastVerificationPointUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ForecastVerificationPointUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationPointPayload>[]
          }
          upsert: {
            args: Prisma.ForecastVerificationPointUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ForecastVerificationPointPayload>
          }
          aggregate: {
            args: Prisma.ForecastVerificationPointAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateForecastVerificationPoint>
          }
          groupBy: {
            args: Prisma.ForecastVerificationPointGroupByArgs<ExtArgs>
            result: $Utils.Optional<ForecastVerificationPointGroupByOutputType>[]
          }
          count: {
            args: Prisma.ForecastVerificationPointCountArgs<ExtArgs>
            result: $Utils.Optional<ForecastVerificationPointCountAggregateOutputType> | number
          }
        }
      }
      RollingDailyVerificationRecord: {
        payload: Prisma.$RollingDailyVerificationRecordPayload<ExtArgs>
        fields: Prisma.RollingDailyVerificationRecordFieldRefs
        operations: {
          findUnique: {
            args: Prisma.RollingDailyVerificationRecordFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyVerificationRecordPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.RollingDailyVerificationRecordFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyVerificationRecordPayload>
          }
          findFirst: {
            args: Prisma.RollingDailyVerificationRecordFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyVerificationRecordPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.RollingDailyVerificationRecordFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyVerificationRecordPayload>
          }
          findMany: {
            args: Prisma.RollingDailyVerificationRecordFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyVerificationRecordPayload>[]
          }
          create: {
            args: Prisma.RollingDailyVerificationRecordCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyVerificationRecordPayload>
          }
          createMany: {
            args: Prisma.RollingDailyVerificationRecordCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.RollingDailyVerificationRecordCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyVerificationRecordPayload>[]
          }
          delete: {
            args: Prisma.RollingDailyVerificationRecordDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyVerificationRecordPayload>
          }
          update: {
            args: Prisma.RollingDailyVerificationRecordUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyVerificationRecordPayload>
          }
          deleteMany: {
            args: Prisma.RollingDailyVerificationRecordDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.RollingDailyVerificationRecordUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.RollingDailyVerificationRecordUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyVerificationRecordPayload>[]
          }
          upsert: {
            args: Prisma.RollingDailyVerificationRecordUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyVerificationRecordPayload>
          }
          aggregate: {
            args: Prisma.RollingDailyVerificationRecordAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateRollingDailyVerificationRecord>
          }
          groupBy: {
            args: Prisma.RollingDailyVerificationRecordGroupByArgs<ExtArgs>
            result: $Utils.Optional<RollingDailyVerificationRecordGroupByOutputType>[]
          }
          count: {
            args: Prisma.RollingDailyVerificationRecordCountArgs<ExtArgs>
            result: $Utils.Optional<RollingDailyVerificationRecordCountAggregateOutputType> | number
          }
        }
      }
      RollingDailyCurrentForecastSnapshot: {
        payload: Prisma.$RollingDailyCurrentForecastSnapshotPayload<ExtArgs>
        fields: Prisma.RollingDailyCurrentForecastSnapshotFieldRefs
        operations: {
          findUnique: {
            args: Prisma.RollingDailyCurrentForecastSnapshotFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyCurrentForecastSnapshotPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.RollingDailyCurrentForecastSnapshotFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyCurrentForecastSnapshotPayload>
          }
          findFirst: {
            args: Prisma.RollingDailyCurrentForecastSnapshotFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyCurrentForecastSnapshotPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.RollingDailyCurrentForecastSnapshotFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyCurrentForecastSnapshotPayload>
          }
          findMany: {
            args: Prisma.RollingDailyCurrentForecastSnapshotFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyCurrentForecastSnapshotPayload>[]
          }
          create: {
            args: Prisma.RollingDailyCurrentForecastSnapshotCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyCurrentForecastSnapshotPayload>
          }
          createMany: {
            args: Prisma.RollingDailyCurrentForecastSnapshotCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.RollingDailyCurrentForecastSnapshotCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyCurrentForecastSnapshotPayload>[]
          }
          delete: {
            args: Prisma.RollingDailyCurrentForecastSnapshotDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyCurrentForecastSnapshotPayload>
          }
          update: {
            args: Prisma.RollingDailyCurrentForecastSnapshotUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyCurrentForecastSnapshotPayload>
          }
          deleteMany: {
            args: Prisma.RollingDailyCurrentForecastSnapshotDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.RollingDailyCurrentForecastSnapshotUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.RollingDailyCurrentForecastSnapshotUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyCurrentForecastSnapshotPayload>[]
          }
          upsert: {
            args: Prisma.RollingDailyCurrentForecastSnapshotUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyCurrentForecastSnapshotPayload>
          }
          aggregate: {
            args: Prisma.RollingDailyCurrentForecastSnapshotAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateRollingDailyCurrentForecastSnapshot>
          }
          groupBy: {
            args: Prisma.RollingDailyCurrentForecastSnapshotGroupByArgs<ExtArgs>
            result: $Utils.Optional<RollingDailyCurrentForecastSnapshotGroupByOutputType>[]
          }
          count: {
            args: Prisma.RollingDailyCurrentForecastSnapshotCountArgs<ExtArgs>
            result: $Utils.Optional<RollingDailyCurrentForecastSnapshotCountAggregateOutputType> | number
          }
        }
      }
      RollingDailyCalibrationGroup: {
        payload: Prisma.$RollingDailyCalibrationGroupPayload<ExtArgs>
        fields: Prisma.RollingDailyCalibrationGroupFieldRefs
        operations: {
          findUnique: {
            args: Prisma.RollingDailyCalibrationGroupFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyCalibrationGroupPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.RollingDailyCalibrationGroupFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyCalibrationGroupPayload>
          }
          findFirst: {
            args: Prisma.RollingDailyCalibrationGroupFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyCalibrationGroupPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.RollingDailyCalibrationGroupFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyCalibrationGroupPayload>
          }
          findMany: {
            args: Prisma.RollingDailyCalibrationGroupFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyCalibrationGroupPayload>[]
          }
          create: {
            args: Prisma.RollingDailyCalibrationGroupCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyCalibrationGroupPayload>
          }
          createMany: {
            args: Prisma.RollingDailyCalibrationGroupCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.RollingDailyCalibrationGroupCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyCalibrationGroupPayload>[]
          }
          delete: {
            args: Prisma.RollingDailyCalibrationGroupDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyCalibrationGroupPayload>
          }
          update: {
            args: Prisma.RollingDailyCalibrationGroupUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyCalibrationGroupPayload>
          }
          deleteMany: {
            args: Prisma.RollingDailyCalibrationGroupDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.RollingDailyCalibrationGroupUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.RollingDailyCalibrationGroupUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyCalibrationGroupPayload>[]
          }
          upsert: {
            args: Prisma.RollingDailyCalibrationGroupUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyCalibrationGroupPayload>
          }
          aggregate: {
            args: Prisma.RollingDailyCalibrationGroupAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateRollingDailyCalibrationGroup>
          }
          groupBy: {
            args: Prisma.RollingDailyCalibrationGroupGroupByArgs<ExtArgs>
            result: $Utils.Optional<RollingDailyCalibrationGroupGroupByOutputType>[]
          }
          count: {
            args: Prisma.RollingDailyCalibrationGroupCountArgs<ExtArgs>
            result: $Utils.Optional<RollingDailyCalibrationGroupCountAggregateOutputType> | number
          }
        }
      }
      RollingDailyMaintenanceState: {
        payload: Prisma.$RollingDailyMaintenanceStatePayload<ExtArgs>
        fields: Prisma.RollingDailyMaintenanceStateFieldRefs
        operations: {
          findUnique: {
            args: Prisma.RollingDailyMaintenanceStateFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyMaintenanceStatePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.RollingDailyMaintenanceStateFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyMaintenanceStatePayload>
          }
          findFirst: {
            args: Prisma.RollingDailyMaintenanceStateFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyMaintenanceStatePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.RollingDailyMaintenanceStateFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyMaintenanceStatePayload>
          }
          findMany: {
            args: Prisma.RollingDailyMaintenanceStateFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyMaintenanceStatePayload>[]
          }
          create: {
            args: Prisma.RollingDailyMaintenanceStateCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyMaintenanceStatePayload>
          }
          createMany: {
            args: Prisma.RollingDailyMaintenanceStateCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.RollingDailyMaintenanceStateCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyMaintenanceStatePayload>[]
          }
          delete: {
            args: Prisma.RollingDailyMaintenanceStateDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyMaintenanceStatePayload>
          }
          update: {
            args: Prisma.RollingDailyMaintenanceStateUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyMaintenanceStatePayload>
          }
          deleteMany: {
            args: Prisma.RollingDailyMaintenanceStateDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.RollingDailyMaintenanceStateUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.RollingDailyMaintenanceStateUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyMaintenanceStatePayload>[]
          }
          upsert: {
            args: Prisma.RollingDailyMaintenanceStateUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RollingDailyMaintenanceStatePayload>
          }
          aggregate: {
            args: Prisma.RollingDailyMaintenanceStateAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateRollingDailyMaintenanceState>
          }
          groupBy: {
            args: Prisma.RollingDailyMaintenanceStateGroupByArgs<ExtArgs>
            result: $Utils.Optional<RollingDailyMaintenanceStateGroupByOutputType>[]
          }
          count: {
            args: Prisma.RollingDailyMaintenanceStateCountArgs<ExtArgs>
            result: $Utils.Optional<RollingDailyMaintenanceStateCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://pris.ly/d/logging).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory
    /**
     * Prisma Accelerate URL allowing the client to connect through Accelerate instead of a direct database.
     */
    accelerateUrl?: string
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
    /**
     * SQL commenter plugins that add metadata to SQL queries as comments.
     * Comments follow the sqlcommenter format: https://google.github.io/sqlcommenter/
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   adapter,
     *   comments: [
     *     traceContext(),
     *     queryInsights(),
     *   ],
     * })
     * ```
     */
    comments?: runtime.SqlCommenterPlugin[]
  }
  export type GlobalOmitConfig = {
    forecastCurrentRun?: ForecastCurrentRunOmit
    forecastCurrentPoint?: ForecastCurrentPointOmit
    forecastVerificationRun?: ForecastVerificationRunOmit
    forecastVerificationMetric?: ForecastVerificationMetricOmit
    forecastVerificationPoint?: ForecastVerificationPointOmit
    rollingDailyVerificationRecord?: RollingDailyVerificationRecordOmit
    rollingDailyCurrentForecastSnapshot?: RollingDailyCurrentForecastSnapshotOmit
    rollingDailyCalibrationGroup?: RollingDailyCalibrationGroupOmit
    rollingDailyMaintenanceState?: RollingDailyMaintenanceStateOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type ForecastCurrentRunCountOutputType
   */

  export type ForecastCurrentRunCountOutputType = {
    points: number
  }

  export type ForecastCurrentRunCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    points?: boolean | ForecastCurrentRunCountOutputTypeCountPointsArgs
  }

  // Custom InputTypes
  /**
   * ForecastCurrentRunCountOutputType without action
   */
  export type ForecastCurrentRunCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentRunCountOutputType
     */
    select?: ForecastCurrentRunCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * ForecastCurrentRunCountOutputType without action
   */
  export type ForecastCurrentRunCountOutputTypeCountPointsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ForecastCurrentPointWhereInput
  }


  /**
   * Count Type ForecastVerificationRunCountOutputType
   */

  export type ForecastVerificationRunCountOutputType = {
    metrics: number
    points: number
  }

  export type ForecastVerificationRunCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    metrics?: boolean | ForecastVerificationRunCountOutputTypeCountMetricsArgs
    points?: boolean | ForecastVerificationRunCountOutputTypeCountPointsArgs
  }

  // Custom InputTypes
  /**
   * ForecastVerificationRunCountOutputType without action
   */
  export type ForecastVerificationRunCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationRunCountOutputType
     */
    select?: ForecastVerificationRunCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * ForecastVerificationRunCountOutputType without action
   */
  export type ForecastVerificationRunCountOutputTypeCountMetricsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ForecastVerificationMetricWhereInput
  }

  /**
   * ForecastVerificationRunCountOutputType without action
   */
  export type ForecastVerificationRunCountOutputTypeCountPointsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ForecastVerificationPointWhereInput
  }


  /**
   * Models
   */

  /**
   * Model ForecastCurrentRun
   */

  export type AggregateForecastCurrentRun = {
    _count: ForecastCurrentRunCountAggregateOutputType | null
    _avg: ForecastCurrentRunAvgAggregateOutputType | null
    _sum: ForecastCurrentRunSumAggregateOutputType | null
    _min: ForecastCurrentRunMinAggregateOutputType | null
    _max: ForecastCurrentRunMaxAggregateOutputType | null
  }

  export type ForecastCurrentRunAvgAggregateOutputType = {
    observationCount: number | null
    runtimeSeconds: number | null
  }

  export type ForecastCurrentRunSumAggregateOutputType = {
    observationCount: number | null
    runtimeSeconds: number | null
  }

  export type ForecastCurrentRunMinAggregateOutputType = {
    id: string | null
    seriesId: string | null
    displayName: string | null
    description: string | null
    frequency: string | null
    currency: string | null
    unit: string | null
    sourceLabel: string | null
    inputSource: string | null
    inputRunId: string | null
    historyFingerprint: string | null
    targetBasis: $Enums.ForecastTargetBasis | null
    methodId: string | null
    historyStartAt: Date | null
    historyEndAt: Date | null
    observationCount: number | null
    forecastOriginAt: Date | null
    modelId: string | null
    methodVersion: string | null
    status: string | null
    failureReason: string | null
    runtimeSeconds: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ForecastCurrentRunMaxAggregateOutputType = {
    id: string | null
    seriesId: string | null
    displayName: string | null
    description: string | null
    frequency: string | null
    currency: string | null
    unit: string | null
    sourceLabel: string | null
    inputSource: string | null
    inputRunId: string | null
    historyFingerprint: string | null
    targetBasis: $Enums.ForecastTargetBasis | null
    methodId: string | null
    historyStartAt: Date | null
    historyEndAt: Date | null
    observationCount: number | null
    forecastOriginAt: Date | null
    modelId: string | null
    methodVersion: string | null
    status: string | null
    failureReason: string | null
    runtimeSeconds: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ForecastCurrentRunCountAggregateOutputType = {
    id: number
    seriesId: number
    displayName: number
    description: number
    frequency: number
    currency: number
    unit: number
    sourceLabel: number
    inputSource: number
    inputRunId: number
    historyFingerprint: number
    targetBasis: number
    methodId: number
    historyStartAt: number
    historyEndAt: number
    observationCount: number
    forecastOriginAt: number
    modelId: number
    methodVersion: number
    status: number
    failureReason: number
    runtimeSeconds: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type ForecastCurrentRunAvgAggregateInputType = {
    observationCount?: true
    runtimeSeconds?: true
  }

  export type ForecastCurrentRunSumAggregateInputType = {
    observationCount?: true
    runtimeSeconds?: true
  }

  export type ForecastCurrentRunMinAggregateInputType = {
    id?: true
    seriesId?: true
    displayName?: true
    description?: true
    frequency?: true
    currency?: true
    unit?: true
    sourceLabel?: true
    inputSource?: true
    inputRunId?: true
    historyFingerprint?: true
    targetBasis?: true
    methodId?: true
    historyStartAt?: true
    historyEndAt?: true
    observationCount?: true
    forecastOriginAt?: true
    modelId?: true
    methodVersion?: true
    status?: true
    failureReason?: true
    runtimeSeconds?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ForecastCurrentRunMaxAggregateInputType = {
    id?: true
    seriesId?: true
    displayName?: true
    description?: true
    frequency?: true
    currency?: true
    unit?: true
    sourceLabel?: true
    inputSource?: true
    inputRunId?: true
    historyFingerprint?: true
    targetBasis?: true
    methodId?: true
    historyStartAt?: true
    historyEndAt?: true
    observationCount?: true
    forecastOriginAt?: true
    modelId?: true
    methodVersion?: true
    status?: true
    failureReason?: true
    runtimeSeconds?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ForecastCurrentRunCountAggregateInputType = {
    id?: true
    seriesId?: true
    displayName?: true
    description?: true
    frequency?: true
    currency?: true
    unit?: true
    sourceLabel?: true
    inputSource?: true
    inputRunId?: true
    historyFingerprint?: true
    targetBasis?: true
    methodId?: true
    historyStartAt?: true
    historyEndAt?: true
    observationCount?: true
    forecastOriginAt?: true
    modelId?: true
    methodVersion?: true
    status?: true
    failureReason?: true
    runtimeSeconds?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type ForecastCurrentRunAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ForecastCurrentRun to aggregate.
     */
    where?: ForecastCurrentRunWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ForecastCurrentRuns to fetch.
     */
    orderBy?: ForecastCurrentRunOrderByWithRelationInput | ForecastCurrentRunOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ForecastCurrentRunWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ForecastCurrentRuns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ForecastCurrentRuns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ForecastCurrentRuns
    **/
    _count?: true | ForecastCurrentRunCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ForecastCurrentRunAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ForecastCurrentRunSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ForecastCurrentRunMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ForecastCurrentRunMaxAggregateInputType
  }

  export type GetForecastCurrentRunAggregateType<T extends ForecastCurrentRunAggregateArgs> = {
        [P in keyof T & keyof AggregateForecastCurrentRun]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateForecastCurrentRun[P]>
      : GetScalarType<T[P], AggregateForecastCurrentRun[P]>
  }




  export type ForecastCurrentRunGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ForecastCurrentRunWhereInput
    orderBy?: ForecastCurrentRunOrderByWithAggregationInput | ForecastCurrentRunOrderByWithAggregationInput[]
    by: ForecastCurrentRunScalarFieldEnum[] | ForecastCurrentRunScalarFieldEnum
    having?: ForecastCurrentRunScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ForecastCurrentRunCountAggregateInputType | true
    _avg?: ForecastCurrentRunAvgAggregateInputType
    _sum?: ForecastCurrentRunSumAggregateInputType
    _min?: ForecastCurrentRunMinAggregateInputType
    _max?: ForecastCurrentRunMaxAggregateInputType
  }

  export type ForecastCurrentRunGroupByOutputType = {
    id: string
    seriesId: string
    displayName: string
    description: string | null
    frequency: string | null
    currency: string | null
    unit: string | null
    sourceLabel: string | null
    inputSource: string
    inputRunId: string | null
    historyFingerprint: string
    targetBasis: $Enums.ForecastTargetBasis
    methodId: string
    historyStartAt: Date | null
    historyEndAt: Date | null
    observationCount: number
    forecastOriginAt: Date | null
    modelId: string
    methodVersion: string
    status: string
    failureReason: string | null
    runtimeSeconds: number | null
    createdAt: Date
    updatedAt: Date
    _count: ForecastCurrentRunCountAggregateOutputType | null
    _avg: ForecastCurrentRunAvgAggregateOutputType | null
    _sum: ForecastCurrentRunSumAggregateOutputType | null
    _min: ForecastCurrentRunMinAggregateOutputType | null
    _max: ForecastCurrentRunMaxAggregateOutputType | null
  }

  type GetForecastCurrentRunGroupByPayload<T extends ForecastCurrentRunGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ForecastCurrentRunGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ForecastCurrentRunGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ForecastCurrentRunGroupByOutputType[P]>
            : GetScalarType<T[P], ForecastCurrentRunGroupByOutputType[P]>
        }
      >
    >


  export type ForecastCurrentRunSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    seriesId?: boolean
    displayName?: boolean
    description?: boolean
    frequency?: boolean
    currency?: boolean
    unit?: boolean
    sourceLabel?: boolean
    inputSource?: boolean
    inputRunId?: boolean
    historyFingerprint?: boolean
    targetBasis?: boolean
    methodId?: boolean
    historyStartAt?: boolean
    historyEndAt?: boolean
    observationCount?: boolean
    forecastOriginAt?: boolean
    modelId?: boolean
    methodVersion?: boolean
    status?: boolean
    failureReason?: boolean
    runtimeSeconds?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    points?: boolean | ForecastCurrentRun$pointsArgs<ExtArgs>
    _count?: boolean | ForecastCurrentRunCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["forecastCurrentRun"]>

  export type ForecastCurrentRunSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    seriesId?: boolean
    displayName?: boolean
    description?: boolean
    frequency?: boolean
    currency?: boolean
    unit?: boolean
    sourceLabel?: boolean
    inputSource?: boolean
    inputRunId?: boolean
    historyFingerprint?: boolean
    targetBasis?: boolean
    methodId?: boolean
    historyStartAt?: boolean
    historyEndAt?: boolean
    observationCount?: boolean
    forecastOriginAt?: boolean
    modelId?: boolean
    methodVersion?: boolean
    status?: boolean
    failureReason?: boolean
    runtimeSeconds?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["forecastCurrentRun"]>

  export type ForecastCurrentRunSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    seriesId?: boolean
    displayName?: boolean
    description?: boolean
    frequency?: boolean
    currency?: boolean
    unit?: boolean
    sourceLabel?: boolean
    inputSource?: boolean
    inputRunId?: boolean
    historyFingerprint?: boolean
    targetBasis?: boolean
    methodId?: boolean
    historyStartAt?: boolean
    historyEndAt?: boolean
    observationCount?: boolean
    forecastOriginAt?: boolean
    modelId?: boolean
    methodVersion?: boolean
    status?: boolean
    failureReason?: boolean
    runtimeSeconds?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["forecastCurrentRun"]>

  export type ForecastCurrentRunSelectScalar = {
    id?: boolean
    seriesId?: boolean
    displayName?: boolean
    description?: boolean
    frequency?: boolean
    currency?: boolean
    unit?: boolean
    sourceLabel?: boolean
    inputSource?: boolean
    inputRunId?: boolean
    historyFingerprint?: boolean
    targetBasis?: boolean
    methodId?: boolean
    historyStartAt?: boolean
    historyEndAt?: boolean
    observationCount?: boolean
    forecastOriginAt?: boolean
    modelId?: boolean
    methodVersion?: boolean
    status?: boolean
    failureReason?: boolean
    runtimeSeconds?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type ForecastCurrentRunOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "seriesId" | "displayName" | "description" | "frequency" | "currency" | "unit" | "sourceLabel" | "inputSource" | "inputRunId" | "historyFingerprint" | "targetBasis" | "methodId" | "historyStartAt" | "historyEndAt" | "observationCount" | "forecastOriginAt" | "modelId" | "methodVersion" | "status" | "failureReason" | "runtimeSeconds" | "createdAt" | "updatedAt", ExtArgs["result"]["forecastCurrentRun"]>
  export type ForecastCurrentRunInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    points?: boolean | ForecastCurrentRun$pointsArgs<ExtArgs>
    _count?: boolean | ForecastCurrentRunCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type ForecastCurrentRunIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type ForecastCurrentRunIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $ForecastCurrentRunPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ForecastCurrentRun"
    objects: {
      points: Prisma.$ForecastCurrentPointPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      seriesId: string
      displayName: string
      description: string | null
      frequency: string | null
      currency: string | null
      unit: string | null
      sourceLabel: string | null
      inputSource: string
      inputRunId: string | null
      historyFingerprint: string
      targetBasis: $Enums.ForecastTargetBasis
      methodId: string
      historyStartAt: Date | null
      historyEndAt: Date | null
      observationCount: number
      forecastOriginAt: Date | null
      modelId: string
      methodVersion: string
      status: string
      failureReason: string | null
      runtimeSeconds: number | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["forecastCurrentRun"]>
    composites: {}
  }

  type ForecastCurrentRunGetPayload<S extends boolean | null | undefined | ForecastCurrentRunDefaultArgs> = $Result.GetResult<Prisma.$ForecastCurrentRunPayload, S>

  type ForecastCurrentRunCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ForecastCurrentRunFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ForecastCurrentRunCountAggregateInputType | true
    }

  export interface ForecastCurrentRunDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ForecastCurrentRun'], meta: { name: 'ForecastCurrentRun' } }
    /**
     * Find zero or one ForecastCurrentRun that matches the filter.
     * @param {ForecastCurrentRunFindUniqueArgs} args - Arguments to find a ForecastCurrentRun
     * @example
     * // Get one ForecastCurrentRun
     * const forecastCurrentRun = await prisma.forecastCurrentRun.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ForecastCurrentRunFindUniqueArgs>(args: SelectSubset<T, ForecastCurrentRunFindUniqueArgs<ExtArgs>>): Prisma__ForecastCurrentRunClient<$Result.GetResult<Prisma.$ForecastCurrentRunPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one ForecastCurrentRun that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ForecastCurrentRunFindUniqueOrThrowArgs} args - Arguments to find a ForecastCurrentRun
     * @example
     * // Get one ForecastCurrentRun
     * const forecastCurrentRun = await prisma.forecastCurrentRun.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ForecastCurrentRunFindUniqueOrThrowArgs>(args: SelectSubset<T, ForecastCurrentRunFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ForecastCurrentRunClient<$Result.GetResult<Prisma.$ForecastCurrentRunPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ForecastCurrentRun that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastCurrentRunFindFirstArgs} args - Arguments to find a ForecastCurrentRun
     * @example
     * // Get one ForecastCurrentRun
     * const forecastCurrentRun = await prisma.forecastCurrentRun.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ForecastCurrentRunFindFirstArgs>(args?: SelectSubset<T, ForecastCurrentRunFindFirstArgs<ExtArgs>>): Prisma__ForecastCurrentRunClient<$Result.GetResult<Prisma.$ForecastCurrentRunPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ForecastCurrentRun that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastCurrentRunFindFirstOrThrowArgs} args - Arguments to find a ForecastCurrentRun
     * @example
     * // Get one ForecastCurrentRun
     * const forecastCurrentRun = await prisma.forecastCurrentRun.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ForecastCurrentRunFindFirstOrThrowArgs>(args?: SelectSubset<T, ForecastCurrentRunFindFirstOrThrowArgs<ExtArgs>>): Prisma__ForecastCurrentRunClient<$Result.GetResult<Prisma.$ForecastCurrentRunPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more ForecastCurrentRuns that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastCurrentRunFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ForecastCurrentRuns
     * const forecastCurrentRuns = await prisma.forecastCurrentRun.findMany()
     * 
     * // Get first 10 ForecastCurrentRuns
     * const forecastCurrentRuns = await prisma.forecastCurrentRun.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const forecastCurrentRunWithIdOnly = await prisma.forecastCurrentRun.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ForecastCurrentRunFindManyArgs>(args?: SelectSubset<T, ForecastCurrentRunFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ForecastCurrentRunPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a ForecastCurrentRun.
     * @param {ForecastCurrentRunCreateArgs} args - Arguments to create a ForecastCurrentRun.
     * @example
     * // Create one ForecastCurrentRun
     * const ForecastCurrentRun = await prisma.forecastCurrentRun.create({
     *   data: {
     *     // ... data to create a ForecastCurrentRun
     *   }
     * })
     * 
     */
    create<T extends ForecastCurrentRunCreateArgs>(args: SelectSubset<T, ForecastCurrentRunCreateArgs<ExtArgs>>): Prisma__ForecastCurrentRunClient<$Result.GetResult<Prisma.$ForecastCurrentRunPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many ForecastCurrentRuns.
     * @param {ForecastCurrentRunCreateManyArgs} args - Arguments to create many ForecastCurrentRuns.
     * @example
     * // Create many ForecastCurrentRuns
     * const forecastCurrentRun = await prisma.forecastCurrentRun.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ForecastCurrentRunCreateManyArgs>(args?: SelectSubset<T, ForecastCurrentRunCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ForecastCurrentRuns and returns the data saved in the database.
     * @param {ForecastCurrentRunCreateManyAndReturnArgs} args - Arguments to create many ForecastCurrentRuns.
     * @example
     * // Create many ForecastCurrentRuns
     * const forecastCurrentRun = await prisma.forecastCurrentRun.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ForecastCurrentRuns and only return the `id`
     * const forecastCurrentRunWithIdOnly = await prisma.forecastCurrentRun.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ForecastCurrentRunCreateManyAndReturnArgs>(args?: SelectSubset<T, ForecastCurrentRunCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ForecastCurrentRunPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a ForecastCurrentRun.
     * @param {ForecastCurrentRunDeleteArgs} args - Arguments to delete one ForecastCurrentRun.
     * @example
     * // Delete one ForecastCurrentRun
     * const ForecastCurrentRun = await prisma.forecastCurrentRun.delete({
     *   where: {
     *     // ... filter to delete one ForecastCurrentRun
     *   }
     * })
     * 
     */
    delete<T extends ForecastCurrentRunDeleteArgs>(args: SelectSubset<T, ForecastCurrentRunDeleteArgs<ExtArgs>>): Prisma__ForecastCurrentRunClient<$Result.GetResult<Prisma.$ForecastCurrentRunPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one ForecastCurrentRun.
     * @param {ForecastCurrentRunUpdateArgs} args - Arguments to update one ForecastCurrentRun.
     * @example
     * // Update one ForecastCurrentRun
     * const forecastCurrentRun = await prisma.forecastCurrentRun.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ForecastCurrentRunUpdateArgs>(args: SelectSubset<T, ForecastCurrentRunUpdateArgs<ExtArgs>>): Prisma__ForecastCurrentRunClient<$Result.GetResult<Prisma.$ForecastCurrentRunPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more ForecastCurrentRuns.
     * @param {ForecastCurrentRunDeleteManyArgs} args - Arguments to filter ForecastCurrentRuns to delete.
     * @example
     * // Delete a few ForecastCurrentRuns
     * const { count } = await prisma.forecastCurrentRun.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ForecastCurrentRunDeleteManyArgs>(args?: SelectSubset<T, ForecastCurrentRunDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ForecastCurrentRuns.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastCurrentRunUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ForecastCurrentRuns
     * const forecastCurrentRun = await prisma.forecastCurrentRun.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ForecastCurrentRunUpdateManyArgs>(args: SelectSubset<T, ForecastCurrentRunUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ForecastCurrentRuns and returns the data updated in the database.
     * @param {ForecastCurrentRunUpdateManyAndReturnArgs} args - Arguments to update many ForecastCurrentRuns.
     * @example
     * // Update many ForecastCurrentRuns
     * const forecastCurrentRun = await prisma.forecastCurrentRun.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more ForecastCurrentRuns and only return the `id`
     * const forecastCurrentRunWithIdOnly = await prisma.forecastCurrentRun.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ForecastCurrentRunUpdateManyAndReturnArgs>(args: SelectSubset<T, ForecastCurrentRunUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ForecastCurrentRunPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one ForecastCurrentRun.
     * @param {ForecastCurrentRunUpsertArgs} args - Arguments to update or create a ForecastCurrentRun.
     * @example
     * // Update or create a ForecastCurrentRun
     * const forecastCurrentRun = await prisma.forecastCurrentRun.upsert({
     *   create: {
     *     // ... data to create a ForecastCurrentRun
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ForecastCurrentRun we want to update
     *   }
     * })
     */
    upsert<T extends ForecastCurrentRunUpsertArgs>(args: SelectSubset<T, ForecastCurrentRunUpsertArgs<ExtArgs>>): Prisma__ForecastCurrentRunClient<$Result.GetResult<Prisma.$ForecastCurrentRunPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of ForecastCurrentRuns.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastCurrentRunCountArgs} args - Arguments to filter ForecastCurrentRuns to count.
     * @example
     * // Count the number of ForecastCurrentRuns
     * const count = await prisma.forecastCurrentRun.count({
     *   where: {
     *     // ... the filter for the ForecastCurrentRuns we want to count
     *   }
     * })
    **/
    count<T extends ForecastCurrentRunCountArgs>(
      args?: Subset<T, ForecastCurrentRunCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ForecastCurrentRunCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ForecastCurrentRun.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastCurrentRunAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ForecastCurrentRunAggregateArgs>(args: Subset<T, ForecastCurrentRunAggregateArgs>): Prisma.PrismaPromise<GetForecastCurrentRunAggregateType<T>>

    /**
     * Group by ForecastCurrentRun.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastCurrentRunGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ForecastCurrentRunGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ForecastCurrentRunGroupByArgs['orderBy'] }
        : { orderBy?: ForecastCurrentRunGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ForecastCurrentRunGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetForecastCurrentRunGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ForecastCurrentRun model
   */
  readonly fields: ForecastCurrentRunFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ForecastCurrentRun.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ForecastCurrentRunClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    points<T extends ForecastCurrentRun$pointsArgs<ExtArgs> = {}>(args?: Subset<T, ForecastCurrentRun$pointsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ForecastCurrentPointPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ForecastCurrentRun model
   */
  interface ForecastCurrentRunFieldRefs {
    readonly id: FieldRef<"ForecastCurrentRun", 'String'>
    readonly seriesId: FieldRef<"ForecastCurrentRun", 'String'>
    readonly displayName: FieldRef<"ForecastCurrentRun", 'String'>
    readonly description: FieldRef<"ForecastCurrentRun", 'String'>
    readonly frequency: FieldRef<"ForecastCurrentRun", 'String'>
    readonly currency: FieldRef<"ForecastCurrentRun", 'String'>
    readonly unit: FieldRef<"ForecastCurrentRun", 'String'>
    readonly sourceLabel: FieldRef<"ForecastCurrentRun", 'String'>
    readonly inputSource: FieldRef<"ForecastCurrentRun", 'String'>
    readonly inputRunId: FieldRef<"ForecastCurrentRun", 'String'>
    readonly historyFingerprint: FieldRef<"ForecastCurrentRun", 'String'>
    readonly targetBasis: FieldRef<"ForecastCurrentRun", 'ForecastTargetBasis'>
    readonly methodId: FieldRef<"ForecastCurrentRun", 'String'>
    readonly historyStartAt: FieldRef<"ForecastCurrentRun", 'DateTime'>
    readonly historyEndAt: FieldRef<"ForecastCurrentRun", 'DateTime'>
    readonly observationCount: FieldRef<"ForecastCurrentRun", 'Int'>
    readonly forecastOriginAt: FieldRef<"ForecastCurrentRun", 'DateTime'>
    readonly modelId: FieldRef<"ForecastCurrentRun", 'String'>
    readonly methodVersion: FieldRef<"ForecastCurrentRun", 'String'>
    readonly status: FieldRef<"ForecastCurrentRun", 'String'>
    readonly failureReason: FieldRef<"ForecastCurrentRun", 'String'>
    readonly runtimeSeconds: FieldRef<"ForecastCurrentRun", 'Float'>
    readonly createdAt: FieldRef<"ForecastCurrentRun", 'DateTime'>
    readonly updatedAt: FieldRef<"ForecastCurrentRun", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ForecastCurrentRun findUnique
   */
  export type ForecastCurrentRunFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentRun
     */
    select?: ForecastCurrentRunSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastCurrentRun
     */
    omit?: ForecastCurrentRunOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastCurrentRunInclude<ExtArgs> | null
    /**
     * Filter, which ForecastCurrentRun to fetch.
     */
    where: ForecastCurrentRunWhereUniqueInput
  }

  /**
   * ForecastCurrentRun findUniqueOrThrow
   */
  export type ForecastCurrentRunFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentRun
     */
    select?: ForecastCurrentRunSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastCurrentRun
     */
    omit?: ForecastCurrentRunOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastCurrentRunInclude<ExtArgs> | null
    /**
     * Filter, which ForecastCurrentRun to fetch.
     */
    where: ForecastCurrentRunWhereUniqueInput
  }

  /**
   * ForecastCurrentRun findFirst
   */
  export type ForecastCurrentRunFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentRun
     */
    select?: ForecastCurrentRunSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastCurrentRun
     */
    omit?: ForecastCurrentRunOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastCurrentRunInclude<ExtArgs> | null
    /**
     * Filter, which ForecastCurrentRun to fetch.
     */
    where?: ForecastCurrentRunWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ForecastCurrentRuns to fetch.
     */
    orderBy?: ForecastCurrentRunOrderByWithRelationInput | ForecastCurrentRunOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ForecastCurrentRuns.
     */
    cursor?: ForecastCurrentRunWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ForecastCurrentRuns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ForecastCurrentRuns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ForecastCurrentRuns.
     */
    distinct?: ForecastCurrentRunScalarFieldEnum | ForecastCurrentRunScalarFieldEnum[]
  }

  /**
   * ForecastCurrentRun findFirstOrThrow
   */
  export type ForecastCurrentRunFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentRun
     */
    select?: ForecastCurrentRunSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastCurrentRun
     */
    omit?: ForecastCurrentRunOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastCurrentRunInclude<ExtArgs> | null
    /**
     * Filter, which ForecastCurrentRun to fetch.
     */
    where?: ForecastCurrentRunWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ForecastCurrentRuns to fetch.
     */
    orderBy?: ForecastCurrentRunOrderByWithRelationInput | ForecastCurrentRunOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ForecastCurrentRuns.
     */
    cursor?: ForecastCurrentRunWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ForecastCurrentRuns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ForecastCurrentRuns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ForecastCurrentRuns.
     */
    distinct?: ForecastCurrentRunScalarFieldEnum | ForecastCurrentRunScalarFieldEnum[]
  }

  /**
   * ForecastCurrentRun findMany
   */
  export type ForecastCurrentRunFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentRun
     */
    select?: ForecastCurrentRunSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastCurrentRun
     */
    omit?: ForecastCurrentRunOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastCurrentRunInclude<ExtArgs> | null
    /**
     * Filter, which ForecastCurrentRuns to fetch.
     */
    where?: ForecastCurrentRunWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ForecastCurrentRuns to fetch.
     */
    orderBy?: ForecastCurrentRunOrderByWithRelationInput | ForecastCurrentRunOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ForecastCurrentRuns.
     */
    cursor?: ForecastCurrentRunWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ForecastCurrentRuns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ForecastCurrentRuns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ForecastCurrentRuns.
     */
    distinct?: ForecastCurrentRunScalarFieldEnum | ForecastCurrentRunScalarFieldEnum[]
  }

  /**
   * ForecastCurrentRun create
   */
  export type ForecastCurrentRunCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentRun
     */
    select?: ForecastCurrentRunSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastCurrentRun
     */
    omit?: ForecastCurrentRunOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastCurrentRunInclude<ExtArgs> | null
    /**
     * The data needed to create a ForecastCurrentRun.
     */
    data: XOR<ForecastCurrentRunCreateInput, ForecastCurrentRunUncheckedCreateInput>
  }

  /**
   * ForecastCurrentRun createMany
   */
  export type ForecastCurrentRunCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ForecastCurrentRuns.
     */
    data: ForecastCurrentRunCreateManyInput | ForecastCurrentRunCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ForecastCurrentRun createManyAndReturn
   */
  export type ForecastCurrentRunCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentRun
     */
    select?: ForecastCurrentRunSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastCurrentRun
     */
    omit?: ForecastCurrentRunOmit<ExtArgs> | null
    /**
     * The data used to create many ForecastCurrentRuns.
     */
    data: ForecastCurrentRunCreateManyInput | ForecastCurrentRunCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ForecastCurrentRun update
   */
  export type ForecastCurrentRunUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentRun
     */
    select?: ForecastCurrentRunSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastCurrentRun
     */
    omit?: ForecastCurrentRunOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastCurrentRunInclude<ExtArgs> | null
    /**
     * The data needed to update a ForecastCurrentRun.
     */
    data: XOR<ForecastCurrentRunUpdateInput, ForecastCurrentRunUncheckedUpdateInput>
    /**
     * Choose, which ForecastCurrentRun to update.
     */
    where: ForecastCurrentRunWhereUniqueInput
  }

  /**
   * ForecastCurrentRun updateMany
   */
  export type ForecastCurrentRunUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ForecastCurrentRuns.
     */
    data: XOR<ForecastCurrentRunUpdateManyMutationInput, ForecastCurrentRunUncheckedUpdateManyInput>
    /**
     * Filter which ForecastCurrentRuns to update
     */
    where?: ForecastCurrentRunWhereInput
    /**
     * Limit how many ForecastCurrentRuns to update.
     */
    limit?: number
  }

  /**
   * ForecastCurrentRun updateManyAndReturn
   */
  export type ForecastCurrentRunUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentRun
     */
    select?: ForecastCurrentRunSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastCurrentRun
     */
    omit?: ForecastCurrentRunOmit<ExtArgs> | null
    /**
     * The data used to update ForecastCurrentRuns.
     */
    data: XOR<ForecastCurrentRunUpdateManyMutationInput, ForecastCurrentRunUncheckedUpdateManyInput>
    /**
     * Filter which ForecastCurrentRuns to update
     */
    where?: ForecastCurrentRunWhereInput
    /**
     * Limit how many ForecastCurrentRuns to update.
     */
    limit?: number
  }

  /**
   * ForecastCurrentRun upsert
   */
  export type ForecastCurrentRunUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentRun
     */
    select?: ForecastCurrentRunSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastCurrentRun
     */
    omit?: ForecastCurrentRunOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastCurrentRunInclude<ExtArgs> | null
    /**
     * The filter to search for the ForecastCurrentRun to update in case it exists.
     */
    where: ForecastCurrentRunWhereUniqueInput
    /**
     * In case the ForecastCurrentRun found by the `where` argument doesn't exist, create a new ForecastCurrentRun with this data.
     */
    create: XOR<ForecastCurrentRunCreateInput, ForecastCurrentRunUncheckedCreateInput>
    /**
     * In case the ForecastCurrentRun was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ForecastCurrentRunUpdateInput, ForecastCurrentRunUncheckedUpdateInput>
  }

  /**
   * ForecastCurrentRun delete
   */
  export type ForecastCurrentRunDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentRun
     */
    select?: ForecastCurrentRunSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastCurrentRun
     */
    omit?: ForecastCurrentRunOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastCurrentRunInclude<ExtArgs> | null
    /**
     * Filter which ForecastCurrentRun to delete.
     */
    where: ForecastCurrentRunWhereUniqueInput
  }

  /**
   * ForecastCurrentRun deleteMany
   */
  export type ForecastCurrentRunDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ForecastCurrentRuns to delete
     */
    where?: ForecastCurrentRunWhereInput
    /**
     * Limit how many ForecastCurrentRuns to delete.
     */
    limit?: number
  }

  /**
   * ForecastCurrentRun.points
   */
  export type ForecastCurrentRun$pointsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentPoint
     */
    select?: ForecastCurrentPointSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastCurrentPoint
     */
    omit?: ForecastCurrentPointOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastCurrentPointInclude<ExtArgs> | null
    where?: ForecastCurrentPointWhereInput
    orderBy?: ForecastCurrentPointOrderByWithRelationInput | ForecastCurrentPointOrderByWithRelationInput[]
    cursor?: ForecastCurrentPointWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ForecastCurrentPointScalarFieldEnum | ForecastCurrentPointScalarFieldEnum[]
  }

  /**
   * ForecastCurrentRun without action
   */
  export type ForecastCurrentRunDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentRun
     */
    select?: ForecastCurrentRunSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastCurrentRun
     */
    omit?: ForecastCurrentRunOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastCurrentRunInclude<ExtArgs> | null
  }


  /**
   * Model ForecastCurrentPoint
   */

  export type AggregateForecastCurrentPoint = {
    _count: ForecastCurrentPointCountAggregateOutputType | null
    _avg: ForecastCurrentPointAvgAggregateOutputType | null
    _sum: ForecastCurrentPointSumAggregateOutputType | null
    _min: ForecastCurrentPointMinAggregateOutputType | null
    _max: ForecastCurrentPointMaxAggregateOutputType | null
  }

  export type ForecastCurrentPointAvgAggregateOutputType = {
    horizonSteps: number | null
    forecastValue: Decimal | null
    selectionScore: number | null
  }

  export type ForecastCurrentPointSumAggregateOutputType = {
    horizonSteps: number | null
    forecastValue: Decimal | null
    selectionScore: number | null
  }

  export type ForecastCurrentPointMinAggregateOutputType = {
    id: string | null
    runId: string | null
    horizonLabel: string | null
    horizonSteps: number | null
    forecastDate: Date | null
    forecastValue: Decimal | null
    fitStatus: string | null
    failureReason: string | null
    selectedVariant: string | null
    selectionMetric: string | null
    selectionScore: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ForecastCurrentPointMaxAggregateOutputType = {
    id: string | null
    runId: string | null
    horizonLabel: string | null
    horizonSteps: number | null
    forecastDate: Date | null
    forecastValue: Decimal | null
    fitStatus: string | null
    failureReason: string | null
    selectedVariant: string | null
    selectionMetric: string | null
    selectionScore: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ForecastCurrentPointCountAggregateOutputType = {
    id: number
    runId: number
    horizonLabel: number
    horizonSteps: number
    forecastDate: number
    forecastValue: number
    fitStatus: number
    failureReason: number
    selectedVariant: number
    selectionMetric: number
    selectionScore: number
    metadataJson: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type ForecastCurrentPointAvgAggregateInputType = {
    horizonSteps?: true
    forecastValue?: true
    selectionScore?: true
  }

  export type ForecastCurrentPointSumAggregateInputType = {
    horizonSteps?: true
    forecastValue?: true
    selectionScore?: true
  }

  export type ForecastCurrentPointMinAggregateInputType = {
    id?: true
    runId?: true
    horizonLabel?: true
    horizonSteps?: true
    forecastDate?: true
    forecastValue?: true
    fitStatus?: true
    failureReason?: true
    selectedVariant?: true
    selectionMetric?: true
    selectionScore?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ForecastCurrentPointMaxAggregateInputType = {
    id?: true
    runId?: true
    horizonLabel?: true
    horizonSteps?: true
    forecastDate?: true
    forecastValue?: true
    fitStatus?: true
    failureReason?: true
    selectedVariant?: true
    selectionMetric?: true
    selectionScore?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ForecastCurrentPointCountAggregateInputType = {
    id?: true
    runId?: true
    horizonLabel?: true
    horizonSteps?: true
    forecastDate?: true
    forecastValue?: true
    fitStatus?: true
    failureReason?: true
    selectedVariant?: true
    selectionMetric?: true
    selectionScore?: true
    metadataJson?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type ForecastCurrentPointAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ForecastCurrentPoint to aggregate.
     */
    where?: ForecastCurrentPointWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ForecastCurrentPoints to fetch.
     */
    orderBy?: ForecastCurrentPointOrderByWithRelationInput | ForecastCurrentPointOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ForecastCurrentPointWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ForecastCurrentPoints from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ForecastCurrentPoints.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ForecastCurrentPoints
    **/
    _count?: true | ForecastCurrentPointCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ForecastCurrentPointAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ForecastCurrentPointSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ForecastCurrentPointMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ForecastCurrentPointMaxAggregateInputType
  }

  export type GetForecastCurrentPointAggregateType<T extends ForecastCurrentPointAggregateArgs> = {
        [P in keyof T & keyof AggregateForecastCurrentPoint]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateForecastCurrentPoint[P]>
      : GetScalarType<T[P], AggregateForecastCurrentPoint[P]>
  }




  export type ForecastCurrentPointGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ForecastCurrentPointWhereInput
    orderBy?: ForecastCurrentPointOrderByWithAggregationInput | ForecastCurrentPointOrderByWithAggregationInput[]
    by: ForecastCurrentPointScalarFieldEnum[] | ForecastCurrentPointScalarFieldEnum
    having?: ForecastCurrentPointScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ForecastCurrentPointCountAggregateInputType | true
    _avg?: ForecastCurrentPointAvgAggregateInputType
    _sum?: ForecastCurrentPointSumAggregateInputType
    _min?: ForecastCurrentPointMinAggregateInputType
    _max?: ForecastCurrentPointMaxAggregateInputType
  }

  export type ForecastCurrentPointGroupByOutputType = {
    id: string
    runId: string
    horizonLabel: string
    horizonSteps: number
    forecastDate: Date
    forecastValue: Decimal | null
    fitStatus: string | null
    failureReason: string | null
    selectedVariant: string | null
    selectionMetric: string | null
    selectionScore: number | null
    metadataJson: JsonValue | null
    createdAt: Date
    updatedAt: Date
    _count: ForecastCurrentPointCountAggregateOutputType | null
    _avg: ForecastCurrentPointAvgAggregateOutputType | null
    _sum: ForecastCurrentPointSumAggregateOutputType | null
    _min: ForecastCurrentPointMinAggregateOutputType | null
    _max: ForecastCurrentPointMaxAggregateOutputType | null
  }

  type GetForecastCurrentPointGroupByPayload<T extends ForecastCurrentPointGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ForecastCurrentPointGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ForecastCurrentPointGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ForecastCurrentPointGroupByOutputType[P]>
            : GetScalarType<T[P], ForecastCurrentPointGroupByOutputType[P]>
        }
      >
    >


  export type ForecastCurrentPointSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    runId?: boolean
    horizonLabel?: boolean
    horizonSteps?: boolean
    forecastDate?: boolean
    forecastValue?: boolean
    fitStatus?: boolean
    failureReason?: boolean
    selectedVariant?: boolean
    selectionMetric?: boolean
    selectionScore?: boolean
    metadataJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    run?: boolean | ForecastCurrentRunDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["forecastCurrentPoint"]>

  export type ForecastCurrentPointSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    runId?: boolean
    horizonLabel?: boolean
    horizonSteps?: boolean
    forecastDate?: boolean
    forecastValue?: boolean
    fitStatus?: boolean
    failureReason?: boolean
    selectedVariant?: boolean
    selectionMetric?: boolean
    selectionScore?: boolean
    metadataJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    run?: boolean | ForecastCurrentRunDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["forecastCurrentPoint"]>

  export type ForecastCurrentPointSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    runId?: boolean
    horizonLabel?: boolean
    horizonSteps?: boolean
    forecastDate?: boolean
    forecastValue?: boolean
    fitStatus?: boolean
    failureReason?: boolean
    selectedVariant?: boolean
    selectionMetric?: boolean
    selectionScore?: boolean
    metadataJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    run?: boolean | ForecastCurrentRunDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["forecastCurrentPoint"]>

  export type ForecastCurrentPointSelectScalar = {
    id?: boolean
    runId?: boolean
    horizonLabel?: boolean
    horizonSteps?: boolean
    forecastDate?: boolean
    forecastValue?: boolean
    fitStatus?: boolean
    failureReason?: boolean
    selectedVariant?: boolean
    selectionMetric?: boolean
    selectionScore?: boolean
    metadataJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type ForecastCurrentPointOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "runId" | "horizonLabel" | "horizonSteps" | "forecastDate" | "forecastValue" | "fitStatus" | "failureReason" | "selectedVariant" | "selectionMetric" | "selectionScore" | "metadataJson" | "createdAt" | "updatedAt", ExtArgs["result"]["forecastCurrentPoint"]>
  export type ForecastCurrentPointInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    run?: boolean | ForecastCurrentRunDefaultArgs<ExtArgs>
  }
  export type ForecastCurrentPointIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    run?: boolean | ForecastCurrentRunDefaultArgs<ExtArgs>
  }
  export type ForecastCurrentPointIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    run?: boolean | ForecastCurrentRunDefaultArgs<ExtArgs>
  }

  export type $ForecastCurrentPointPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ForecastCurrentPoint"
    objects: {
      run: Prisma.$ForecastCurrentRunPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      runId: string
      horizonLabel: string
      horizonSteps: number
      forecastDate: Date
      forecastValue: Prisma.Decimal | null
      fitStatus: string | null
      failureReason: string | null
      selectedVariant: string | null
      selectionMetric: string | null
      selectionScore: number | null
      metadataJson: Prisma.JsonValue | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["forecastCurrentPoint"]>
    composites: {}
  }

  type ForecastCurrentPointGetPayload<S extends boolean | null | undefined | ForecastCurrentPointDefaultArgs> = $Result.GetResult<Prisma.$ForecastCurrentPointPayload, S>

  type ForecastCurrentPointCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ForecastCurrentPointFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ForecastCurrentPointCountAggregateInputType | true
    }

  export interface ForecastCurrentPointDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ForecastCurrentPoint'], meta: { name: 'ForecastCurrentPoint' } }
    /**
     * Find zero or one ForecastCurrentPoint that matches the filter.
     * @param {ForecastCurrentPointFindUniqueArgs} args - Arguments to find a ForecastCurrentPoint
     * @example
     * // Get one ForecastCurrentPoint
     * const forecastCurrentPoint = await prisma.forecastCurrentPoint.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ForecastCurrentPointFindUniqueArgs>(args: SelectSubset<T, ForecastCurrentPointFindUniqueArgs<ExtArgs>>): Prisma__ForecastCurrentPointClient<$Result.GetResult<Prisma.$ForecastCurrentPointPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one ForecastCurrentPoint that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ForecastCurrentPointFindUniqueOrThrowArgs} args - Arguments to find a ForecastCurrentPoint
     * @example
     * // Get one ForecastCurrentPoint
     * const forecastCurrentPoint = await prisma.forecastCurrentPoint.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ForecastCurrentPointFindUniqueOrThrowArgs>(args: SelectSubset<T, ForecastCurrentPointFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ForecastCurrentPointClient<$Result.GetResult<Prisma.$ForecastCurrentPointPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ForecastCurrentPoint that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastCurrentPointFindFirstArgs} args - Arguments to find a ForecastCurrentPoint
     * @example
     * // Get one ForecastCurrentPoint
     * const forecastCurrentPoint = await prisma.forecastCurrentPoint.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ForecastCurrentPointFindFirstArgs>(args?: SelectSubset<T, ForecastCurrentPointFindFirstArgs<ExtArgs>>): Prisma__ForecastCurrentPointClient<$Result.GetResult<Prisma.$ForecastCurrentPointPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ForecastCurrentPoint that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastCurrentPointFindFirstOrThrowArgs} args - Arguments to find a ForecastCurrentPoint
     * @example
     * // Get one ForecastCurrentPoint
     * const forecastCurrentPoint = await prisma.forecastCurrentPoint.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ForecastCurrentPointFindFirstOrThrowArgs>(args?: SelectSubset<T, ForecastCurrentPointFindFirstOrThrowArgs<ExtArgs>>): Prisma__ForecastCurrentPointClient<$Result.GetResult<Prisma.$ForecastCurrentPointPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more ForecastCurrentPoints that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastCurrentPointFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ForecastCurrentPoints
     * const forecastCurrentPoints = await prisma.forecastCurrentPoint.findMany()
     * 
     * // Get first 10 ForecastCurrentPoints
     * const forecastCurrentPoints = await prisma.forecastCurrentPoint.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const forecastCurrentPointWithIdOnly = await prisma.forecastCurrentPoint.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ForecastCurrentPointFindManyArgs>(args?: SelectSubset<T, ForecastCurrentPointFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ForecastCurrentPointPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a ForecastCurrentPoint.
     * @param {ForecastCurrentPointCreateArgs} args - Arguments to create a ForecastCurrentPoint.
     * @example
     * // Create one ForecastCurrentPoint
     * const ForecastCurrentPoint = await prisma.forecastCurrentPoint.create({
     *   data: {
     *     // ... data to create a ForecastCurrentPoint
     *   }
     * })
     * 
     */
    create<T extends ForecastCurrentPointCreateArgs>(args: SelectSubset<T, ForecastCurrentPointCreateArgs<ExtArgs>>): Prisma__ForecastCurrentPointClient<$Result.GetResult<Prisma.$ForecastCurrentPointPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many ForecastCurrentPoints.
     * @param {ForecastCurrentPointCreateManyArgs} args - Arguments to create many ForecastCurrentPoints.
     * @example
     * // Create many ForecastCurrentPoints
     * const forecastCurrentPoint = await prisma.forecastCurrentPoint.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ForecastCurrentPointCreateManyArgs>(args?: SelectSubset<T, ForecastCurrentPointCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ForecastCurrentPoints and returns the data saved in the database.
     * @param {ForecastCurrentPointCreateManyAndReturnArgs} args - Arguments to create many ForecastCurrentPoints.
     * @example
     * // Create many ForecastCurrentPoints
     * const forecastCurrentPoint = await prisma.forecastCurrentPoint.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ForecastCurrentPoints and only return the `id`
     * const forecastCurrentPointWithIdOnly = await prisma.forecastCurrentPoint.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ForecastCurrentPointCreateManyAndReturnArgs>(args?: SelectSubset<T, ForecastCurrentPointCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ForecastCurrentPointPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a ForecastCurrentPoint.
     * @param {ForecastCurrentPointDeleteArgs} args - Arguments to delete one ForecastCurrentPoint.
     * @example
     * // Delete one ForecastCurrentPoint
     * const ForecastCurrentPoint = await prisma.forecastCurrentPoint.delete({
     *   where: {
     *     // ... filter to delete one ForecastCurrentPoint
     *   }
     * })
     * 
     */
    delete<T extends ForecastCurrentPointDeleteArgs>(args: SelectSubset<T, ForecastCurrentPointDeleteArgs<ExtArgs>>): Prisma__ForecastCurrentPointClient<$Result.GetResult<Prisma.$ForecastCurrentPointPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one ForecastCurrentPoint.
     * @param {ForecastCurrentPointUpdateArgs} args - Arguments to update one ForecastCurrentPoint.
     * @example
     * // Update one ForecastCurrentPoint
     * const forecastCurrentPoint = await prisma.forecastCurrentPoint.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ForecastCurrentPointUpdateArgs>(args: SelectSubset<T, ForecastCurrentPointUpdateArgs<ExtArgs>>): Prisma__ForecastCurrentPointClient<$Result.GetResult<Prisma.$ForecastCurrentPointPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more ForecastCurrentPoints.
     * @param {ForecastCurrentPointDeleteManyArgs} args - Arguments to filter ForecastCurrentPoints to delete.
     * @example
     * // Delete a few ForecastCurrentPoints
     * const { count } = await prisma.forecastCurrentPoint.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ForecastCurrentPointDeleteManyArgs>(args?: SelectSubset<T, ForecastCurrentPointDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ForecastCurrentPoints.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastCurrentPointUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ForecastCurrentPoints
     * const forecastCurrentPoint = await prisma.forecastCurrentPoint.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ForecastCurrentPointUpdateManyArgs>(args: SelectSubset<T, ForecastCurrentPointUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ForecastCurrentPoints and returns the data updated in the database.
     * @param {ForecastCurrentPointUpdateManyAndReturnArgs} args - Arguments to update many ForecastCurrentPoints.
     * @example
     * // Update many ForecastCurrentPoints
     * const forecastCurrentPoint = await prisma.forecastCurrentPoint.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more ForecastCurrentPoints and only return the `id`
     * const forecastCurrentPointWithIdOnly = await prisma.forecastCurrentPoint.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ForecastCurrentPointUpdateManyAndReturnArgs>(args: SelectSubset<T, ForecastCurrentPointUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ForecastCurrentPointPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one ForecastCurrentPoint.
     * @param {ForecastCurrentPointUpsertArgs} args - Arguments to update or create a ForecastCurrentPoint.
     * @example
     * // Update or create a ForecastCurrentPoint
     * const forecastCurrentPoint = await prisma.forecastCurrentPoint.upsert({
     *   create: {
     *     // ... data to create a ForecastCurrentPoint
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ForecastCurrentPoint we want to update
     *   }
     * })
     */
    upsert<T extends ForecastCurrentPointUpsertArgs>(args: SelectSubset<T, ForecastCurrentPointUpsertArgs<ExtArgs>>): Prisma__ForecastCurrentPointClient<$Result.GetResult<Prisma.$ForecastCurrentPointPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of ForecastCurrentPoints.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastCurrentPointCountArgs} args - Arguments to filter ForecastCurrentPoints to count.
     * @example
     * // Count the number of ForecastCurrentPoints
     * const count = await prisma.forecastCurrentPoint.count({
     *   where: {
     *     // ... the filter for the ForecastCurrentPoints we want to count
     *   }
     * })
    **/
    count<T extends ForecastCurrentPointCountArgs>(
      args?: Subset<T, ForecastCurrentPointCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ForecastCurrentPointCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ForecastCurrentPoint.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastCurrentPointAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ForecastCurrentPointAggregateArgs>(args: Subset<T, ForecastCurrentPointAggregateArgs>): Prisma.PrismaPromise<GetForecastCurrentPointAggregateType<T>>

    /**
     * Group by ForecastCurrentPoint.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastCurrentPointGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ForecastCurrentPointGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ForecastCurrentPointGroupByArgs['orderBy'] }
        : { orderBy?: ForecastCurrentPointGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ForecastCurrentPointGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetForecastCurrentPointGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ForecastCurrentPoint model
   */
  readonly fields: ForecastCurrentPointFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ForecastCurrentPoint.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ForecastCurrentPointClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    run<T extends ForecastCurrentRunDefaultArgs<ExtArgs> = {}>(args?: Subset<T, ForecastCurrentRunDefaultArgs<ExtArgs>>): Prisma__ForecastCurrentRunClient<$Result.GetResult<Prisma.$ForecastCurrentRunPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ForecastCurrentPoint model
   */
  interface ForecastCurrentPointFieldRefs {
    readonly id: FieldRef<"ForecastCurrentPoint", 'String'>
    readonly runId: FieldRef<"ForecastCurrentPoint", 'String'>
    readonly horizonLabel: FieldRef<"ForecastCurrentPoint", 'String'>
    readonly horizonSteps: FieldRef<"ForecastCurrentPoint", 'Int'>
    readonly forecastDate: FieldRef<"ForecastCurrentPoint", 'DateTime'>
    readonly forecastValue: FieldRef<"ForecastCurrentPoint", 'Decimal'>
    readonly fitStatus: FieldRef<"ForecastCurrentPoint", 'String'>
    readonly failureReason: FieldRef<"ForecastCurrentPoint", 'String'>
    readonly selectedVariant: FieldRef<"ForecastCurrentPoint", 'String'>
    readonly selectionMetric: FieldRef<"ForecastCurrentPoint", 'String'>
    readonly selectionScore: FieldRef<"ForecastCurrentPoint", 'Float'>
    readonly metadataJson: FieldRef<"ForecastCurrentPoint", 'Json'>
    readonly createdAt: FieldRef<"ForecastCurrentPoint", 'DateTime'>
    readonly updatedAt: FieldRef<"ForecastCurrentPoint", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ForecastCurrentPoint findUnique
   */
  export type ForecastCurrentPointFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentPoint
     */
    select?: ForecastCurrentPointSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastCurrentPoint
     */
    omit?: ForecastCurrentPointOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastCurrentPointInclude<ExtArgs> | null
    /**
     * Filter, which ForecastCurrentPoint to fetch.
     */
    where: ForecastCurrentPointWhereUniqueInput
  }

  /**
   * ForecastCurrentPoint findUniqueOrThrow
   */
  export type ForecastCurrentPointFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentPoint
     */
    select?: ForecastCurrentPointSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastCurrentPoint
     */
    omit?: ForecastCurrentPointOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastCurrentPointInclude<ExtArgs> | null
    /**
     * Filter, which ForecastCurrentPoint to fetch.
     */
    where: ForecastCurrentPointWhereUniqueInput
  }

  /**
   * ForecastCurrentPoint findFirst
   */
  export type ForecastCurrentPointFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentPoint
     */
    select?: ForecastCurrentPointSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastCurrentPoint
     */
    omit?: ForecastCurrentPointOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastCurrentPointInclude<ExtArgs> | null
    /**
     * Filter, which ForecastCurrentPoint to fetch.
     */
    where?: ForecastCurrentPointWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ForecastCurrentPoints to fetch.
     */
    orderBy?: ForecastCurrentPointOrderByWithRelationInput | ForecastCurrentPointOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ForecastCurrentPoints.
     */
    cursor?: ForecastCurrentPointWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ForecastCurrentPoints from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ForecastCurrentPoints.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ForecastCurrentPoints.
     */
    distinct?: ForecastCurrentPointScalarFieldEnum | ForecastCurrentPointScalarFieldEnum[]
  }

  /**
   * ForecastCurrentPoint findFirstOrThrow
   */
  export type ForecastCurrentPointFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentPoint
     */
    select?: ForecastCurrentPointSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastCurrentPoint
     */
    omit?: ForecastCurrentPointOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastCurrentPointInclude<ExtArgs> | null
    /**
     * Filter, which ForecastCurrentPoint to fetch.
     */
    where?: ForecastCurrentPointWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ForecastCurrentPoints to fetch.
     */
    orderBy?: ForecastCurrentPointOrderByWithRelationInput | ForecastCurrentPointOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ForecastCurrentPoints.
     */
    cursor?: ForecastCurrentPointWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ForecastCurrentPoints from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ForecastCurrentPoints.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ForecastCurrentPoints.
     */
    distinct?: ForecastCurrentPointScalarFieldEnum | ForecastCurrentPointScalarFieldEnum[]
  }

  /**
   * ForecastCurrentPoint findMany
   */
  export type ForecastCurrentPointFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentPoint
     */
    select?: ForecastCurrentPointSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastCurrentPoint
     */
    omit?: ForecastCurrentPointOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastCurrentPointInclude<ExtArgs> | null
    /**
     * Filter, which ForecastCurrentPoints to fetch.
     */
    where?: ForecastCurrentPointWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ForecastCurrentPoints to fetch.
     */
    orderBy?: ForecastCurrentPointOrderByWithRelationInput | ForecastCurrentPointOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ForecastCurrentPoints.
     */
    cursor?: ForecastCurrentPointWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ForecastCurrentPoints from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ForecastCurrentPoints.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ForecastCurrentPoints.
     */
    distinct?: ForecastCurrentPointScalarFieldEnum | ForecastCurrentPointScalarFieldEnum[]
  }

  /**
   * ForecastCurrentPoint create
   */
  export type ForecastCurrentPointCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentPoint
     */
    select?: ForecastCurrentPointSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastCurrentPoint
     */
    omit?: ForecastCurrentPointOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastCurrentPointInclude<ExtArgs> | null
    /**
     * The data needed to create a ForecastCurrentPoint.
     */
    data: XOR<ForecastCurrentPointCreateInput, ForecastCurrentPointUncheckedCreateInput>
  }

  /**
   * ForecastCurrentPoint createMany
   */
  export type ForecastCurrentPointCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ForecastCurrentPoints.
     */
    data: ForecastCurrentPointCreateManyInput | ForecastCurrentPointCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ForecastCurrentPoint createManyAndReturn
   */
  export type ForecastCurrentPointCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentPoint
     */
    select?: ForecastCurrentPointSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastCurrentPoint
     */
    omit?: ForecastCurrentPointOmit<ExtArgs> | null
    /**
     * The data used to create many ForecastCurrentPoints.
     */
    data: ForecastCurrentPointCreateManyInput | ForecastCurrentPointCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastCurrentPointIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * ForecastCurrentPoint update
   */
  export type ForecastCurrentPointUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentPoint
     */
    select?: ForecastCurrentPointSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastCurrentPoint
     */
    omit?: ForecastCurrentPointOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastCurrentPointInclude<ExtArgs> | null
    /**
     * The data needed to update a ForecastCurrentPoint.
     */
    data: XOR<ForecastCurrentPointUpdateInput, ForecastCurrentPointUncheckedUpdateInput>
    /**
     * Choose, which ForecastCurrentPoint to update.
     */
    where: ForecastCurrentPointWhereUniqueInput
  }

  /**
   * ForecastCurrentPoint updateMany
   */
  export type ForecastCurrentPointUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ForecastCurrentPoints.
     */
    data: XOR<ForecastCurrentPointUpdateManyMutationInput, ForecastCurrentPointUncheckedUpdateManyInput>
    /**
     * Filter which ForecastCurrentPoints to update
     */
    where?: ForecastCurrentPointWhereInput
    /**
     * Limit how many ForecastCurrentPoints to update.
     */
    limit?: number
  }

  /**
   * ForecastCurrentPoint updateManyAndReturn
   */
  export type ForecastCurrentPointUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentPoint
     */
    select?: ForecastCurrentPointSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastCurrentPoint
     */
    omit?: ForecastCurrentPointOmit<ExtArgs> | null
    /**
     * The data used to update ForecastCurrentPoints.
     */
    data: XOR<ForecastCurrentPointUpdateManyMutationInput, ForecastCurrentPointUncheckedUpdateManyInput>
    /**
     * Filter which ForecastCurrentPoints to update
     */
    where?: ForecastCurrentPointWhereInput
    /**
     * Limit how many ForecastCurrentPoints to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastCurrentPointIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * ForecastCurrentPoint upsert
   */
  export type ForecastCurrentPointUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentPoint
     */
    select?: ForecastCurrentPointSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastCurrentPoint
     */
    omit?: ForecastCurrentPointOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastCurrentPointInclude<ExtArgs> | null
    /**
     * The filter to search for the ForecastCurrentPoint to update in case it exists.
     */
    where: ForecastCurrentPointWhereUniqueInput
    /**
     * In case the ForecastCurrentPoint found by the `where` argument doesn't exist, create a new ForecastCurrentPoint with this data.
     */
    create: XOR<ForecastCurrentPointCreateInput, ForecastCurrentPointUncheckedCreateInput>
    /**
     * In case the ForecastCurrentPoint was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ForecastCurrentPointUpdateInput, ForecastCurrentPointUncheckedUpdateInput>
  }

  /**
   * ForecastCurrentPoint delete
   */
  export type ForecastCurrentPointDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentPoint
     */
    select?: ForecastCurrentPointSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastCurrentPoint
     */
    omit?: ForecastCurrentPointOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastCurrentPointInclude<ExtArgs> | null
    /**
     * Filter which ForecastCurrentPoint to delete.
     */
    where: ForecastCurrentPointWhereUniqueInput
  }

  /**
   * ForecastCurrentPoint deleteMany
   */
  export type ForecastCurrentPointDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ForecastCurrentPoints to delete
     */
    where?: ForecastCurrentPointWhereInput
    /**
     * Limit how many ForecastCurrentPoints to delete.
     */
    limit?: number
  }

  /**
   * ForecastCurrentPoint without action
   */
  export type ForecastCurrentPointDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastCurrentPoint
     */
    select?: ForecastCurrentPointSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastCurrentPoint
     */
    omit?: ForecastCurrentPointOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastCurrentPointInclude<ExtArgs> | null
  }


  /**
   * Model ForecastVerificationRun
   */

  export type AggregateForecastVerificationRun = {
    _count: ForecastVerificationRunCountAggregateOutputType | null
    _avg: ForecastVerificationRunAvgAggregateOutputType | null
    _sum: ForecastVerificationRunSumAggregateOutputType | null
    _min: ForecastVerificationRunMinAggregateOutputType | null
    _max: ForecastVerificationRunMaxAggregateOutputType | null
  }

  export type ForecastVerificationRunAvgAggregateOutputType = {
    observationCount: number | null
    runtimeSeconds: number | null
  }

  export type ForecastVerificationRunSumAggregateOutputType = {
    observationCount: number | null
    runtimeSeconds: number | null
  }

  export type ForecastVerificationRunMinAggregateOutputType = {
    id: string | null
    seriesId: string | null
    displayName: string | null
    description: string | null
    frequency: string | null
    currency: string | null
    unit: string | null
    sourceLabel: string | null
    inputSource: string | null
    inputRunId: string | null
    historyFingerprint: string | null
    targetBasis: $Enums.ForecastTargetBasis | null
    methodId: string | null
    historyStartAt: Date | null
    historyEndAt: Date | null
    observationCount: number | null
    forecastOriginAt: Date | null
    modelId: string | null
    methodVersion: string | null
    status: string | null
    failureReason: string | null
    runtimeSeconds: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ForecastVerificationRunMaxAggregateOutputType = {
    id: string | null
    seriesId: string | null
    displayName: string | null
    description: string | null
    frequency: string | null
    currency: string | null
    unit: string | null
    sourceLabel: string | null
    inputSource: string | null
    inputRunId: string | null
    historyFingerprint: string | null
    targetBasis: $Enums.ForecastTargetBasis | null
    methodId: string | null
    historyStartAt: Date | null
    historyEndAt: Date | null
    observationCount: number | null
    forecastOriginAt: Date | null
    modelId: string | null
    methodVersion: string | null
    status: string | null
    failureReason: string | null
    runtimeSeconds: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ForecastVerificationRunCountAggregateOutputType = {
    id: number
    seriesId: number
    displayName: number
    description: number
    frequency: number
    currency: number
    unit: number
    sourceLabel: number
    inputSource: number
    inputRunId: number
    historyFingerprint: number
    targetBasis: number
    methodId: number
    historyStartAt: number
    historyEndAt: number
    observationCount: number
    forecastOriginAt: number
    modelId: number
    methodVersion: number
    status: number
    failureReason: number
    runtimeSeconds: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type ForecastVerificationRunAvgAggregateInputType = {
    observationCount?: true
    runtimeSeconds?: true
  }

  export type ForecastVerificationRunSumAggregateInputType = {
    observationCount?: true
    runtimeSeconds?: true
  }

  export type ForecastVerificationRunMinAggregateInputType = {
    id?: true
    seriesId?: true
    displayName?: true
    description?: true
    frequency?: true
    currency?: true
    unit?: true
    sourceLabel?: true
    inputSource?: true
    inputRunId?: true
    historyFingerprint?: true
    targetBasis?: true
    methodId?: true
    historyStartAt?: true
    historyEndAt?: true
    observationCount?: true
    forecastOriginAt?: true
    modelId?: true
    methodVersion?: true
    status?: true
    failureReason?: true
    runtimeSeconds?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ForecastVerificationRunMaxAggregateInputType = {
    id?: true
    seriesId?: true
    displayName?: true
    description?: true
    frequency?: true
    currency?: true
    unit?: true
    sourceLabel?: true
    inputSource?: true
    inputRunId?: true
    historyFingerprint?: true
    targetBasis?: true
    methodId?: true
    historyStartAt?: true
    historyEndAt?: true
    observationCount?: true
    forecastOriginAt?: true
    modelId?: true
    methodVersion?: true
    status?: true
    failureReason?: true
    runtimeSeconds?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ForecastVerificationRunCountAggregateInputType = {
    id?: true
    seriesId?: true
    displayName?: true
    description?: true
    frequency?: true
    currency?: true
    unit?: true
    sourceLabel?: true
    inputSource?: true
    inputRunId?: true
    historyFingerprint?: true
    targetBasis?: true
    methodId?: true
    historyStartAt?: true
    historyEndAt?: true
    observationCount?: true
    forecastOriginAt?: true
    modelId?: true
    methodVersion?: true
    status?: true
    failureReason?: true
    runtimeSeconds?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type ForecastVerificationRunAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ForecastVerificationRun to aggregate.
     */
    where?: ForecastVerificationRunWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ForecastVerificationRuns to fetch.
     */
    orderBy?: ForecastVerificationRunOrderByWithRelationInput | ForecastVerificationRunOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ForecastVerificationRunWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ForecastVerificationRuns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ForecastVerificationRuns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ForecastVerificationRuns
    **/
    _count?: true | ForecastVerificationRunCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ForecastVerificationRunAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ForecastVerificationRunSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ForecastVerificationRunMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ForecastVerificationRunMaxAggregateInputType
  }

  export type GetForecastVerificationRunAggregateType<T extends ForecastVerificationRunAggregateArgs> = {
        [P in keyof T & keyof AggregateForecastVerificationRun]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateForecastVerificationRun[P]>
      : GetScalarType<T[P], AggregateForecastVerificationRun[P]>
  }




  export type ForecastVerificationRunGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ForecastVerificationRunWhereInput
    orderBy?: ForecastVerificationRunOrderByWithAggregationInput | ForecastVerificationRunOrderByWithAggregationInput[]
    by: ForecastVerificationRunScalarFieldEnum[] | ForecastVerificationRunScalarFieldEnum
    having?: ForecastVerificationRunScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ForecastVerificationRunCountAggregateInputType | true
    _avg?: ForecastVerificationRunAvgAggregateInputType
    _sum?: ForecastVerificationRunSumAggregateInputType
    _min?: ForecastVerificationRunMinAggregateInputType
    _max?: ForecastVerificationRunMaxAggregateInputType
  }

  export type ForecastVerificationRunGroupByOutputType = {
    id: string
    seriesId: string
    displayName: string
    description: string | null
    frequency: string | null
    currency: string | null
    unit: string | null
    sourceLabel: string | null
    inputSource: string
    inputRunId: string | null
    historyFingerprint: string
    targetBasis: $Enums.ForecastTargetBasis
    methodId: string
    historyStartAt: Date | null
    historyEndAt: Date | null
    observationCount: number
    forecastOriginAt: Date | null
    modelId: string
    methodVersion: string
    status: string
    failureReason: string | null
    runtimeSeconds: number | null
    createdAt: Date
    updatedAt: Date
    _count: ForecastVerificationRunCountAggregateOutputType | null
    _avg: ForecastVerificationRunAvgAggregateOutputType | null
    _sum: ForecastVerificationRunSumAggregateOutputType | null
    _min: ForecastVerificationRunMinAggregateOutputType | null
    _max: ForecastVerificationRunMaxAggregateOutputType | null
  }

  type GetForecastVerificationRunGroupByPayload<T extends ForecastVerificationRunGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ForecastVerificationRunGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ForecastVerificationRunGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ForecastVerificationRunGroupByOutputType[P]>
            : GetScalarType<T[P], ForecastVerificationRunGroupByOutputType[P]>
        }
      >
    >


  export type ForecastVerificationRunSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    seriesId?: boolean
    displayName?: boolean
    description?: boolean
    frequency?: boolean
    currency?: boolean
    unit?: boolean
    sourceLabel?: boolean
    inputSource?: boolean
    inputRunId?: boolean
    historyFingerprint?: boolean
    targetBasis?: boolean
    methodId?: boolean
    historyStartAt?: boolean
    historyEndAt?: boolean
    observationCount?: boolean
    forecastOriginAt?: boolean
    modelId?: boolean
    methodVersion?: boolean
    status?: boolean
    failureReason?: boolean
    runtimeSeconds?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    metrics?: boolean | ForecastVerificationRun$metricsArgs<ExtArgs>
    points?: boolean | ForecastVerificationRun$pointsArgs<ExtArgs>
    _count?: boolean | ForecastVerificationRunCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["forecastVerificationRun"]>

  export type ForecastVerificationRunSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    seriesId?: boolean
    displayName?: boolean
    description?: boolean
    frequency?: boolean
    currency?: boolean
    unit?: boolean
    sourceLabel?: boolean
    inputSource?: boolean
    inputRunId?: boolean
    historyFingerprint?: boolean
    targetBasis?: boolean
    methodId?: boolean
    historyStartAt?: boolean
    historyEndAt?: boolean
    observationCount?: boolean
    forecastOriginAt?: boolean
    modelId?: boolean
    methodVersion?: boolean
    status?: boolean
    failureReason?: boolean
    runtimeSeconds?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["forecastVerificationRun"]>

  export type ForecastVerificationRunSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    seriesId?: boolean
    displayName?: boolean
    description?: boolean
    frequency?: boolean
    currency?: boolean
    unit?: boolean
    sourceLabel?: boolean
    inputSource?: boolean
    inputRunId?: boolean
    historyFingerprint?: boolean
    targetBasis?: boolean
    methodId?: boolean
    historyStartAt?: boolean
    historyEndAt?: boolean
    observationCount?: boolean
    forecastOriginAt?: boolean
    modelId?: boolean
    methodVersion?: boolean
    status?: boolean
    failureReason?: boolean
    runtimeSeconds?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["forecastVerificationRun"]>

  export type ForecastVerificationRunSelectScalar = {
    id?: boolean
    seriesId?: boolean
    displayName?: boolean
    description?: boolean
    frequency?: boolean
    currency?: boolean
    unit?: boolean
    sourceLabel?: boolean
    inputSource?: boolean
    inputRunId?: boolean
    historyFingerprint?: boolean
    targetBasis?: boolean
    methodId?: boolean
    historyStartAt?: boolean
    historyEndAt?: boolean
    observationCount?: boolean
    forecastOriginAt?: boolean
    modelId?: boolean
    methodVersion?: boolean
    status?: boolean
    failureReason?: boolean
    runtimeSeconds?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type ForecastVerificationRunOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "seriesId" | "displayName" | "description" | "frequency" | "currency" | "unit" | "sourceLabel" | "inputSource" | "inputRunId" | "historyFingerprint" | "targetBasis" | "methodId" | "historyStartAt" | "historyEndAt" | "observationCount" | "forecastOriginAt" | "modelId" | "methodVersion" | "status" | "failureReason" | "runtimeSeconds" | "createdAt" | "updatedAt", ExtArgs["result"]["forecastVerificationRun"]>
  export type ForecastVerificationRunInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    metrics?: boolean | ForecastVerificationRun$metricsArgs<ExtArgs>
    points?: boolean | ForecastVerificationRun$pointsArgs<ExtArgs>
    _count?: boolean | ForecastVerificationRunCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type ForecastVerificationRunIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type ForecastVerificationRunIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $ForecastVerificationRunPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ForecastVerificationRun"
    objects: {
      metrics: Prisma.$ForecastVerificationMetricPayload<ExtArgs>[]
      points: Prisma.$ForecastVerificationPointPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      seriesId: string
      displayName: string
      description: string | null
      frequency: string | null
      currency: string | null
      unit: string | null
      sourceLabel: string | null
      inputSource: string
      inputRunId: string | null
      historyFingerprint: string
      targetBasis: $Enums.ForecastTargetBasis
      methodId: string
      historyStartAt: Date | null
      historyEndAt: Date | null
      observationCount: number
      forecastOriginAt: Date | null
      modelId: string
      methodVersion: string
      status: string
      failureReason: string | null
      runtimeSeconds: number | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["forecastVerificationRun"]>
    composites: {}
  }

  type ForecastVerificationRunGetPayload<S extends boolean | null | undefined | ForecastVerificationRunDefaultArgs> = $Result.GetResult<Prisma.$ForecastVerificationRunPayload, S>

  type ForecastVerificationRunCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ForecastVerificationRunFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ForecastVerificationRunCountAggregateInputType | true
    }

  export interface ForecastVerificationRunDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ForecastVerificationRun'], meta: { name: 'ForecastVerificationRun' } }
    /**
     * Find zero or one ForecastVerificationRun that matches the filter.
     * @param {ForecastVerificationRunFindUniqueArgs} args - Arguments to find a ForecastVerificationRun
     * @example
     * // Get one ForecastVerificationRun
     * const forecastVerificationRun = await prisma.forecastVerificationRun.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ForecastVerificationRunFindUniqueArgs>(args: SelectSubset<T, ForecastVerificationRunFindUniqueArgs<ExtArgs>>): Prisma__ForecastVerificationRunClient<$Result.GetResult<Prisma.$ForecastVerificationRunPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one ForecastVerificationRun that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ForecastVerificationRunFindUniqueOrThrowArgs} args - Arguments to find a ForecastVerificationRun
     * @example
     * // Get one ForecastVerificationRun
     * const forecastVerificationRun = await prisma.forecastVerificationRun.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ForecastVerificationRunFindUniqueOrThrowArgs>(args: SelectSubset<T, ForecastVerificationRunFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ForecastVerificationRunClient<$Result.GetResult<Prisma.$ForecastVerificationRunPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ForecastVerificationRun that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastVerificationRunFindFirstArgs} args - Arguments to find a ForecastVerificationRun
     * @example
     * // Get one ForecastVerificationRun
     * const forecastVerificationRun = await prisma.forecastVerificationRun.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ForecastVerificationRunFindFirstArgs>(args?: SelectSubset<T, ForecastVerificationRunFindFirstArgs<ExtArgs>>): Prisma__ForecastVerificationRunClient<$Result.GetResult<Prisma.$ForecastVerificationRunPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ForecastVerificationRun that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastVerificationRunFindFirstOrThrowArgs} args - Arguments to find a ForecastVerificationRun
     * @example
     * // Get one ForecastVerificationRun
     * const forecastVerificationRun = await prisma.forecastVerificationRun.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ForecastVerificationRunFindFirstOrThrowArgs>(args?: SelectSubset<T, ForecastVerificationRunFindFirstOrThrowArgs<ExtArgs>>): Prisma__ForecastVerificationRunClient<$Result.GetResult<Prisma.$ForecastVerificationRunPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more ForecastVerificationRuns that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastVerificationRunFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ForecastVerificationRuns
     * const forecastVerificationRuns = await prisma.forecastVerificationRun.findMany()
     * 
     * // Get first 10 ForecastVerificationRuns
     * const forecastVerificationRuns = await prisma.forecastVerificationRun.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const forecastVerificationRunWithIdOnly = await prisma.forecastVerificationRun.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ForecastVerificationRunFindManyArgs>(args?: SelectSubset<T, ForecastVerificationRunFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ForecastVerificationRunPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a ForecastVerificationRun.
     * @param {ForecastVerificationRunCreateArgs} args - Arguments to create a ForecastVerificationRun.
     * @example
     * // Create one ForecastVerificationRun
     * const ForecastVerificationRun = await prisma.forecastVerificationRun.create({
     *   data: {
     *     // ... data to create a ForecastVerificationRun
     *   }
     * })
     * 
     */
    create<T extends ForecastVerificationRunCreateArgs>(args: SelectSubset<T, ForecastVerificationRunCreateArgs<ExtArgs>>): Prisma__ForecastVerificationRunClient<$Result.GetResult<Prisma.$ForecastVerificationRunPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many ForecastVerificationRuns.
     * @param {ForecastVerificationRunCreateManyArgs} args - Arguments to create many ForecastVerificationRuns.
     * @example
     * // Create many ForecastVerificationRuns
     * const forecastVerificationRun = await prisma.forecastVerificationRun.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ForecastVerificationRunCreateManyArgs>(args?: SelectSubset<T, ForecastVerificationRunCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ForecastVerificationRuns and returns the data saved in the database.
     * @param {ForecastVerificationRunCreateManyAndReturnArgs} args - Arguments to create many ForecastVerificationRuns.
     * @example
     * // Create many ForecastVerificationRuns
     * const forecastVerificationRun = await prisma.forecastVerificationRun.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ForecastVerificationRuns and only return the `id`
     * const forecastVerificationRunWithIdOnly = await prisma.forecastVerificationRun.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ForecastVerificationRunCreateManyAndReturnArgs>(args?: SelectSubset<T, ForecastVerificationRunCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ForecastVerificationRunPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a ForecastVerificationRun.
     * @param {ForecastVerificationRunDeleteArgs} args - Arguments to delete one ForecastVerificationRun.
     * @example
     * // Delete one ForecastVerificationRun
     * const ForecastVerificationRun = await prisma.forecastVerificationRun.delete({
     *   where: {
     *     // ... filter to delete one ForecastVerificationRun
     *   }
     * })
     * 
     */
    delete<T extends ForecastVerificationRunDeleteArgs>(args: SelectSubset<T, ForecastVerificationRunDeleteArgs<ExtArgs>>): Prisma__ForecastVerificationRunClient<$Result.GetResult<Prisma.$ForecastVerificationRunPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one ForecastVerificationRun.
     * @param {ForecastVerificationRunUpdateArgs} args - Arguments to update one ForecastVerificationRun.
     * @example
     * // Update one ForecastVerificationRun
     * const forecastVerificationRun = await prisma.forecastVerificationRun.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ForecastVerificationRunUpdateArgs>(args: SelectSubset<T, ForecastVerificationRunUpdateArgs<ExtArgs>>): Prisma__ForecastVerificationRunClient<$Result.GetResult<Prisma.$ForecastVerificationRunPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more ForecastVerificationRuns.
     * @param {ForecastVerificationRunDeleteManyArgs} args - Arguments to filter ForecastVerificationRuns to delete.
     * @example
     * // Delete a few ForecastVerificationRuns
     * const { count } = await prisma.forecastVerificationRun.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ForecastVerificationRunDeleteManyArgs>(args?: SelectSubset<T, ForecastVerificationRunDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ForecastVerificationRuns.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastVerificationRunUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ForecastVerificationRuns
     * const forecastVerificationRun = await prisma.forecastVerificationRun.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ForecastVerificationRunUpdateManyArgs>(args: SelectSubset<T, ForecastVerificationRunUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ForecastVerificationRuns and returns the data updated in the database.
     * @param {ForecastVerificationRunUpdateManyAndReturnArgs} args - Arguments to update many ForecastVerificationRuns.
     * @example
     * // Update many ForecastVerificationRuns
     * const forecastVerificationRun = await prisma.forecastVerificationRun.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more ForecastVerificationRuns and only return the `id`
     * const forecastVerificationRunWithIdOnly = await prisma.forecastVerificationRun.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ForecastVerificationRunUpdateManyAndReturnArgs>(args: SelectSubset<T, ForecastVerificationRunUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ForecastVerificationRunPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one ForecastVerificationRun.
     * @param {ForecastVerificationRunUpsertArgs} args - Arguments to update or create a ForecastVerificationRun.
     * @example
     * // Update or create a ForecastVerificationRun
     * const forecastVerificationRun = await prisma.forecastVerificationRun.upsert({
     *   create: {
     *     // ... data to create a ForecastVerificationRun
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ForecastVerificationRun we want to update
     *   }
     * })
     */
    upsert<T extends ForecastVerificationRunUpsertArgs>(args: SelectSubset<T, ForecastVerificationRunUpsertArgs<ExtArgs>>): Prisma__ForecastVerificationRunClient<$Result.GetResult<Prisma.$ForecastVerificationRunPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of ForecastVerificationRuns.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastVerificationRunCountArgs} args - Arguments to filter ForecastVerificationRuns to count.
     * @example
     * // Count the number of ForecastVerificationRuns
     * const count = await prisma.forecastVerificationRun.count({
     *   where: {
     *     // ... the filter for the ForecastVerificationRuns we want to count
     *   }
     * })
    **/
    count<T extends ForecastVerificationRunCountArgs>(
      args?: Subset<T, ForecastVerificationRunCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ForecastVerificationRunCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ForecastVerificationRun.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastVerificationRunAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ForecastVerificationRunAggregateArgs>(args: Subset<T, ForecastVerificationRunAggregateArgs>): Prisma.PrismaPromise<GetForecastVerificationRunAggregateType<T>>

    /**
     * Group by ForecastVerificationRun.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastVerificationRunGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ForecastVerificationRunGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ForecastVerificationRunGroupByArgs['orderBy'] }
        : { orderBy?: ForecastVerificationRunGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ForecastVerificationRunGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetForecastVerificationRunGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ForecastVerificationRun model
   */
  readonly fields: ForecastVerificationRunFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ForecastVerificationRun.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ForecastVerificationRunClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    metrics<T extends ForecastVerificationRun$metricsArgs<ExtArgs> = {}>(args?: Subset<T, ForecastVerificationRun$metricsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ForecastVerificationMetricPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    points<T extends ForecastVerificationRun$pointsArgs<ExtArgs> = {}>(args?: Subset<T, ForecastVerificationRun$pointsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ForecastVerificationPointPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ForecastVerificationRun model
   */
  interface ForecastVerificationRunFieldRefs {
    readonly id: FieldRef<"ForecastVerificationRun", 'String'>
    readonly seriesId: FieldRef<"ForecastVerificationRun", 'String'>
    readonly displayName: FieldRef<"ForecastVerificationRun", 'String'>
    readonly description: FieldRef<"ForecastVerificationRun", 'String'>
    readonly frequency: FieldRef<"ForecastVerificationRun", 'String'>
    readonly currency: FieldRef<"ForecastVerificationRun", 'String'>
    readonly unit: FieldRef<"ForecastVerificationRun", 'String'>
    readonly sourceLabel: FieldRef<"ForecastVerificationRun", 'String'>
    readonly inputSource: FieldRef<"ForecastVerificationRun", 'String'>
    readonly inputRunId: FieldRef<"ForecastVerificationRun", 'String'>
    readonly historyFingerprint: FieldRef<"ForecastVerificationRun", 'String'>
    readonly targetBasis: FieldRef<"ForecastVerificationRun", 'ForecastTargetBasis'>
    readonly methodId: FieldRef<"ForecastVerificationRun", 'String'>
    readonly historyStartAt: FieldRef<"ForecastVerificationRun", 'DateTime'>
    readonly historyEndAt: FieldRef<"ForecastVerificationRun", 'DateTime'>
    readonly observationCount: FieldRef<"ForecastVerificationRun", 'Int'>
    readonly forecastOriginAt: FieldRef<"ForecastVerificationRun", 'DateTime'>
    readonly modelId: FieldRef<"ForecastVerificationRun", 'String'>
    readonly methodVersion: FieldRef<"ForecastVerificationRun", 'String'>
    readonly status: FieldRef<"ForecastVerificationRun", 'String'>
    readonly failureReason: FieldRef<"ForecastVerificationRun", 'String'>
    readonly runtimeSeconds: FieldRef<"ForecastVerificationRun", 'Float'>
    readonly createdAt: FieldRef<"ForecastVerificationRun", 'DateTime'>
    readonly updatedAt: FieldRef<"ForecastVerificationRun", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ForecastVerificationRun findUnique
   */
  export type ForecastVerificationRunFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationRun
     */
    select?: ForecastVerificationRunSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationRun
     */
    omit?: ForecastVerificationRunOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationRunInclude<ExtArgs> | null
    /**
     * Filter, which ForecastVerificationRun to fetch.
     */
    where: ForecastVerificationRunWhereUniqueInput
  }

  /**
   * ForecastVerificationRun findUniqueOrThrow
   */
  export type ForecastVerificationRunFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationRun
     */
    select?: ForecastVerificationRunSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationRun
     */
    omit?: ForecastVerificationRunOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationRunInclude<ExtArgs> | null
    /**
     * Filter, which ForecastVerificationRun to fetch.
     */
    where: ForecastVerificationRunWhereUniqueInput
  }

  /**
   * ForecastVerificationRun findFirst
   */
  export type ForecastVerificationRunFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationRun
     */
    select?: ForecastVerificationRunSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationRun
     */
    omit?: ForecastVerificationRunOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationRunInclude<ExtArgs> | null
    /**
     * Filter, which ForecastVerificationRun to fetch.
     */
    where?: ForecastVerificationRunWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ForecastVerificationRuns to fetch.
     */
    orderBy?: ForecastVerificationRunOrderByWithRelationInput | ForecastVerificationRunOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ForecastVerificationRuns.
     */
    cursor?: ForecastVerificationRunWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ForecastVerificationRuns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ForecastVerificationRuns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ForecastVerificationRuns.
     */
    distinct?: ForecastVerificationRunScalarFieldEnum | ForecastVerificationRunScalarFieldEnum[]
  }

  /**
   * ForecastVerificationRun findFirstOrThrow
   */
  export type ForecastVerificationRunFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationRun
     */
    select?: ForecastVerificationRunSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationRun
     */
    omit?: ForecastVerificationRunOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationRunInclude<ExtArgs> | null
    /**
     * Filter, which ForecastVerificationRun to fetch.
     */
    where?: ForecastVerificationRunWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ForecastVerificationRuns to fetch.
     */
    orderBy?: ForecastVerificationRunOrderByWithRelationInput | ForecastVerificationRunOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ForecastVerificationRuns.
     */
    cursor?: ForecastVerificationRunWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ForecastVerificationRuns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ForecastVerificationRuns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ForecastVerificationRuns.
     */
    distinct?: ForecastVerificationRunScalarFieldEnum | ForecastVerificationRunScalarFieldEnum[]
  }

  /**
   * ForecastVerificationRun findMany
   */
  export type ForecastVerificationRunFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationRun
     */
    select?: ForecastVerificationRunSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationRun
     */
    omit?: ForecastVerificationRunOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationRunInclude<ExtArgs> | null
    /**
     * Filter, which ForecastVerificationRuns to fetch.
     */
    where?: ForecastVerificationRunWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ForecastVerificationRuns to fetch.
     */
    orderBy?: ForecastVerificationRunOrderByWithRelationInput | ForecastVerificationRunOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ForecastVerificationRuns.
     */
    cursor?: ForecastVerificationRunWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ForecastVerificationRuns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ForecastVerificationRuns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ForecastVerificationRuns.
     */
    distinct?: ForecastVerificationRunScalarFieldEnum | ForecastVerificationRunScalarFieldEnum[]
  }

  /**
   * ForecastVerificationRun create
   */
  export type ForecastVerificationRunCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationRun
     */
    select?: ForecastVerificationRunSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationRun
     */
    omit?: ForecastVerificationRunOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationRunInclude<ExtArgs> | null
    /**
     * The data needed to create a ForecastVerificationRun.
     */
    data: XOR<ForecastVerificationRunCreateInput, ForecastVerificationRunUncheckedCreateInput>
  }

  /**
   * ForecastVerificationRun createMany
   */
  export type ForecastVerificationRunCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ForecastVerificationRuns.
     */
    data: ForecastVerificationRunCreateManyInput | ForecastVerificationRunCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ForecastVerificationRun createManyAndReturn
   */
  export type ForecastVerificationRunCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationRun
     */
    select?: ForecastVerificationRunSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationRun
     */
    omit?: ForecastVerificationRunOmit<ExtArgs> | null
    /**
     * The data used to create many ForecastVerificationRuns.
     */
    data: ForecastVerificationRunCreateManyInput | ForecastVerificationRunCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ForecastVerificationRun update
   */
  export type ForecastVerificationRunUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationRun
     */
    select?: ForecastVerificationRunSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationRun
     */
    omit?: ForecastVerificationRunOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationRunInclude<ExtArgs> | null
    /**
     * The data needed to update a ForecastVerificationRun.
     */
    data: XOR<ForecastVerificationRunUpdateInput, ForecastVerificationRunUncheckedUpdateInput>
    /**
     * Choose, which ForecastVerificationRun to update.
     */
    where: ForecastVerificationRunWhereUniqueInput
  }

  /**
   * ForecastVerificationRun updateMany
   */
  export type ForecastVerificationRunUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ForecastVerificationRuns.
     */
    data: XOR<ForecastVerificationRunUpdateManyMutationInput, ForecastVerificationRunUncheckedUpdateManyInput>
    /**
     * Filter which ForecastVerificationRuns to update
     */
    where?: ForecastVerificationRunWhereInput
    /**
     * Limit how many ForecastVerificationRuns to update.
     */
    limit?: number
  }

  /**
   * ForecastVerificationRun updateManyAndReturn
   */
  export type ForecastVerificationRunUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationRun
     */
    select?: ForecastVerificationRunSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationRun
     */
    omit?: ForecastVerificationRunOmit<ExtArgs> | null
    /**
     * The data used to update ForecastVerificationRuns.
     */
    data: XOR<ForecastVerificationRunUpdateManyMutationInput, ForecastVerificationRunUncheckedUpdateManyInput>
    /**
     * Filter which ForecastVerificationRuns to update
     */
    where?: ForecastVerificationRunWhereInput
    /**
     * Limit how many ForecastVerificationRuns to update.
     */
    limit?: number
  }

  /**
   * ForecastVerificationRun upsert
   */
  export type ForecastVerificationRunUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationRun
     */
    select?: ForecastVerificationRunSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationRun
     */
    omit?: ForecastVerificationRunOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationRunInclude<ExtArgs> | null
    /**
     * The filter to search for the ForecastVerificationRun to update in case it exists.
     */
    where: ForecastVerificationRunWhereUniqueInput
    /**
     * In case the ForecastVerificationRun found by the `where` argument doesn't exist, create a new ForecastVerificationRun with this data.
     */
    create: XOR<ForecastVerificationRunCreateInput, ForecastVerificationRunUncheckedCreateInput>
    /**
     * In case the ForecastVerificationRun was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ForecastVerificationRunUpdateInput, ForecastVerificationRunUncheckedUpdateInput>
  }

  /**
   * ForecastVerificationRun delete
   */
  export type ForecastVerificationRunDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationRun
     */
    select?: ForecastVerificationRunSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationRun
     */
    omit?: ForecastVerificationRunOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationRunInclude<ExtArgs> | null
    /**
     * Filter which ForecastVerificationRun to delete.
     */
    where: ForecastVerificationRunWhereUniqueInput
  }

  /**
   * ForecastVerificationRun deleteMany
   */
  export type ForecastVerificationRunDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ForecastVerificationRuns to delete
     */
    where?: ForecastVerificationRunWhereInput
    /**
     * Limit how many ForecastVerificationRuns to delete.
     */
    limit?: number
  }

  /**
   * ForecastVerificationRun.metrics
   */
  export type ForecastVerificationRun$metricsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationMetric
     */
    select?: ForecastVerificationMetricSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationMetric
     */
    omit?: ForecastVerificationMetricOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationMetricInclude<ExtArgs> | null
    where?: ForecastVerificationMetricWhereInput
    orderBy?: ForecastVerificationMetricOrderByWithRelationInput | ForecastVerificationMetricOrderByWithRelationInput[]
    cursor?: ForecastVerificationMetricWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ForecastVerificationMetricScalarFieldEnum | ForecastVerificationMetricScalarFieldEnum[]
  }

  /**
   * ForecastVerificationRun.points
   */
  export type ForecastVerificationRun$pointsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationPoint
     */
    select?: ForecastVerificationPointSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationPoint
     */
    omit?: ForecastVerificationPointOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationPointInclude<ExtArgs> | null
    where?: ForecastVerificationPointWhereInput
    orderBy?: ForecastVerificationPointOrderByWithRelationInput | ForecastVerificationPointOrderByWithRelationInput[]
    cursor?: ForecastVerificationPointWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ForecastVerificationPointScalarFieldEnum | ForecastVerificationPointScalarFieldEnum[]
  }

  /**
   * ForecastVerificationRun without action
   */
  export type ForecastVerificationRunDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationRun
     */
    select?: ForecastVerificationRunSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationRun
     */
    omit?: ForecastVerificationRunOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationRunInclude<ExtArgs> | null
  }


  /**
   * Model ForecastVerificationMetric
   */

  export type AggregateForecastVerificationMetric = {
    _count: ForecastVerificationMetricCountAggregateOutputType | null
    _avg: ForecastVerificationMetricAvgAggregateOutputType | null
    _sum: ForecastVerificationMetricSumAggregateOutputType | null
    _min: ForecastVerificationMetricMinAggregateOutputType | null
    _max: ForecastVerificationMetricMaxAggregateOutputType | null
  }

  export type ForecastVerificationMetricAvgAggregateOutputType = {
    horizonSteps: number | null
    origins: number | null
    expectedOrigins: number | null
    failedOrigins: number | null
    coverage: number | null
    mae: number | null
    rmse: number | null
    mase: number | null
    smape: number | null
    directionalAccuracy: number | null
    bias: number | null
  }

  export type ForecastVerificationMetricSumAggregateOutputType = {
    horizonSteps: number | null
    origins: number | null
    expectedOrigins: number | null
    failedOrigins: number | null
    coverage: number | null
    mae: number | null
    rmse: number | null
    mase: number | null
    smape: number | null
    directionalAccuracy: number | null
    bias: number | null
  }

  export type ForecastVerificationMetricMinAggregateOutputType = {
    id: string | null
    runId: string | null
    horizonLabel: string | null
    horizonSteps: number | null
    origins: number | null
    expectedOrigins: number | null
    failedOrigins: number | null
    coverage: number | null
    mae: number | null
    rmse: number | null
    mase: number | null
    smape: number | null
    directionalAccuracy: number | null
    bias: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ForecastVerificationMetricMaxAggregateOutputType = {
    id: string | null
    runId: string | null
    horizonLabel: string | null
    horizonSteps: number | null
    origins: number | null
    expectedOrigins: number | null
    failedOrigins: number | null
    coverage: number | null
    mae: number | null
    rmse: number | null
    mase: number | null
    smape: number | null
    directionalAccuracy: number | null
    bias: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ForecastVerificationMetricCountAggregateOutputType = {
    id: number
    runId: number
    horizonLabel: number
    horizonSteps: number
    origins: number
    expectedOrigins: number
    failedOrigins: number
    coverage: number
    mae: number
    rmse: number
    mase: number
    smape: number
    directionalAccuracy: number
    bias: number
    failureSummaryJson: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type ForecastVerificationMetricAvgAggregateInputType = {
    horizonSteps?: true
    origins?: true
    expectedOrigins?: true
    failedOrigins?: true
    coverage?: true
    mae?: true
    rmse?: true
    mase?: true
    smape?: true
    directionalAccuracy?: true
    bias?: true
  }

  export type ForecastVerificationMetricSumAggregateInputType = {
    horizonSteps?: true
    origins?: true
    expectedOrigins?: true
    failedOrigins?: true
    coverage?: true
    mae?: true
    rmse?: true
    mase?: true
    smape?: true
    directionalAccuracy?: true
    bias?: true
  }

  export type ForecastVerificationMetricMinAggregateInputType = {
    id?: true
    runId?: true
    horizonLabel?: true
    horizonSteps?: true
    origins?: true
    expectedOrigins?: true
    failedOrigins?: true
    coverage?: true
    mae?: true
    rmse?: true
    mase?: true
    smape?: true
    directionalAccuracy?: true
    bias?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ForecastVerificationMetricMaxAggregateInputType = {
    id?: true
    runId?: true
    horizonLabel?: true
    horizonSteps?: true
    origins?: true
    expectedOrigins?: true
    failedOrigins?: true
    coverage?: true
    mae?: true
    rmse?: true
    mase?: true
    smape?: true
    directionalAccuracy?: true
    bias?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ForecastVerificationMetricCountAggregateInputType = {
    id?: true
    runId?: true
    horizonLabel?: true
    horizonSteps?: true
    origins?: true
    expectedOrigins?: true
    failedOrigins?: true
    coverage?: true
    mae?: true
    rmse?: true
    mase?: true
    smape?: true
    directionalAccuracy?: true
    bias?: true
    failureSummaryJson?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type ForecastVerificationMetricAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ForecastVerificationMetric to aggregate.
     */
    where?: ForecastVerificationMetricWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ForecastVerificationMetrics to fetch.
     */
    orderBy?: ForecastVerificationMetricOrderByWithRelationInput | ForecastVerificationMetricOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ForecastVerificationMetricWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ForecastVerificationMetrics from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ForecastVerificationMetrics.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ForecastVerificationMetrics
    **/
    _count?: true | ForecastVerificationMetricCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ForecastVerificationMetricAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ForecastVerificationMetricSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ForecastVerificationMetricMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ForecastVerificationMetricMaxAggregateInputType
  }

  export type GetForecastVerificationMetricAggregateType<T extends ForecastVerificationMetricAggregateArgs> = {
        [P in keyof T & keyof AggregateForecastVerificationMetric]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateForecastVerificationMetric[P]>
      : GetScalarType<T[P], AggregateForecastVerificationMetric[P]>
  }




  export type ForecastVerificationMetricGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ForecastVerificationMetricWhereInput
    orderBy?: ForecastVerificationMetricOrderByWithAggregationInput | ForecastVerificationMetricOrderByWithAggregationInput[]
    by: ForecastVerificationMetricScalarFieldEnum[] | ForecastVerificationMetricScalarFieldEnum
    having?: ForecastVerificationMetricScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ForecastVerificationMetricCountAggregateInputType | true
    _avg?: ForecastVerificationMetricAvgAggregateInputType
    _sum?: ForecastVerificationMetricSumAggregateInputType
    _min?: ForecastVerificationMetricMinAggregateInputType
    _max?: ForecastVerificationMetricMaxAggregateInputType
  }

  export type ForecastVerificationMetricGroupByOutputType = {
    id: string
    runId: string
    horizonLabel: string
    horizonSteps: number
    origins: number
    expectedOrigins: number
    failedOrigins: number
    coverage: number
    mae: number | null
    rmse: number | null
    mase: number | null
    smape: number | null
    directionalAccuracy: number | null
    bias: number | null
    failureSummaryJson: JsonValue | null
    createdAt: Date
    updatedAt: Date
    _count: ForecastVerificationMetricCountAggregateOutputType | null
    _avg: ForecastVerificationMetricAvgAggregateOutputType | null
    _sum: ForecastVerificationMetricSumAggregateOutputType | null
    _min: ForecastVerificationMetricMinAggregateOutputType | null
    _max: ForecastVerificationMetricMaxAggregateOutputType | null
  }

  type GetForecastVerificationMetricGroupByPayload<T extends ForecastVerificationMetricGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ForecastVerificationMetricGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ForecastVerificationMetricGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ForecastVerificationMetricGroupByOutputType[P]>
            : GetScalarType<T[P], ForecastVerificationMetricGroupByOutputType[P]>
        }
      >
    >


  export type ForecastVerificationMetricSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    runId?: boolean
    horizonLabel?: boolean
    horizonSteps?: boolean
    origins?: boolean
    expectedOrigins?: boolean
    failedOrigins?: boolean
    coverage?: boolean
    mae?: boolean
    rmse?: boolean
    mase?: boolean
    smape?: boolean
    directionalAccuracy?: boolean
    bias?: boolean
    failureSummaryJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    run?: boolean | ForecastVerificationRunDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["forecastVerificationMetric"]>

  export type ForecastVerificationMetricSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    runId?: boolean
    horizonLabel?: boolean
    horizonSteps?: boolean
    origins?: boolean
    expectedOrigins?: boolean
    failedOrigins?: boolean
    coverage?: boolean
    mae?: boolean
    rmse?: boolean
    mase?: boolean
    smape?: boolean
    directionalAccuracy?: boolean
    bias?: boolean
    failureSummaryJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    run?: boolean | ForecastVerificationRunDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["forecastVerificationMetric"]>

  export type ForecastVerificationMetricSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    runId?: boolean
    horizonLabel?: boolean
    horizonSteps?: boolean
    origins?: boolean
    expectedOrigins?: boolean
    failedOrigins?: boolean
    coverage?: boolean
    mae?: boolean
    rmse?: boolean
    mase?: boolean
    smape?: boolean
    directionalAccuracy?: boolean
    bias?: boolean
    failureSummaryJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    run?: boolean | ForecastVerificationRunDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["forecastVerificationMetric"]>

  export type ForecastVerificationMetricSelectScalar = {
    id?: boolean
    runId?: boolean
    horizonLabel?: boolean
    horizonSteps?: boolean
    origins?: boolean
    expectedOrigins?: boolean
    failedOrigins?: boolean
    coverage?: boolean
    mae?: boolean
    rmse?: boolean
    mase?: boolean
    smape?: boolean
    directionalAccuracy?: boolean
    bias?: boolean
    failureSummaryJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type ForecastVerificationMetricOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "runId" | "horizonLabel" | "horizonSteps" | "origins" | "expectedOrigins" | "failedOrigins" | "coverage" | "mae" | "rmse" | "mase" | "smape" | "directionalAccuracy" | "bias" | "failureSummaryJson" | "createdAt" | "updatedAt", ExtArgs["result"]["forecastVerificationMetric"]>
  export type ForecastVerificationMetricInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    run?: boolean | ForecastVerificationRunDefaultArgs<ExtArgs>
  }
  export type ForecastVerificationMetricIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    run?: boolean | ForecastVerificationRunDefaultArgs<ExtArgs>
  }
  export type ForecastVerificationMetricIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    run?: boolean | ForecastVerificationRunDefaultArgs<ExtArgs>
  }

  export type $ForecastVerificationMetricPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ForecastVerificationMetric"
    objects: {
      run: Prisma.$ForecastVerificationRunPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      runId: string
      horizonLabel: string
      horizonSteps: number
      origins: number
      expectedOrigins: number
      failedOrigins: number
      coverage: number
      mae: number | null
      rmse: number | null
      mase: number | null
      smape: number | null
      directionalAccuracy: number | null
      bias: number | null
      failureSummaryJson: Prisma.JsonValue | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["forecastVerificationMetric"]>
    composites: {}
  }

  type ForecastVerificationMetricGetPayload<S extends boolean | null | undefined | ForecastVerificationMetricDefaultArgs> = $Result.GetResult<Prisma.$ForecastVerificationMetricPayload, S>

  type ForecastVerificationMetricCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ForecastVerificationMetricFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ForecastVerificationMetricCountAggregateInputType | true
    }

  export interface ForecastVerificationMetricDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ForecastVerificationMetric'], meta: { name: 'ForecastVerificationMetric' } }
    /**
     * Find zero or one ForecastVerificationMetric that matches the filter.
     * @param {ForecastVerificationMetricFindUniqueArgs} args - Arguments to find a ForecastVerificationMetric
     * @example
     * // Get one ForecastVerificationMetric
     * const forecastVerificationMetric = await prisma.forecastVerificationMetric.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ForecastVerificationMetricFindUniqueArgs>(args: SelectSubset<T, ForecastVerificationMetricFindUniqueArgs<ExtArgs>>): Prisma__ForecastVerificationMetricClient<$Result.GetResult<Prisma.$ForecastVerificationMetricPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one ForecastVerificationMetric that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ForecastVerificationMetricFindUniqueOrThrowArgs} args - Arguments to find a ForecastVerificationMetric
     * @example
     * // Get one ForecastVerificationMetric
     * const forecastVerificationMetric = await prisma.forecastVerificationMetric.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ForecastVerificationMetricFindUniqueOrThrowArgs>(args: SelectSubset<T, ForecastVerificationMetricFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ForecastVerificationMetricClient<$Result.GetResult<Prisma.$ForecastVerificationMetricPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ForecastVerificationMetric that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastVerificationMetricFindFirstArgs} args - Arguments to find a ForecastVerificationMetric
     * @example
     * // Get one ForecastVerificationMetric
     * const forecastVerificationMetric = await prisma.forecastVerificationMetric.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ForecastVerificationMetricFindFirstArgs>(args?: SelectSubset<T, ForecastVerificationMetricFindFirstArgs<ExtArgs>>): Prisma__ForecastVerificationMetricClient<$Result.GetResult<Prisma.$ForecastVerificationMetricPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ForecastVerificationMetric that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastVerificationMetricFindFirstOrThrowArgs} args - Arguments to find a ForecastVerificationMetric
     * @example
     * // Get one ForecastVerificationMetric
     * const forecastVerificationMetric = await prisma.forecastVerificationMetric.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ForecastVerificationMetricFindFirstOrThrowArgs>(args?: SelectSubset<T, ForecastVerificationMetricFindFirstOrThrowArgs<ExtArgs>>): Prisma__ForecastVerificationMetricClient<$Result.GetResult<Prisma.$ForecastVerificationMetricPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more ForecastVerificationMetrics that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastVerificationMetricFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ForecastVerificationMetrics
     * const forecastVerificationMetrics = await prisma.forecastVerificationMetric.findMany()
     * 
     * // Get first 10 ForecastVerificationMetrics
     * const forecastVerificationMetrics = await prisma.forecastVerificationMetric.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const forecastVerificationMetricWithIdOnly = await prisma.forecastVerificationMetric.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ForecastVerificationMetricFindManyArgs>(args?: SelectSubset<T, ForecastVerificationMetricFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ForecastVerificationMetricPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a ForecastVerificationMetric.
     * @param {ForecastVerificationMetricCreateArgs} args - Arguments to create a ForecastVerificationMetric.
     * @example
     * // Create one ForecastVerificationMetric
     * const ForecastVerificationMetric = await prisma.forecastVerificationMetric.create({
     *   data: {
     *     // ... data to create a ForecastVerificationMetric
     *   }
     * })
     * 
     */
    create<T extends ForecastVerificationMetricCreateArgs>(args: SelectSubset<T, ForecastVerificationMetricCreateArgs<ExtArgs>>): Prisma__ForecastVerificationMetricClient<$Result.GetResult<Prisma.$ForecastVerificationMetricPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many ForecastVerificationMetrics.
     * @param {ForecastVerificationMetricCreateManyArgs} args - Arguments to create many ForecastVerificationMetrics.
     * @example
     * // Create many ForecastVerificationMetrics
     * const forecastVerificationMetric = await prisma.forecastVerificationMetric.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ForecastVerificationMetricCreateManyArgs>(args?: SelectSubset<T, ForecastVerificationMetricCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ForecastVerificationMetrics and returns the data saved in the database.
     * @param {ForecastVerificationMetricCreateManyAndReturnArgs} args - Arguments to create many ForecastVerificationMetrics.
     * @example
     * // Create many ForecastVerificationMetrics
     * const forecastVerificationMetric = await prisma.forecastVerificationMetric.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ForecastVerificationMetrics and only return the `id`
     * const forecastVerificationMetricWithIdOnly = await prisma.forecastVerificationMetric.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ForecastVerificationMetricCreateManyAndReturnArgs>(args?: SelectSubset<T, ForecastVerificationMetricCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ForecastVerificationMetricPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a ForecastVerificationMetric.
     * @param {ForecastVerificationMetricDeleteArgs} args - Arguments to delete one ForecastVerificationMetric.
     * @example
     * // Delete one ForecastVerificationMetric
     * const ForecastVerificationMetric = await prisma.forecastVerificationMetric.delete({
     *   where: {
     *     // ... filter to delete one ForecastVerificationMetric
     *   }
     * })
     * 
     */
    delete<T extends ForecastVerificationMetricDeleteArgs>(args: SelectSubset<T, ForecastVerificationMetricDeleteArgs<ExtArgs>>): Prisma__ForecastVerificationMetricClient<$Result.GetResult<Prisma.$ForecastVerificationMetricPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one ForecastVerificationMetric.
     * @param {ForecastVerificationMetricUpdateArgs} args - Arguments to update one ForecastVerificationMetric.
     * @example
     * // Update one ForecastVerificationMetric
     * const forecastVerificationMetric = await prisma.forecastVerificationMetric.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ForecastVerificationMetricUpdateArgs>(args: SelectSubset<T, ForecastVerificationMetricUpdateArgs<ExtArgs>>): Prisma__ForecastVerificationMetricClient<$Result.GetResult<Prisma.$ForecastVerificationMetricPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more ForecastVerificationMetrics.
     * @param {ForecastVerificationMetricDeleteManyArgs} args - Arguments to filter ForecastVerificationMetrics to delete.
     * @example
     * // Delete a few ForecastVerificationMetrics
     * const { count } = await prisma.forecastVerificationMetric.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ForecastVerificationMetricDeleteManyArgs>(args?: SelectSubset<T, ForecastVerificationMetricDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ForecastVerificationMetrics.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastVerificationMetricUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ForecastVerificationMetrics
     * const forecastVerificationMetric = await prisma.forecastVerificationMetric.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ForecastVerificationMetricUpdateManyArgs>(args: SelectSubset<T, ForecastVerificationMetricUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ForecastVerificationMetrics and returns the data updated in the database.
     * @param {ForecastVerificationMetricUpdateManyAndReturnArgs} args - Arguments to update many ForecastVerificationMetrics.
     * @example
     * // Update many ForecastVerificationMetrics
     * const forecastVerificationMetric = await prisma.forecastVerificationMetric.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more ForecastVerificationMetrics and only return the `id`
     * const forecastVerificationMetricWithIdOnly = await prisma.forecastVerificationMetric.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ForecastVerificationMetricUpdateManyAndReturnArgs>(args: SelectSubset<T, ForecastVerificationMetricUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ForecastVerificationMetricPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one ForecastVerificationMetric.
     * @param {ForecastVerificationMetricUpsertArgs} args - Arguments to update or create a ForecastVerificationMetric.
     * @example
     * // Update or create a ForecastVerificationMetric
     * const forecastVerificationMetric = await prisma.forecastVerificationMetric.upsert({
     *   create: {
     *     // ... data to create a ForecastVerificationMetric
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ForecastVerificationMetric we want to update
     *   }
     * })
     */
    upsert<T extends ForecastVerificationMetricUpsertArgs>(args: SelectSubset<T, ForecastVerificationMetricUpsertArgs<ExtArgs>>): Prisma__ForecastVerificationMetricClient<$Result.GetResult<Prisma.$ForecastVerificationMetricPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of ForecastVerificationMetrics.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastVerificationMetricCountArgs} args - Arguments to filter ForecastVerificationMetrics to count.
     * @example
     * // Count the number of ForecastVerificationMetrics
     * const count = await prisma.forecastVerificationMetric.count({
     *   where: {
     *     // ... the filter for the ForecastVerificationMetrics we want to count
     *   }
     * })
    **/
    count<T extends ForecastVerificationMetricCountArgs>(
      args?: Subset<T, ForecastVerificationMetricCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ForecastVerificationMetricCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ForecastVerificationMetric.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastVerificationMetricAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ForecastVerificationMetricAggregateArgs>(args: Subset<T, ForecastVerificationMetricAggregateArgs>): Prisma.PrismaPromise<GetForecastVerificationMetricAggregateType<T>>

    /**
     * Group by ForecastVerificationMetric.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastVerificationMetricGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ForecastVerificationMetricGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ForecastVerificationMetricGroupByArgs['orderBy'] }
        : { orderBy?: ForecastVerificationMetricGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ForecastVerificationMetricGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetForecastVerificationMetricGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ForecastVerificationMetric model
   */
  readonly fields: ForecastVerificationMetricFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ForecastVerificationMetric.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ForecastVerificationMetricClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    run<T extends ForecastVerificationRunDefaultArgs<ExtArgs> = {}>(args?: Subset<T, ForecastVerificationRunDefaultArgs<ExtArgs>>): Prisma__ForecastVerificationRunClient<$Result.GetResult<Prisma.$ForecastVerificationRunPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ForecastVerificationMetric model
   */
  interface ForecastVerificationMetricFieldRefs {
    readonly id: FieldRef<"ForecastVerificationMetric", 'String'>
    readonly runId: FieldRef<"ForecastVerificationMetric", 'String'>
    readonly horizonLabel: FieldRef<"ForecastVerificationMetric", 'String'>
    readonly horizonSteps: FieldRef<"ForecastVerificationMetric", 'Int'>
    readonly origins: FieldRef<"ForecastVerificationMetric", 'Int'>
    readonly expectedOrigins: FieldRef<"ForecastVerificationMetric", 'Int'>
    readonly failedOrigins: FieldRef<"ForecastVerificationMetric", 'Int'>
    readonly coverage: FieldRef<"ForecastVerificationMetric", 'Float'>
    readonly mae: FieldRef<"ForecastVerificationMetric", 'Float'>
    readonly rmse: FieldRef<"ForecastVerificationMetric", 'Float'>
    readonly mase: FieldRef<"ForecastVerificationMetric", 'Float'>
    readonly smape: FieldRef<"ForecastVerificationMetric", 'Float'>
    readonly directionalAccuracy: FieldRef<"ForecastVerificationMetric", 'Float'>
    readonly bias: FieldRef<"ForecastVerificationMetric", 'Float'>
    readonly failureSummaryJson: FieldRef<"ForecastVerificationMetric", 'Json'>
    readonly createdAt: FieldRef<"ForecastVerificationMetric", 'DateTime'>
    readonly updatedAt: FieldRef<"ForecastVerificationMetric", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ForecastVerificationMetric findUnique
   */
  export type ForecastVerificationMetricFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationMetric
     */
    select?: ForecastVerificationMetricSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationMetric
     */
    omit?: ForecastVerificationMetricOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationMetricInclude<ExtArgs> | null
    /**
     * Filter, which ForecastVerificationMetric to fetch.
     */
    where: ForecastVerificationMetricWhereUniqueInput
  }

  /**
   * ForecastVerificationMetric findUniqueOrThrow
   */
  export type ForecastVerificationMetricFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationMetric
     */
    select?: ForecastVerificationMetricSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationMetric
     */
    omit?: ForecastVerificationMetricOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationMetricInclude<ExtArgs> | null
    /**
     * Filter, which ForecastVerificationMetric to fetch.
     */
    where: ForecastVerificationMetricWhereUniqueInput
  }

  /**
   * ForecastVerificationMetric findFirst
   */
  export type ForecastVerificationMetricFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationMetric
     */
    select?: ForecastVerificationMetricSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationMetric
     */
    omit?: ForecastVerificationMetricOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationMetricInclude<ExtArgs> | null
    /**
     * Filter, which ForecastVerificationMetric to fetch.
     */
    where?: ForecastVerificationMetricWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ForecastVerificationMetrics to fetch.
     */
    orderBy?: ForecastVerificationMetricOrderByWithRelationInput | ForecastVerificationMetricOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ForecastVerificationMetrics.
     */
    cursor?: ForecastVerificationMetricWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ForecastVerificationMetrics from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ForecastVerificationMetrics.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ForecastVerificationMetrics.
     */
    distinct?: ForecastVerificationMetricScalarFieldEnum | ForecastVerificationMetricScalarFieldEnum[]
  }

  /**
   * ForecastVerificationMetric findFirstOrThrow
   */
  export type ForecastVerificationMetricFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationMetric
     */
    select?: ForecastVerificationMetricSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationMetric
     */
    omit?: ForecastVerificationMetricOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationMetricInclude<ExtArgs> | null
    /**
     * Filter, which ForecastVerificationMetric to fetch.
     */
    where?: ForecastVerificationMetricWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ForecastVerificationMetrics to fetch.
     */
    orderBy?: ForecastVerificationMetricOrderByWithRelationInput | ForecastVerificationMetricOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ForecastVerificationMetrics.
     */
    cursor?: ForecastVerificationMetricWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ForecastVerificationMetrics from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ForecastVerificationMetrics.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ForecastVerificationMetrics.
     */
    distinct?: ForecastVerificationMetricScalarFieldEnum | ForecastVerificationMetricScalarFieldEnum[]
  }

  /**
   * ForecastVerificationMetric findMany
   */
  export type ForecastVerificationMetricFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationMetric
     */
    select?: ForecastVerificationMetricSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationMetric
     */
    omit?: ForecastVerificationMetricOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationMetricInclude<ExtArgs> | null
    /**
     * Filter, which ForecastVerificationMetrics to fetch.
     */
    where?: ForecastVerificationMetricWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ForecastVerificationMetrics to fetch.
     */
    orderBy?: ForecastVerificationMetricOrderByWithRelationInput | ForecastVerificationMetricOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ForecastVerificationMetrics.
     */
    cursor?: ForecastVerificationMetricWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ForecastVerificationMetrics from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ForecastVerificationMetrics.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ForecastVerificationMetrics.
     */
    distinct?: ForecastVerificationMetricScalarFieldEnum | ForecastVerificationMetricScalarFieldEnum[]
  }

  /**
   * ForecastVerificationMetric create
   */
  export type ForecastVerificationMetricCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationMetric
     */
    select?: ForecastVerificationMetricSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationMetric
     */
    omit?: ForecastVerificationMetricOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationMetricInclude<ExtArgs> | null
    /**
     * The data needed to create a ForecastVerificationMetric.
     */
    data: XOR<ForecastVerificationMetricCreateInput, ForecastVerificationMetricUncheckedCreateInput>
  }

  /**
   * ForecastVerificationMetric createMany
   */
  export type ForecastVerificationMetricCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ForecastVerificationMetrics.
     */
    data: ForecastVerificationMetricCreateManyInput | ForecastVerificationMetricCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ForecastVerificationMetric createManyAndReturn
   */
  export type ForecastVerificationMetricCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationMetric
     */
    select?: ForecastVerificationMetricSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationMetric
     */
    omit?: ForecastVerificationMetricOmit<ExtArgs> | null
    /**
     * The data used to create many ForecastVerificationMetrics.
     */
    data: ForecastVerificationMetricCreateManyInput | ForecastVerificationMetricCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationMetricIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * ForecastVerificationMetric update
   */
  export type ForecastVerificationMetricUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationMetric
     */
    select?: ForecastVerificationMetricSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationMetric
     */
    omit?: ForecastVerificationMetricOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationMetricInclude<ExtArgs> | null
    /**
     * The data needed to update a ForecastVerificationMetric.
     */
    data: XOR<ForecastVerificationMetricUpdateInput, ForecastVerificationMetricUncheckedUpdateInput>
    /**
     * Choose, which ForecastVerificationMetric to update.
     */
    where: ForecastVerificationMetricWhereUniqueInput
  }

  /**
   * ForecastVerificationMetric updateMany
   */
  export type ForecastVerificationMetricUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ForecastVerificationMetrics.
     */
    data: XOR<ForecastVerificationMetricUpdateManyMutationInput, ForecastVerificationMetricUncheckedUpdateManyInput>
    /**
     * Filter which ForecastVerificationMetrics to update
     */
    where?: ForecastVerificationMetricWhereInput
    /**
     * Limit how many ForecastVerificationMetrics to update.
     */
    limit?: number
  }

  /**
   * ForecastVerificationMetric updateManyAndReturn
   */
  export type ForecastVerificationMetricUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationMetric
     */
    select?: ForecastVerificationMetricSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationMetric
     */
    omit?: ForecastVerificationMetricOmit<ExtArgs> | null
    /**
     * The data used to update ForecastVerificationMetrics.
     */
    data: XOR<ForecastVerificationMetricUpdateManyMutationInput, ForecastVerificationMetricUncheckedUpdateManyInput>
    /**
     * Filter which ForecastVerificationMetrics to update
     */
    where?: ForecastVerificationMetricWhereInput
    /**
     * Limit how many ForecastVerificationMetrics to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationMetricIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * ForecastVerificationMetric upsert
   */
  export type ForecastVerificationMetricUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationMetric
     */
    select?: ForecastVerificationMetricSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationMetric
     */
    omit?: ForecastVerificationMetricOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationMetricInclude<ExtArgs> | null
    /**
     * The filter to search for the ForecastVerificationMetric to update in case it exists.
     */
    where: ForecastVerificationMetricWhereUniqueInput
    /**
     * In case the ForecastVerificationMetric found by the `where` argument doesn't exist, create a new ForecastVerificationMetric with this data.
     */
    create: XOR<ForecastVerificationMetricCreateInput, ForecastVerificationMetricUncheckedCreateInput>
    /**
     * In case the ForecastVerificationMetric was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ForecastVerificationMetricUpdateInput, ForecastVerificationMetricUncheckedUpdateInput>
  }

  /**
   * ForecastVerificationMetric delete
   */
  export type ForecastVerificationMetricDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationMetric
     */
    select?: ForecastVerificationMetricSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationMetric
     */
    omit?: ForecastVerificationMetricOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationMetricInclude<ExtArgs> | null
    /**
     * Filter which ForecastVerificationMetric to delete.
     */
    where: ForecastVerificationMetricWhereUniqueInput
  }

  /**
   * ForecastVerificationMetric deleteMany
   */
  export type ForecastVerificationMetricDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ForecastVerificationMetrics to delete
     */
    where?: ForecastVerificationMetricWhereInput
    /**
     * Limit how many ForecastVerificationMetrics to delete.
     */
    limit?: number
  }

  /**
   * ForecastVerificationMetric without action
   */
  export type ForecastVerificationMetricDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationMetric
     */
    select?: ForecastVerificationMetricSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationMetric
     */
    omit?: ForecastVerificationMetricOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationMetricInclude<ExtArgs> | null
  }


  /**
   * Model ForecastVerificationPoint
   */

  export type AggregateForecastVerificationPoint = {
    _count: ForecastVerificationPointCountAggregateOutputType | null
    _avg: ForecastVerificationPointAvgAggregateOutputType | null
    _sum: ForecastVerificationPointSumAggregateOutputType | null
    _min: ForecastVerificationPointMinAggregateOutputType | null
    _max: ForecastVerificationPointMaxAggregateOutputType | null
  }

  export type ForecastVerificationPointAvgAggregateOutputType = {
    horizonSteps: number | null
    originValue: Decimal | null
    forecastValue: Decimal | null
    actualValue: Decimal | null
    errorValue: Decimal | null
    absoluteErrorValue: Decimal | null
    deltaValue: Decimal | null
    deltaPct: number | null
    maseScale: Decimal | null
    selectionScore: number | null
  }

  export type ForecastVerificationPointSumAggregateOutputType = {
    horizonSteps: number | null
    originValue: Decimal | null
    forecastValue: Decimal | null
    actualValue: Decimal | null
    errorValue: Decimal | null
    absoluteErrorValue: Decimal | null
    deltaValue: Decimal | null
    deltaPct: number | null
    maseScale: Decimal | null
    selectionScore: number | null
  }

  export type ForecastVerificationPointMinAggregateOutputType = {
    id: string | null
    runId: string | null
    horizonLabel: string | null
    horizonSteps: number | null
    forecastOriginAt: Date | null
    targetDate: Date | null
    actualObservedAt: Date | null
    originValue: Decimal | null
    forecastValue: Decimal | null
    actualValue: Decimal | null
    errorValue: Decimal | null
    absoluteErrorValue: Decimal | null
    deltaValue: Decimal | null
    deltaPct: number | null
    maseScale: Decimal | null
    selectedVariant: string | null
    selectionMetric: string | null
    selectionScore: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ForecastVerificationPointMaxAggregateOutputType = {
    id: string | null
    runId: string | null
    horizonLabel: string | null
    horizonSteps: number | null
    forecastOriginAt: Date | null
    targetDate: Date | null
    actualObservedAt: Date | null
    originValue: Decimal | null
    forecastValue: Decimal | null
    actualValue: Decimal | null
    errorValue: Decimal | null
    absoluteErrorValue: Decimal | null
    deltaValue: Decimal | null
    deltaPct: number | null
    maseScale: Decimal | null
    selectedVariant: string | null
    selectionMetric: string | null
    selectionScore: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ForecastVerificationPointCountAggregateOutputType = {
    id: number
    runId: number
    horizonLabel: number
    horizonSteps: number
    forecastOriginAt: number
    targetDate: number
    actualObservedAt: number
    originValue: number
    forecastValue: number
    actualValue: number
    errorValue: number
    absoluteErrorValue: number
    deltaValue: number
    deltaPct: number
    maseScale: number
    selectedVariant: number
    selectionMetric: number
    selectionScore: number
    metadataJson: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type ForecastVerificationPointAvgAggregateInputType = {
    horizonSteps?: true
    originValue?: true
    forecastValue?: true
    actualValue?: true
    errorValue?: true
    absoluteErrorValue?: true
    deltaValue?: true
    deltaPct?: true
    maseScale?: true
    selectionScore?: true
  }

  export type ForecastVerificationPointSumAggregateInputType = {
    horizonSteps?: true
    originValue?: true
    forecastValue?: true
    actualValue?: true
    errorValue?: true
    absoluteErrorValue?: true
    deltaValue?: true
    deltaPct?: true
    maseScale?: true
    selectionScore?: true
  }

  export type ForecastVerificationPointMinAggregateInputType = {
    id?: true
    runId?: true
    horizonLabel?: true
    horizonSteps?: true
    forecastOriginAt?: true
    targetDate?: true
    actualObservedAt?: true
    originValue?: true
    forecastValue?: true
    actualValue?: true
    errorValue?: true
    absoluteErrorValue?: true
    deltaValue?: true
    deltaPct?: true
    maseScale?: true
    selectedVariant?: true
    selectionMetric?: true
    selectionScore?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ForecastVerificationPointMaxAggregateInputType = {
    id?: true
    runId?: true
    horizonLabel?: true
    horizonSteps?: true
    forecastOriginAt?: true
    targetDate?: true
    actualObservedAt?: true
    originValue?: true
    forecastValue?: true
    actualValue?: true
    errorValue?: true
    absoluteErrorValue?: true
    deltaValue?: true
    deltaPct?: true
    maseScale?: true
    selectedVariant?: true
    selectionMetric?: true
    selectionScore?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ForecastVerificationPointCountAggregateInputType = {
    id?: true
    runId?: true
    horizonLabel?: true
    horizonSteps?: true
    forecastOriginAt?: true
    targetDate?: true
    actualObservedAt?: true
    originValue?: true
    forecastValue?: true
    actualValue?: true
    errorValue?: true
    absoluteErrorValue?: true
    deltaValue?: true
    deltaPct?: true
    maseScale?: true
    selectedVariant?: true
    selectionMetric?: true
    selectionScore?: true
    metadataJson?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type ForecastVerificationPointAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ForecastVerificationPoint to aggregate.
     */
    where?: ForecastVerificationPointWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ForecastVerificationPoints to fetch.
     */
    orderBy?: ForecastVerificationPointOrderByWithRelationInput | ForecastVerificationPointOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ForecastVerificationPointWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ForecastVerificationPoints from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ForecastVerificationPoints.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ForecastVerificationPoints
    **/
    _count?: true | ForecastVerificationPointCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ForecastVerificationPointAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ForecastVerificationPointSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ForecastVerificationPointMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ForecastVerificationPointMaxAggregateInputType
  }

  export type GetForecastVerificationPointAggregateType<T extends ForecastVerificationPointAggregateArgs> = {
        [P in keyof T & keyof AggregateForecastVerificationPoint]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateForecastVerificationPoint[P]>
      : GetScalarType<T[P], AggregateForecastVerificationPoint[P]>
  }




  export type ForecastVerificationPointGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ForecastVerificationPointWhereInput
    orderBy?: ForecastVerificationPointOrderByWithAggregationInput | ForecastVerificationPointOrderByWithAggregationInput[]
    by: ForecastVerificationPointScalarFieldEnum[] | ForecastVerificationPointScalarFieldEnum
    having?: ForecastVerificationPointScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ForecastVerificationPointCountAggregateInputType | true
    _avg?: ForecastVerificationPointAvgAggregateInputType
    _sum?: ForecastVerificationPointSumAggregateInputType
    _min?: ForecastVerificationPointMinAggregateInputType
    _max?: ForecastVerificationPointMaxAggregateInputType
  }

  export type ForecastVerificationPointGroupByOutputType = {
    id: string
    runId: string
    horizonLabel: string
    horizonSteps: number
    forecastOriginAt: Date
    targetDate: Date
    actualObservedAt: Date | null
    originValue: Decimal
    forecastValue: Decimal
    actualValue: Decimal
    errorValue: Decimal
    absoluteErrorValue: Decimal
    deltaValue: Decimal
    deltaPct: number | null
    maseScale: Decimal
    selectedVariant: string | null
    selectionMetric: string | null
    selectionScore: number | null
    metadataJson: JsonValue | null
    createdAt: Date
    updatedAt: Date
    _count: ForecastVerificationPointCountAggregateOutputType | null
    _avg: ForecastVerificationPointAvgAggregateOutputType | null
    _sum: ForecastVerificationPointSumAggregateOutputType | null
    _min: ForecastVerificationPointMinAggregateOutputType | null
    _max: ForecastVerificationPointMaxAggregateOutputType | null
  }

  type GetForecastVerificationPointGroupByPayload<T extends ForecastVerificationPointGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ForecastVerificationPointGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ForecastVerificationPointGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ForecastVerificationPointGroupByOutputType[P]>
            : GetScalarType<T[P], ForecastVerificationPointGroupByOutputType[P]>
        }
      >
    >


  export type ForecastVerificationPointSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    runId?: boolean
    horizonLabel?: boolean
    horizonSteps?: boolean
    forecastOriginAt?: boolean
    targetDate?: boolean
    actualObservedAt?: boolean
    originValue?: boolean
    forecastValue?: boolean
    actualValue?: boolean
    errorValue?: boolean
    absoluteErrorValue?: boolean
    deltaValue?: boolean
    deltaPct?: boolean
    maseScale?: boolean
    selectedVariant?: boolean
    selectionMetric?: boolean
    selectionScore?: boolean
    metadataJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    run?: boolean | ForecastVerificationRunDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["forecastVerificationPoint"]>

  export type ForecastVerificationPointSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    runId?: boolean
    horizonLabel?: boolean
    horizonSteps?: boolean
    forecastOriginAt?: boolean
    targetDate?: boolean
    actualObservedAt?: boolean
    originValue?: boolean
    forecastValue?: boolean
    actualValue?: boolean
    errorValue?: boolean
    absoluteErrorValue?: boolean
    deltaValue?: boolean
    deltaPct?: boolean
    maseScale?: boolean
    selectedVariant?: boolean
    selectionMetric?: boolean
    selectionScore?: boolean
    metadataJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    run?: boolean | ForecastVerificationRunDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["forecastVerificationPoint"]>

  export type ForecastVerificationPointSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    runId?: boolean
    horizonLabel?: boolean
    horizonSteps?: boolean
    forecastOriginAt?: boolean
    targetDate?: boolean
    actualObservedAt?: boolean
    originValue?: boolean
    forecastValue?: boolean
    actualValue?: boolean
    errorValue?: boolean
    absoluteErrorValue?: boolean
    deltaValue?: boolean
    deltaPct?: boolean
    maseScale?: boolean
    selectedVariant?: boolean
    selectionMetric?: boolean
    selectionScore?: boolean
    metadataJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    run?: boolean | ForecastVerificationRunDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["forecastVerificationPoint"]>

  export type ForecastVerificationPointSelectScalar = {
    id?: boolean
    runId?: boolean
    horizonLabel?: boolean
    horizonSteps?: boolean
    forecastOriginAt?: boolean
    targetDate?: boolean
    actualObservedAt?: boolean
    originValue?: boolean
    forecastValue?: boolean
    actualValue?: boolean
    errorValue?: boolean
    absoluteErrorValue?: boolean
    deltaValue?: boolean
    deltaPct?: boolean
    maseScale?: boolean
    selectedVariant?: boolean
    selectionMetric?: boolean
    selectionScore?: boolean
    metadataJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type ForecastVerificationPointOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "runId" | "horizonLabel" | "horizonSteps" | "forecastOriginAt" | "targetDate" | "actualObservedAt" | "originValue" | "forecastValue" | "actualValue" | "errorValue" | "absoluteErrorValue" | "deltaValue" | "deltaPct" | "maseScale" | "selectedVariant" | "selectionMetric" | "selectionScore" | "metadataJson" | "createdAt" | "updatedAt", ExtArgs["result"]["forecastVerificationPoint"]>
  export type ForecastVerificationPointInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    run?: boolean | ForecastVerificationRunDefaultArgs<ExtArgs>
  }
  export type ForecastVerificationPointIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    run?: boolean | ForecastVerificationRunDefaultArgs<ExtArgs>
  }
  export type ForecastVerificationPointIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    run?: boolean | ForecastVerificationRunDefaultArgs<ExtArgs>
  }

  export type $ForecastVerificationPointPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ForecastVerificationPoint"
    objects: {
      run: Prisma.$ForecastVerificationRunPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      runId: string
      horizonLabel: string
      horizonSteps: number
      forecastOriginAt: Date
      targetDate: Date
      actualObservedAt: Date | null
      originValue: Prisma.Decimal
      forecastValue: Prisma.Decimal
      actualValue: Prisma.Decimal
      errorValue: Prisma.Decimal
      absoluteErrorValue: Prisma.Decimal
      deltaValue: Prisma.Decimal
      deltaPct: number | null
      maseScale: Prisma.Decimal
      selectedVariant: string | null
      selectionMetric: string | null
      selectionScore: number | null
      metadataJson: Prisma.JsonValue | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["forecastVerificationPoint"]>
    composites: {}
  }

  type ForecastVerificationPointGetPayload<S extends boolean | null | undefined | ForecastVerificationPointDefaultArgs> = $Result.GetResult<Prisma.$ForecastVerificationPointPayload, S>

  type ForecastVerificationPointCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ForecastVerificationPointFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ForecastVerificationPointCountAggregateInputType | true
    }

  export interface ForecastVerificationPointDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ForecastVerificationPoint'], meta: { name: 'ForecastVerificationPoint' } }
    /**
     * Find zero or one ForecastVerificationPoint that matches the filter.
     * @param {ForecastVerificationPointFindUniqueArgs} args - Arguments to find a ForecastVerificationPoint
     * @example
     * // Get one ForecastVerificationPoint
     * const forecastVerificationPoint = await prisma.forecastVerificationPoint.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ForecastVerificationPointFindUniqueArgs>(args: SelectSubset<T, ForecastVerificationPointFindUniqueArgs<ExtArgs>>): Prisma__ForecastVerificationPointClient<$Result.GetResult<Prisma.$ForecastVerificationPointPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one ForecastVerificationPoint that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ForecastVerificationPointFindUniqueOrThrowArgs} args - Arguments to find a ForecastVerificationPoint
     * @example
     * // Get one ForecastVerificationPoint
     * const forecastVerificationPoint = await prisma.forecastVerificationPoint.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ForecastVerificationPointFindUniqueOrThrowArgs>(args: SelectSubset<T, ForecastVerificationPointFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ForecastVerificationPointClient<$Result.GetResult<Prisma.$ForecastVerificationPointPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ForecastVerificationPoint that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastVerificationPointFindFirstArgs} args - Arguments to find a ForecastVerificationPoint
     * @example
     * // Get one ForecastVerificationPoint
     * const forecastVerificationPoint = await prisma.forecastVerificationPoint.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ForecastVerificationPointFindFirstArgs>(args?: SelectSubset<T, ForecastVerificationPointFindFirstArgs<ExtArgs>>): Prisma__ForecastVerificationPointClient<$Result.GetResult<Prisma.$ForecastVerificationPointPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ForecastVerificationPoint that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastVerificationPointFindFirstOrThrowArgs} args - Arguments to find a ForecastVerificationPoint
     * @example
     * // Get one ForecastVerificationPoint
     * const forecastVerificationPoint = await prisma.forecastVerificationPoint.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ForecastVerificationPointFindFirstOrThrowArgs>(args?: SelectSubset<T, ForecastVerificationPointFindFirstOrThrowArgs<ExtArgs>>): Prisma__ForecastVerificationPointClient<$Result.GetResult<Prisma.$ForecastVerificationPointPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more ForecastVerificationPoints that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastVerificationPointFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ForecastVerificationPoints
     * const forecastVerificationPoints = await prisma.forecastVerificationPoint.findMany()
     * 
     * // Get first 10 ForecastVerificationPoints
     * const forecastVerificationPoints = await prisma.forecastVerificationPoint.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const forecastVerificationPointWithIdOnly = await prisma.forecastVerificationPoint.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ForecastVerificationPointFindManyArgs>(args?: SelectSubset<T, ForecastVerificationPointFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ForecastVerificationPointPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a ForecastVerificationPoint.
     * @param {ForecastVerificationPointCreateArgs} args - Arguments to create a ForecastVerificationPoint.
     * @example
     * // Create one ForecastVerificationPoint
     * const ForecastVerificationPoint = await prisma.forecastVerificationPoint.create({
     *   data: {
     *     // ... data to create a ForecastVerificationPoint
     *   }
     * })
     * 
     */
    create<T extends ForecastVerificationPointCreateArgs>(args: SelectSubset<T, ForecastVerificationPointCreateArgs<ExtArgs>>): Prisma__ForecastVerificationPointClient<$Result.GetResult<Prisma.$ForecastVerificationPointPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many ForecastVerificationPoints.
     * @param {ForecastVerificationPointCreateManyArgs} args - Arguments to create many ForecastVerificationPoints.
     * @example
     * // Create many ForecastVerificationPoints
     * const forecastVerificationPoint = await prisma.forecastVerificationPoint.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ForecastVerificationPointCreateManyArgs>(args?: SelectSubset<T, ForecastVerificationPointCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ForecastVerificationPoints and returns the data saved in the database.
     * @param {ForecastVerificationPointCreateManyAndReturnArgs} args - Arguments to create many ForecastVerificationPoints.
     * @example
     * // Create many ForecastVerificationPoints
     * const forecastVerificationPoint = await prisma.forecastVerificationPoint.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ForecastVerificationPoints and only return the `id`
     * const forecastVerificationPointWithIdOnly = await prisma.forecastVerificationPoint.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ForecastVerificationPointCreateManyAndReturnArgs>(args?: SelectSubset<T, ForecastVerificationPointCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ForecastVerificationPointPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a ForecastVerificationPoint.
     * @param {ForecastVerificationPointDeleteArgs} args - Arguments to delete one ForecastVerificationPoint.
     * @example
     * // Delete one ForecastVerificationPoint
     * const ForecastVerificationPoint = await prisma.forecastVerificationPoint.delete({
     *   where: {
     *     // ... filter to delete one ForecastVerificationPoint
     *   }
     * })
     * 
     */
    delete<T extends ForecastVerificationPointDeleteArgs>(args: SelectSubset<T, ForecastVerificationPointDeleteArgs<ExtArgs>>): Prisma__ForecastVerificationPointClient<$Result.GetResult<Prisma.$ForecastVerificationPointPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one ForecastVerificationPoint.
     * @param {ForecastVerificationPointUpdateArgs} args - Arguments to update one ForecastVerificationPoint.
     * @example
     * // Update one ForecastVerificationPoint
     * const forecastVerificationPoint = await prisma.forecastVerificationPoint.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ForecastVerificationPointUpdateArgs>(args: SelectSubset<T, ForecastVerificationPointUpdateArgs<ExtArgs>>): Prisma__ForecastVerificationPointClient<$Result.GetResult<Prisma.$ForecastVerificationPointPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more ForecastVerificationPoints.
     * @param {ForecastVerificationPointDeleteManyArgs} args - Arguments to filter ForecastVerificationPoints to delete.
     * @example
     * // Delete a few ForecastVerificationPoints
     * const { count } = await prisma.forecastVerificationPoint.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ForecastVerificationPointDeleteManyArgs>(args?: SelectSubset<T, ForecastVerificationPointDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ForecastVerificationPoints.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastVerificationPointUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ForecastVerificationPoints
     * const forecastVerificationPoint = await prisma.forecastVerificationPoint.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ForecastVerificationPointUpdateManyArgs>(args: SelectSubset<T, ForecastVerificationPointUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ForecastVerificationPoints and returns the data updated in the database.
     * @param {ForecastVerificationPointUpdateManyAndReturnArgs} args - Arguments to update many ForecastVerificationPoints.
     * @example
     * // Update many ForecastVerificationPoints
     * const forecastVerificationPoint = await prisma.forecastVerificationPoint.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more ForecastVerificationPoints and only return the `id`
     * const forecastVerificationPointWithIdOnly = await prisma.forecastVerificationPoint.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ForecastVerificationPointUpdateManyAndReturnArgs>(args: SelectSubset<T, ForecastVerificationPointUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ForecastVerificationPointPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one ForecastVerificationPoint.
     * @param {ForecastVerificationPointUpsertArgs} args - Arguments to update or create a ForecastVerificationPoint.
     * @example
     * // Update or create a ForecastVerificationPoint
     * const forecastVerificationPoint = await prisma.forecastVerificationPoint.upsert({
     *   create: {
     *     // ... data to create a ForecastVerificationPoint
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ForecastVerificationPoint we want to update
     *   }
     * })
     */
    upsert<T extends ForecastVerificationPointUpsertArgs>(args: SelectSubset<T, ForecastVerificationPointUpsertArgs<ExtArgs>>): Prisma__ForecastVerificationPointClient<$Result.GetResult<Prisma.$ForecastVerificationPointPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of ForecastVerificationPoints.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastVerificationPointCountArgs} args - Arguments to filter ForecastVerificationPoints to count.
     * @example
     * // Count the number of ForecastVerificationPoints
     * const count = await prisma.forecastVerificationPoint.count({
     *   where: {
     *     // ... the filter for the ForecastVerificationPoints we want to count
     *   }
     * })
    **/
    count<T extends ForecastVerificationPointCountArgs>(
      args?: Subset<T, ForecastVerificationPointCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ForecastVerificationPointCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ForecastVerificationPoint.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastVerificationPointAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ForecastVerificationPointAggregateArgs>(args: Subset<T, ForecastVerificationPointAggregateArgs>): Prisma.PrismaPromise<GetForecastVerificationPointAggregateType<T>>

    /**
     * Group by ForecastVerificationPoint.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ForecastVerificationPointGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ForecastVerificationPointGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ForecastVerificationPointGroupByArgs['orderBy'] }
        : { orderBy?: ForecastVerificationPointGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ForecastVerificationPointGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetForecastVerificationPointGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ForecastVerificationPoint model
   */
  readonly fields: ForecastVerificationPointFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ForecastVerificationPoint.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ForecastVerificationPointClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    run<T extends ForecastVerificationRunDefaultArgs<ExtArgs> = {}>(args?: Subset<T, ForecastVerificationRunDefaultArgs<ExtArgs>>): Prisma__ForecastVerificationRunClient<$Result.GetResult<Prisma.$ForecastVerificationRunPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ForecastVerificationPoint model
   */
  interface ForecastVerificationPointFieldRefs {
    readonly id: FieldRef<"ForecastVerificationPoint", 'String'>
    readonly runId: FieldRef<"ForecastVerificationPoint", 'String'>
    readonly horizonLabel: FieldRef<"ForecastVerificationPoint", 'String'>
    readonly horizonSteps: FieldRef<"ForecastVerificationPoint", 'Int'>
    readonly forecastOriginAt: FieldRef<"ForecastVerificationPoint", 'DateTime'>
    readonly targetDate: FieldRef<"ForecastVerificationPoint", 'DateTime'>
    readonly actualObservedAt: FieldRef<"ForecastVerificationPoint", 'DateTime'>
    readonly originValue: FieldRef<"ForecastVerificationPoint", 'Decimal'>
    readonly forecastValue: FieldRef<"ForecastVerificationPoint", 'Decimal'>
    readonly actualValue: FieldRef<"ForecastVerificationPoint", 'Decimal'>
    readonly errorValue: FieldRef<"ForecastVerificationPoint", 'Decimal'>
    readonly absoluteErrorValue: FieldRef<"ForecastVerificationPoint", 'Decimal'>
    readonly deltaValue: FieldRef<"ForecastVerificationPoint", 'Decimal'>
    readonly deltaPct: FieldRef<"ForecastVerificationPoint", 'Float'>
    readonly maseScale: FieldRef<"ForecastVerificationPoint", 'Decimal'>
    readonly selectedVariant: FieldRef<"ForecastVerificationPoint", 'String'>
    readonly selectionMetric: FieldRef<"ForecastVerificationPoint", 'String'>
    readonly selectionScore: FieldRef<"ForecastVerificationPoint", 'Float'>
    readonly metadataJson: FieldRef<"ForecastVerificationPoint", 'Json'>
    readonly createdAt: FieldRef<"ForecastVerificationPoint", 'DateTime'>
    readonly updatedAt: FieldRef<"ForecastVerificationPoint", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ForecastVerificationPoint findUnique
   */
  export type ForecastVerificationPointFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationPoint
     */
    select?: ForecastVerificationPointSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationPoint
     */
    omit?: ForecastVerificationPointOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationPointInclude<ExtArgs> | null
    /**
     * Filter, which ForecastVerificationPoint to fetch.
     */
    where: ForecastVerificationPointWhereUniqueInput
  }

  /**
   * ForecastVerificationPoint findUniqueOrThrow
   */
  export type ForecastVerificationPointFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationPoint
     */
    select?: ForecastVerificationPointSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationPoint
     */
    omit?: ForecastVerificationPointOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationPointInclude<ExtArgs> | null
    /**
     * Filter, which ForecastVerificationPoint to fetch.
     */
    where: ForecastVerificationPointWhereUniqueInput
  }

  /**
   * ForecastVerificationPoint findFirst
   */
  export type ForecastVerificationPointFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationPoint
     */
    select?: ForecastVerificationPointSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationPoint
     */
    omit?: ForecastVerificationPointOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationPointInclude<ExtArgs> | null
    /**
     * Filter, which ForecastVerificationPoint to fetch.
     */
    where?: ForecastVerificationPointWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ForecastVerificationPoints to fetch.
     */
    orderBy?: ForecastVerificationPointOrderByWithRelationInput | ForecastVerificationPointOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ForecastVerificationPoints.
     */
    cursor?: ForecastVerificationPointWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ForecastVerificationPoints from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ForecastVerificationPoints.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ForecastVerificationPoints.
     */
    distinct?: ForecastVerificationPointScalarFieldEnum | ForecastVerificationPointScalarFieldEnum[]
  }

  /**
   * ForecastVerificationPoint findFirstOrThrow
   */
  export type ForecastVerificationPointFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationPoint
     */
    select?: ForecastVerificationPointSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationPoint
     */
    omit?: ForecastVerificationPointOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationPointInclude<ExtArgs> | null
    /**
     * Filter, which ForecastVerificationPoint to fetch.
     */
    where?: ForecastVerificationPointWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ForecastVerificationPoints to fetch.
     */
    orderBy?: ForecastVerificationPointOrderByWithRelationInput | ForecastVerificationPointOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ForecastVerificationPoints.
     */
    cursor?: ForecastVerificationPointWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ForecastVerificationPoints from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ForecastVerificationPoints.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ForecastVerificationPoints.
     */
    distinct?: ForecastVerificationPointScalarFieldEnum | ForecastVerificationPointScalarFieldEnum[]
  }

  /**
   * ForecastVerificationPoint findMany
   */
  export type ForecastVerificationPointFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationPoint
     */
    select?: ForecastVerificationPointSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationPoint
     */
    omit?: ForecastVerificationPointOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationPointInclude<ExtArgs> | null
    /**
     * Filter, which ForecastVerificationPoints to fetch.
     */
    where?: ForecastVerificationPointWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ForecastVerificationPoints to fetch.
     */
    orderBy?: ForecastVerificationPointOrderByWithRelationInput | ForecastVerificationPointOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ForecastVerificationPoints.
     */
    cursor?: ForecastVerificationPointWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ForecastVerificationPoints from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ForecastVerificationPoints.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ForecastVerificationPoints.
     */
    distinct?: ForecastVerificationPointScalarFieldEnum | ForecastVerificationPointScalarFieldEnum[]
  }

  /**
   * ForecastVerificationPoint create
   */
  export type ForecastVerificationPointCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationPoint
     */
    select?: ForecastVerificationPointSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationPoint
     */
    omit?: ForecastVerificationPointOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationPointInclude<ExtArgs> | null
    /**
     * The data needed to create a ForecastVerificationPoint.
     */
    data: XOR<ForecastVerificationPointCreateInput, ForecastVerificationPointUncheckedCreateInput>
  }

  /**
   * ForecastVerificationPoint createMany
   */
  export type ForecastVerificationPointCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ForecastVerificationPoints.
     */
    data: ForecastVerificationPointCreateManyInput | ForecastVerificationPointCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ForecastVerificationPoint createManyAndReturn
   */
  export type ForecastVerificationPointCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationPoint
     */
    select?: ForecastVerificationPointSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationPoint
     */
    omit?: ForecastVerificationPointOmit<ExtArgs> | null
    /**
     * The data used to create many ForecastVerificationPoints.
     */
    data: ForecastVerificationPointCreateManyInput | ForecastVerificationPointCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationPointIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * ForecastVerificationPoint update
   */
  export type ForecastVerificationPointUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationPoint
     */
    select?: ForecastVerificationPointSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationPoint
     */
    omit?: ForecastVerificationPointOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationPointInclude<ExtArgs> | null
    /**
     * The data needed to update a ForecastVerificationPoint.
     */
    data: XOR<ForecastVerificationPointUpdateInput, ForecastVerificationPointUncheckedUpdateInput>
    /**
     * Choose, which ForecastVerificationPoint to update.
     */
    where: ForecastVerificationPointWhereUniqueInput
  }

  /**
   * ForecastVerificationPoint updateMany
   */
  export type ForecastVerificationPointUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ForecastVerificationPoints.
     */
    data: XOR<ForecastVerificationPointUpdateManyMutationInput, ForecastVerificationPointUncheckedUpdateManyInput>
    /**
     * Filter which ForecastVerificationPoints to update
     */
    where?: ForecastVerificationPointWhereInput
    /**
     * Limit how many ForecastVerificationPoints to update.
     */
    limit?: number
  }

  /**
   * ForecastVerificationPoint updateManyAndReturn
   */
  export type ForecastVerificationPointUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationPoint
     */
    select?: ForecastVerificationPointSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationPoint
     */
    omit?: ForecastVerificationPointOmit<ExtArgs> | null
    /**
     * The data used to update ForecastVerificationPoints.
     */
    data: XOR<ForecastVerificationPointUpdateManyMutationInput, ForecastVerificationPointUncheckedUpdateManyInput>
    /**
     * Filter which ForecastVerificationPoints to update
     */
    where?: ForecastVerificationPointWhereInput
    /**
     * Limit how many ForecastVerificationPoints to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationPointIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * ForecastVerificationPoint upsert
   */
  export type ForecastVerificationPointUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationPoint
     */
    select?: ForecastVerificationPointSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationPoint
     */
    omit?: ForecastVerificationPointOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationPointInclude<ExtArgs> | null
    /**
     * The filter to search for the ForecastVerificationPoint to update in case it exists.
     */
    where: ForecastVerificationPointWhereUniqueInput
    /**
     * In case the ForecastVerificationPoint found by the `where` argument doesn't exist, create a new ForecastVerificationPoint with this data.
     */
    create: XOR<ForecastVerificationPointCreateInput, ForecastVerificationPointUncheckedCreateInput>
    /**
     * In case the ForecastVerificationPoint was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ForecastVerificationPointUpdateInput, ForecastVerificationPointUncheckedUpdateInput>
  }

  /**
   * ForecastVerificationPoint delete
   */
  export type ForecastVerificationPointDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationPoint
     */
    select?: ForecastVerificationPointSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationPoint
     */
    omit?: ForecastVerificationPointOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationPointInclude<ExtArgs> | null
    /**
     * Filter which ForecastVerificationPoint to delete.
     */
    where: ForecastVerificationPointWhereUniqueInput
  }

  /**
   * ForecastVerificationPoint deleteMany
   */
  export type ForecastVerificationPointDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ForecastVerificationPoints to delete
     */
    where?: ForecastVerificationPointWhereInput
    /**
     * Limit how many ForecastVerificationPoints to delete.
     */
    limit?: number
  }

  /**
   * ForecastVerificationPoint without action
   */
  export type ForecastVerificationPointDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ForecastVerificationPoint
     */
    select?: ForecastVerificationPointSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ForecastVerificationPoint
     */
    omit?: ForecastVerificationPointOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ForecastVerificationPointInclude<ExtArgs> | null
  }


  /**
   * Model RollingDailyVerificationRecord
   */

  export type AggregateRollingDailyVerificationRecord = {
    _count: RollingDailyVerificationRecordCountAggregateOutputType | null
    _avg: RollingDailyVerificationRecordAvgAggregateOutputType | null
    _sum: RollingDailyVerificationRecordSumAggregateOutputType | null
    _min: RollingDailyVerificationRecordMinAggregateOutputType | null
    _max: RollingDailyVerificationRecordMaxAggregateOutputType | null
  }

  export type RollingDailyVerificationRecordAvgAggregateOutputType = {
    horizonMonths: number | null
    horizonSteps: number | null
    originValue: Decimal | null
    forecastValue: Decimal | null
    actualValue: Decimal | null
    errorValue: Decimal | null
    absoluteErrorValue: Decimal | null
    deltaValue: Decimal | null
    deltaPct: number | null
    residualValue: Decimal | null
    maseScale: number | null
    trainingObservationCount: number | null
    selectionScore: number | null
  }

  export type RollingDailyVerificationRecordSumAggregateOutputType = {
    horizonMonths: number | null
    horizonSteps: number | null
    originValue: Decimal | null
    forecastValue: Decimal | null
    actualValue: Decimal | null
    errorValue: Decimal | null
    absoluteErrorValue: Decimal | null
    deltaValue: Decimal | null
    deltaPct: number | null
    residualValue: Decimal | null
    maseScale: number | null
    trainingObservationCount: number | null
    selectionScore: number | null
  }

  export type RollingDailyVerificationRecordMinAggregateOutputType = {
    id: string | null
    seriesId: string | null
    inputSource: string | null
    inputRunId: string | null
    targetBasis: $Enums.ForecastTargetBasis | null
    methodId: string | null
    methodVersion: string | null
    modelId: string | null
    forecastOriginAt: Date | null
    horizonLabel: string | null
    horizonMonths: number | null
    horizonSteps: number | null
    targetCalendarDate: Date | null
    verificationObservedAt: Date | null
    maturityStatus: $Enums.RollingDailyVerificationMaturityStatus | null
    originValue: Decimal | null
    forecastValue: Decimal | null
    actualValue: Decimal | null
    errorValue: Decimal | null
    absoluteErrorValue: Decimal | null
    deltaValue: Decimal | null
    deltaPct: number | null
    residualValue: Decimal | null
    maseScale: number | null
    trainingHistoryStartAt: Date | null
    trainingHistoryEndAt: Date | null
    trainingObservationCount: number | null
    sourceHistoryFingerprint: string | null
    selectedVariant: string | null
    selectionMetric: string | null
    selectionScore: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type RollingDailyVerificationRecordMaxAggregateOutputType = {
    id: string | null
    seriesId: string | null
    inputSource: string | null
    inputRunId: string | null
    targetBasis: $Enums.ForecastTargetBasis | null
    methodId: string | null
    methodVersion: string | null
    modelId: string | null
    forecastOriginAt: Date | null
    horizonLabel: string | null
    horizonMonths: number | null
    horizonSteps: number | null
    targetCalendarDate: Date | null
    verificationObservedAt: Date | null
    maturityStatus: $Enums.RollingDailyVerificationMaturityStatus | null
    originValue: Decimal | null
    forecastValue: Decimal | null
    actualValue: Decimal | null
    errorValue: Decimal | null
    absoluteErrorValue: Decimal | null
    deltaValue: Decimal | null
    deltaPct: number | null
    residualValue: Decimal | null
    maseScale: number | null
    trainingHistoryStartAt: Date | null
    trainingHistoryEndAt: Date | null
    trainingObservationCount: number | null
    sourceHistoryFingerprint: string | null
    selectedVariant: string | null
    selectionMetric: string | null
    selectionScore: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type RollingDailyVerificationRecordCountAggregateOutputType = {
    id: number
    seriesId: number
    inputSource: number
    inputRunId: number
    targetBasis: number
    methodId: number
    methodVersion: number
    modelId: number
    forecastOriginAt: number
    horizonLabel: number
    horizonMonths: number
    horizonSteps: number
    targetCalendarDate: number
    verificationObservedAt: number
    maturityStatus: number
    originValue: number
    forecastValue: number
    actualValue: number
    errorValue: number
    absoluteErrorValue: number
    deltaValue: number
    deltaPct: number
    residualValue: number
    maseScale: number
    trainingHistoryStartAt: number
    trainingHistoryEndAt: number
    trainingObservationCount: number
    sourceHistoryFingerprint: number
    selectedVariant: number
    selectionMetric: number
    selectionScore: number
    metadataJson: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type RollingDailyVerificationRecordAvgAggregateInputType = {
    horizonMonths?: true
    horizonSteps?: true
    originValue?: true
    forecastValue?: true
    actualValue?: true
    errorValue?: true
    absoluteErrorValue?: true
    deltaValue?: true
    deltaPct?: true
    residualValue?: true
    maseScale?: true
    trainingObservationCount?: true
    selectionScore?: true
  }

  export type RollingDailyVerificationRecordSumAggregateInputType = {
    horizonMonths?: true
    horizonSteps?: true
    originValue?: true
    forecastValue?: true
    actualValue?: true
    errorValue?: true
    absoluteErrorValue?: true
    deltaValue?: true
    deltaPct?: true
    residualValue?: true
    maseScale?: true
    trainingObservationCount?: true
    selectionScore?: true
  }

  export type RollingDailyVerificationRecordMinAggregateInputType = {
    id?: true
    seriesId?: true
    inputSource?: true
    inputRunId?: true
    targetBasis?: true
    methodId?: true
    methodVersion?: true
    modelId?: true
    forecastOriginAt?: true
    horizonLabel?: true
    horizonMonths?: true
    horizonSteps?: true
    targetCalendarDate?: true
    verificationObservedAt?: true
    maturityStatus?: true
    originValue?: true
    forecastValue?: true
    actualValue?: true
    errorValue?: true
    absoluteErrorValue?: true
    deltaValue?: true
    deltaPct?: true
    residualValue?: true
    maseScale?: true
    trainingHistoryStartAt?: true
    trainingHistoryEndAt?: true
    trainingObservationCount?: true
    sourceHistoryFingerprint?: true
    selectedVariant?: true
    selectionMetric?: true
    selectionScore?: true
    createdAt?: true
    updatedAt?: true
  }

  export type RollingDailyVerificationRecordMaxAggregateInputType = {
    id?: true
    seriesId?: true
    inputSource?: true
    inputRunId?: true
    targetBasis?: true
    methodId?: true
    methodVersion?: true
    modelId?: true
    forecastOriginAt?: true
    horizonLabel?: true
    horizonMonths?: true
    horizonSteps?: true
    targetCalendarDate?: true
    verificationObservedAt?: true
    maturityStatus?: true
    originValue?: true
    forecastValue?: true
    actualValue?: true
    errorValue?: true
    absoluteErrorValue?: true
    deltaValue?: true
    deltaPct?: true
    residualValue?: true
    maseScale?: true
    trainingHistoryStartAt?: true
    trainingHistoryEndAt?: true
    trainingObservationCount?: true
    sourceHistoryFingerprint?: true
    selectedVariant?: true
    selectionMetric?: true
    selectionScore?: true
    createdAt?: true
    updatedAt?: true
  }

  export type RollingDailyVerificationRecordCountAggregateInputType = {
    id?: true
    seriesId?: true
    inputSource?: true
    inputRunId?: true
    targetBasis?: true
    methodId?: true
    methodVersion?: true
    modelId?: true
    forecastOriginAt?: true
    horizonLabel?: true
    horizonMonths?: true
    horizonSteps?: true
    targetCalendarDate?: true
    verificationObservedAt?: true
    maturityStatus?: true
    originValue?: true
    forecastValue?: true
    actualValue?: true
    errorValue?: true
    absoluteErrorValue?: true
    deltaValue?: true
    deltaPct?: true
    residualValue?: true
    maseScale?: true
    trainingHistoryStartAt?: true
    trainingHistoryEndAt?: true
    trainingObservationCount?: true
    sourceHistoryFingerprint?: true
    selectedVariant?: true
    selectionMetric?: true
    selectionScore?: true
    metadataJson?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type RollingDailyVerificationRecordAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which RollingDailyVerificationRecord to aggregate.
     */
    where?: RollingDailyVerificationRecordWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RollingDailyVerificationRecords to fetch.
     */
    orderBy?: RollingDailyVerificationRecordOrderByWithRelationInput | RollingDailyVerificationRecordOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: RollingDailyVerificationRecordWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RollingDailyVerificationRecords from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RollingDailyVerificationRecords.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned RollingDailyVerificationRecords
    **/
    _count?: true | RollingDailyVerificationRecordCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: RollingDailyVerificationRecordAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: RollingDailyVerificationRecordSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: RollingDailyVerificationRecordMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: RollingDailyVerificationRecordMaxAggregateInputType
  }

  export type GetRollingDailyVerificationRecordAggregateType<T extends RollingDailyVerificationRecordAggregateArgs> = {
        [P in keyof T & keyof AggregateRollingDailyVerificationRecord]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateRollingDailyVerificationRecord[P]>
      : GetScalarType<T[P], AggregateRollingDailyVerificationRecord[P]>
  }




  export type RollingDailyVerificationRecordGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: RollingDailyVerificationRecordWhereInput
    orderBy?: RollingDailyVerificationRecordOrderByWithAggregationInput | RollingDailyVerificationRecordOrderByWithAggregationInput[]
    by: RollingDailyVerificationRecordScalarFieldEnum[] | RollingDailyVerificationRecordScalarFieldEnum
    having?: RollingDailyVerificationRecordScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: RollingDailyVerificationRecordCountAggregateInputType | true
    _avg?: RollingDailyVerificationRecordAvgAggregateInputType
    _sum?: RollingDailyVerificationRecordSumAggregateInputType
    _min?: RollingDailyVerificationRecordMinAggregateInputType
    _max?: RollingDailyVerificationRecordMaxAggregateInputType
  }

  export type RollingDailyVerificationRecordGroupByOutputType = {
    id: string
    seriesId: string
    inputSource: string
    inputRunId: string | null
    targetBasis: $Enums.ForecastTargetBasis
    methodId: string
    methodVersion: string
    modelId: string
    forecastOriginAt: Date
    horizonLabel: string
    horizonMonths: number
    horizonSteps: number
    targetCalendarDate: Date
    verificationObservedAt: Date | null
    maturityStatus: $Enums.RollingDailyVerificationMaturityStatus
    originValue: Decimal
    forecastValue: Decimal
    actualValue: Decimal | null
    errorValue: Decimal | null
    absoluteErrorValue: Decimal | null
    deltaValue: Decimal | null
    deltaPct: number | null
    residualValue: Decimal | null
    maseScale: number
    trainingHistoryStartAt: Date | null
    trainingHistoryEndAt: Date
    trainingObservationCount: number
    sourceHistoryFingerprint: string
    selectedVariant: string | null
    selectionMetric: string | null
    selectionScore: number | null
    metadataJson: JsonValue | null
    createdAt: Date
    updatedAt: Date
    _count: RollingDailyVerificationRecordCountAggregateOutputType | null
    _avg: RollingDailyVerificationRecordAvgAggregateOutputType | null
    _sum: RollingDailyVerificationRecordSumAggregateOutputType | null
    _min: RollingDailyVerificationRecordMinAggregateOutputType | null
    _max: RollingDailyVerificationRecordMaxAggregateOutputType | null
  }

  type GetRollingDailyVerificationRecordGroupByPayload<T extends RollingDailyVerificationRecordGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<RollingDailyVerificationRecordGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof RollingDailyVerificationRecordGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], RollingDailyVerificationRecordGroupByOutputType[P]>
            : GetScalarType<T[P], RollingDailyVerificationRecordGroupByOutputType[P]>
        }
      >
    >


  export type RollingDailyVerificationRecordSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    seriesId?: boolean
    inputSource?: boolean
    inputRunId?: boolean
    targetBasis?: boolean
    methodId?: boolean
    methodVersion?: boolean
    modelId?: boolean
    forecastOriginAt?: boolean
    horizonLabel?: boolean
    horizonMonths?: boolean
    horizonSteps?: boolean
    targetCalendarDate?: boolean
    verificationObservedAt?: boolean
    maturityStatus?: boolean
    originValue?: boolean
    forecastValue?: boolean
    actualValue?: boolean
    errorValue?: boolean
    absoluteErrorValue?: boolean
    deltaValue?: boolean
    deltaPct?: boolean
    residualValue?: boolean
    maseScale?: boolean
    trainingHistoryStartAt?: boolean
    trainingHistoryEndAt?: boolean
    trainingObservationCount?: boolean
    sourceHistoryFingerprint?: boolean
    selectedVariant?: boolean
    selectionMetric?: boolean
    selectionScore?: boolean
    metadataJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["rollingDailyVerificationRecord"]>

  export type RollingDailyVerificationRecordSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    seriesId?: boolean
    inputSource?: boolean
    inputRunId?: boolean
    targetBasis?: boolean
    methodId?: boolean
    methodVersion?: boolean
    modelId?: boolean
    forecastOriginAt?: boolean
    horizonLabel?: boolean
    horizonMonths?: boolean
    horizonSteps?: boolean
    targetCalendarDate?: boolean
    verificationObservedAt?: boolean
    maturityStatus?: boolean
    originValue?: boolean
    forecastValue?: boolean
    actualValue?: boolean
    errorValue?: boolean
    absoluteErrorValue?: boolean
    deltaValue?: boolean
    deltaPct?: boolean
    residualValue?: boolean
    maseScale?: boolean
    trainingHistoryStartAt?: boolean
    trainingHistoryEndAt?: boolean
    trainingObservationCount?: boolean
    sourceHistoryFingerprint?: boolean
    selectedVariant?: boolean
    selectionMetric?: boolean
    selectionScore?: boolean
    metadataJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["rollingDailyVerificationRecord"]>

  export type RollingDailyVerificationRecordSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    seriesId?: boolean
    inputSource?: boolean
    inputRunId?: boolean
    targetBasis?: boolean
    methodId?: boolean
    methodVersion?: boolean
    modelId?: boolean
    forecastOriginAt?: boolean
    horizonLabel?: boolean
    horizonMonths?: boolean
    horizonSteps?: boolean
    targetCalendarDate?: boolean
    verificationObservedAt?: boolean
    maturityStatus?: boolean
    originValue?: boolean
    forecastValue?: boolean
    actualValue?: boolean
    errorValue?: boolean
    absoluteErrorValue?: boolean
    deltaValue?: boolean
    deltaPct?: boolean
    residualValue?: boolean
    maseScale?: boolean
    trainingHistoryStartAt?: boolean
    trainingHistoryEndAt?: boolean
    trainingObservationCount?: boolean
    sourceHistoryFingerprint?: boolean
    selectedVariant?: boolean
    selectionMetric?: boolean
    selectionScore?: boolean
    metadataJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["rollingDailyVerificationRecord"]>

  export type RollingDailyVerificationRecordSelectScalar = {
    id?: boolean
    seriesId?: boolean
    inputSource?: boolean
    inputRunId?: boolean
    targetBasis?: boolean
    methodId?: boolean
    methodVersion?: boolean
    modelId?: boolean
    forecastOriginAt?: boolean
    horizonLabel?: boolean
    horizonMonths?: boolean
    horizonSteps?: boolean
    targetCalendarDate?: boolean
    verificationObservedAt?: boolean
    maturityStatus?: boolean
    originValue?: boolean
    forecastValue?: boolean
    actualValue?: boolean
    errorValue?: boolean
    absoluteErrorValue?: boolean
    deltaValue?: boolean
    deltaPct?: boolean
    residualValue?: boolean
    maseScale?: boolean
    trainingHistoryStartAt?: boolean
    trainingHistoryEndAt?: boolean
    trainingObservationCount?: boolean
    sourceHistoryFingerprint?: boolean
    selectedVariant?: boolean
    selectionMetric?: boolean
    selectionScore?: boolean
    metadataJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type RollingDailyVerificationRecordOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "seriesId" | "inputSource" | "inputRunId" | "targetBasis" | "methodId" | "methodVersion" | "modelId" | "forecastOriginAt" | "horizonLabel" | "horizonMonths" | "horizonSteps" | "targetCalendarDate" | "verificationObservedAt" | "maturityStatus" | "originValue" | "forecastValue" | "actualValue" | "errorValue" | "absoluteErrorValue" | "deltaValue" | "deltaPct" | "residualValue" | "maseScale" | "trainingHistoryStartAt" | "trainingHistoryEndAt" | "trainingObservationCount" | "sourceHistoryFingerprint" | "selectedVariant" | "selectionMetric" | "selectionScore" | "metadataJson" | "createdAt" | "updatedAt", ExtArgs["result"]["rollingDailyVerificationRecord"]>

  export type $RollingDailyVerificationRecordPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "RollingDailyVerificationRecord"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      seriesId: string
      inputSource: string
      inputRunId: string | null
      targetBasis: $Enums.ForecastTargetBasis
      methodId: string
      methodVersion: string
      modelId: string
      forecastOriginAt: Date
      horizonLabel: string
      horizonMonths: number
      horizonSteps: number
      targetCalendarDate: Date
      verificationObservedAt: Date | null
      maturityStatus: $Enums.RollingDailyVerificationMaturityStatus
      originValue: Prisma.Decimal
      forecastValue: Prisma.Decimal
      actualValue: Prisma.Decimal | null
      errorValue: Prisma.Decimal | null
      absoluteErrorValue: Prisma.Decimal | null
      deltaValue: Prisma.Decimal | null
      deltaPct: number | null
      residualValue: Prisma.Decimal | null
      maseScale: number
      trainingHistoryStartAt: Date | null
      trainingHistoryEndAt: Date
      trainingObservationCount: number
      sourceHistoryFingerprint: string
      selectedVariant: string | null
      selectionMetric: string | null
      selectionScore: number | null
      metadataJson: Prisma.JsonValue | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["rollingDailyVerificationRecord"]>
    composites: {}
  }

  type RollingDailyVerificationRecordGetPayload<S extends boolean | null | undefined | RollingDailyVerificationRecordDefaultArgs> = $Result.GetResult<Prisma.$RollingDailyVerificationRecordPayload, S>

  type RollingDailyVerificationRecordCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<RollingDailyVerificationRecordFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: RollingDailyVerificationRecordCountAggregateInputType | true
    }

  export interface RollingDailyVerificationRecordDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['RollingDailyVerificationRecord'], meta: { name: 'RollingDailyVerificationRecord' } }
    /**
     * Find zero or one RollingDailyVerificationRecord that matches the filter.
     * @param {RollingDailyVerificationRecordFindUniqueArgs} args - Arguments to find a RollingDailyVerificationRecord
     * @example
     * // Get one RollingDailyVerificationRecord
     * const rollingDailyVerificationRecord = await prisma.rollingDailyVerificationRecord.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends RollingDailyVerificationRecordFindUniqueArgs>(args: SelectSubset<T, RollingDailyVerificationRecordFindUniqueArgs<ExtArgs>>): Prisma__RollingDailyVerificationRecordClient<$Result.GetResult<Prisma.$RollingDailyVerificationRecordPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one RollingDailyVerificationRecord that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {RollingDailyVerificationRecordFindUniqueOrThrowArgs} args - Arguments to find a RollingDailyVerificationRecord
     * @example
     * // Get one RollingDailyVerificationRecord
     * const rollingDailyVerificationRecord = await prisma.rollingDailyVerificationRecord.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends RollingDailyVerificationRecordFindUniqueOrThrowArgs>(args: SelectSubset<T, RollingDailyVerificationRecordFindUniqueOrThrowArgs<ExtArgs>>): Prisma__RollingDailyVerificationRecordClient<$Result.GetResult<Prisma.$RollingDailyVerificationRecordPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first RollingDailyVerificationRecord that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyVerificationRecordFindFirstArgs} args - Arguments to find a RollingDailyVerificationRecord
     * @example
     * // Get one RollingDailyVerificationRecord
     * const rollingDailyVerificationRecord = await prisma.rollingDailyVerificationRecord.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends RollingDailyVerificationRecordFindFirstArgs>(args?: SelectSubset<T, RollingDailyVerificationRecordFindFirstArgs<ExtArgs>>): Prisma__RollingDailyVerificationRecordClient<$Result.GetResult<Prisma.$RollingDailyVerificationRecordPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first RollingDailyVerificationRecord that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyVerificationRecordFindFirstOrThrowArgs} args - Arguments to find a RollingDailyVerificationRecord
     * @example
     * // Get one RollingDailyVerificationRecord
     * const rollingDailyVerificationRecord = await prisma.rollingDailyVerificationRecord.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends RollingDailyVerificationRecordFindFirstOrThrowArgs>(args?: SelectSubset<T, RollingDailyVerificationRecordFindFirstOrThrowArgs<ExtArgs>>): Prisma__RollingDailyVerificationRecordClient<$Result.GetResult<Prisma.$RollingDailyVerificationRecordPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more RollingDailyVerificationRecords that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyVerificationRecordFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all RollingDailyVerificationRecords
     * const rollingDailyVerificationRecords = await prisma.rollingDailyVerificationRecord.findMany()
     * 
     * // Get first 10 RollingDailyVerificationRecords
     * const rollingDailyVerificationRecords = await prisma.rollingDailyVerificationRecord.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const rollingDailyVerificationRecordWithIdOnly = await prisma.rollingDailyVerificationRecord.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends RollingDailyVerificationRecordFindManyArgs>(args?: SelectSubset<T, RollingDailyVerificationRecordFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RollingDailyVerificationRecordPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a RollingDailyVerificationRecord.
     * @param {RollingDailyVerificationRecordCreateArgs} args - Arguments to create a RollingDailyVerificationRecord.
     * @example
     * // Create one RollingDailyVerificationRecord
     * const RollingDailyVerificationRecord = await prisma.rollingDailyVerificationRecord.create({
     *   data: {
     *     // ... data to create a RollingDailyVerificationRecord
     *   }
     * })
     * 
     */
    create<T extends RollingDailyVerificationRecordCreateArgs>(args: SelectSubset<T, RollingDailyVerificationRecordCreateArgs<ExtArgs>>): Prisma__RollingDailyVerificationRecordClient<$Result.GetResult<Prisma.$RollingDailyVerificationRecordPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many RollingDailyVerificationRecords.
     * @param {RollingDailyVerificationRecordCreateManyArgs} args - Arguments to create many RollingDailyVerificationRecords.
     * @example
     * // Create many RollingDailyVerificationRecords
     * const rollingDailyVerificationRecord = await prisma.rollingDailyVerificationRecord.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends RollingDailyVerificationRecordCreateManyArgs>(args?: SelectSubset<T, RollingDailyVerificationRecordCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many RollingDailyVerificationRecords and returns the data saved in the database.
     * @param {RollingDailyVerificationRecordCreateManyAndReturnArgs} args - Arguments to create many RollingDailyVerificationRecords.
     * @example
     * // Create many RollingDailyVerificationRecords
     * const rollingDailyVerificationRecord = await prisma.rollingDailyVerificationRecord.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many RollingDailyVerificationRecords and only return the `id`
     * const rollingDailyVerificationRecordWithIdOnly = await prisma.rollingDailyVerificationRecord.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends RollingDailyVerificationRecordCreateManyAndReturnArgs>(args?: SelectSubset<T, RollingDailyVerificationRecordCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RollingDailyVerificationRecordPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a RollingDailyVerificationRecord.
     * @param {RollingDailyVerificationRecordDeleteArgs} args - Arguments to delete one RollingDailyVerificationRecord.
     * @example
     * // Delete one RollingDailyVerificationRecord
     * const RollingDailyVerificationRecord = await prisma.rollingDailyVerificationRecord.delete({
     *   where: {
     *     // ... filter to delete one RollingDailyVerificationRecord
     *   }
     * })
     * 
     */
    delete<T extends RollingDailyVerificationRecordDeleteArgs>(args: SelectSubset<T, RollingDailyVerificationRecordDeleteArgs<ExtArgs>>): Prisma__RollingDailyVerificationRecordClient<$Result.GetResult<Prisma.$RollingDailyVerificationRecordPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one RollingDailyVerificationRecord.
     * @param {RollingDailyVerificationRecordUpdateArgs} args - Arguments to update one RollingDailyVerificationRecord.
     * @example
     * // Update one RollingDailyVerificationRecord
     * const rollingDailyVerificationRecord = await prisma.rollingDailyVerificationRecord.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends RollingDailyVerificationRecordUpdateArgs>(args: SelectSubset<T, RollingDailyVerificationRecordUpdateArgs<ExtArgs>>): Prisma__RollingDailyVerificationRecordClient<$Result.GetResult<Prisma.$RollingDailyVerificationRecordPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more RollingDailyVerificationRecords.
     * @param {RollingDailyVerificationRecordDeleteManyArgs} args - Arguments to filter RollingDailyVerificationRecords to delete.
     * @example
     * // Delete a few RollingDailyVerificationRecords
     * const { count } = await prisma.rollingDailyVerificationRecord.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends RollingDailyVerificationRecordDeleteManyArgs>(args?: SelectSubset<T, RollingDailyVerificationRecordDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more RollingDailyVerificationRecords.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyVerificationRecordUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many RollingDailyVerificationRecords
     * const rollingDailyVerificationRecord = await prisma.rollingDailyVerificationRecord.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends RollingDailyVerificationRecordUpdateManyArgs>(args: SelectSubset<T, RollingDailyVerificationRecordUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more RollingDailyVerificationRecords and returns the data updated in the database.
     * @param {RollingDailyVerificationRecordUpdateManyAndReturnArgs} args - Arguments to update many RollingDailyVerificationRecords.
     * @example
     * // Update many RollingDailyVerificationRecords
     * const rollingDailyVerificationRecord = await prisma.rollingDailyVerificationRecord.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more RollingDailyVerificationRecords and only return the `id`
     * const rollingDailyVerificationRecordWithIdOnly = await prisma.rollingDailyVerificationRecord.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends RollingDailyVerificationRecordUpdateManyAndReturnArgs>(args: SelectSubset<T, RollingDailyVerificationRecordUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RollingDailyVerificationRecordPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one RollingDailyVerificationRecord.
     * @param {RollingDailyVerificationRecordUpsertArgs} args - Arguments to update or create a RollingDailyVerificationRecord.
     * @example
     * // Update or create a RollingDailyVerificationRecord
     * const rollingDailyVerificationRecord = await prisma.rollingDailyVerificationRecord.upsert({
     *   create: {
     *     // ... data to create a RollingDailyVerificationRecord
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the RollingDailyVerificationRecord we want to update
     *   }
     * })
     */
    upsert<T extends RollingDailyVerificationRecordUpsertArgs>(args: SelectSubset<T, RollingDailyVerificationRecordUpsertArgs<ExtArgs>>): Prisma__RollingDailyVerificationRecordClient<$Result.GetResult<Prisma.$RollingDailyVerificationRecordPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of RollingDailyVerificationRecords.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyVerificationRecordCountArgs} args - Arguments to filter RollingDailyVerificationRecords to count.
     * @example
     * // Count the number of RollingDailyVerificationRecords
     * const count = await prisma.rollingDailyVerificationRecord.count({
     *   where: {
     *     // ... the filter for the RollingDailyVerificationRecords we want to count
     *   }
     * })
    **/
    count<T extends RollingDailyVerificationRecordCountArgs>(
      args?: Subset<T, RollingDailyVerificationRecordCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], RollingDailyVerificationRecordCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a RollingDailyVerificationRecord.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyVerificationRecordAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends RollingDailyVerificationRecordAggregateArgs>(args: Subset<T, RollingDailyVerificationRecordAggregateArgs>): Prisma.PrismaPromise<GetRollingDailyVerificationRecordAggregateType<T>>

    /**
     * Group by RollingDailyVerificationRecord.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyVerificationRecordGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends RollingDailyVerificationRecordGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: RollingDailyVerificationRecordGroupByArgs['orderBy'] }
        : { orderBy?: RollingDailyVerificationRecordGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, RollingDailyVerificationRecordGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetRollingDailyVerificationRecordGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the RollingDailyVerificationRecord model
   */
  readonly fields: RollingDailyVerificationRecordFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for RollingDailyVerificationRecord.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__RollingDailyVerificationRecordClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the RollingDailyVerificationRecord model
   */
  interface RollingDailyVerificationRecordFieldRefs {
    readonly id: FieldRef<"RollingDailyVerificationRecord", 'String'>
    readonly seriesId: FieldRef<"RollingDailyVerificationRecord", 'String'>
    readonly inputSource: FieldRef<"RollingDailyVerificationRecord", 'String'>
    readonly inputRunId: FieldRef<"RollingDailyVerificationRecord", 'String'>
    readonly targetBasis: FieldRef<"RollingDailyVerificationRecord", 'ForecastTargetBasis'>
    readonly methodId: FieldRef<"RollingDailyVerificationRecord", 'String'>
    readonly methodVersion: FieldRef<"RollingDailyVerificationRecord", 'String'>
    readonly modelId: FieldRef<"RollingDailyVerificationRecord", 'String'>
    readonly forecastOriginAt: FieldRef<"RollingDailyVerificationRecord", 'DateTime'>
    readonly horizonLabel: FieldRef<"RollingDailyVerificationRecord", 'String'>
    readonly horizonMonths: FieldRef<"RollingDailyVerificationRecord", 'Int'>
    readonly horizonSteps: FieldRef<"RollingDailyVerificationRecord", 'Int'>
    readonly targetCalendarDate: FieldRef<"RollingDailyVerificationRecord", 'DateTime'>
    readonly verificationObservedAt: FieldRef<"RollingDailyVerificationRecord", 'DateTime'>
    readonly maturityStatus: FieldRef<"RollingDailyVerificationRecord", 'RollingDailyVerificationMaturityStatus'>
    readonly originValue: FieldRef<"RollingDailyVerificationRecord", 'Decimal'>
    readonly forecastValue: FieldRef<"RollingDailyVerificationRecord", 'Decimal'>
    readonly actualValue: FieldRef<"RollingDailyVerificationRecord", 'Decimal'>
    readonly errorValue: FieldRef<"RollingDailyVerificationRecord", 'Decimal'>
    readonly absoluteErrorValue: FieldRef<"RollingDailyVerificationRecord", 'Decimal'>
    readonly deltaValue: FieldRef<"RollingDailyVerificationRecord", 'Decimal'>
    readonly deltaPct: FieldRef<"RollingDailyVerificationRecord", 'Float'>
    readonly residualValue: FieldRef<"RollingDailyVerificationRecord", 'Decimal'>
    readonly maseScale: FieldRef<"RollingDailyVerificationRecord", 'Float'>
    readonly trainingHistoryStartAt: FieldRef<"RollingDailyVerificationRecord", 'DateTime'>
    readonly trainingHistoryEndAt: FieldRef<"RollingDailyVerificationRecord", 'DateTime'>
    readonly trainingObservationCount: FieldRef<"RollingDailyVerificationRecord", 'Int'>
    readonly sourceHistoryFingerprint: FieldRef<"RollingDailyVerificationRecord", 'String'>
    readonly selectedVariant: FieldRef<"RollingDailyVerificationRecord", 'String'>
    readonly selectionMetric: FieldRef<"RollingDailyVerificationRecord", 'String'>
    readonly selectionScore: FieldRef<"RollingDailyVerificationRecord", 'Float'>
    readonly metadataJson: FieldRef<"RollingDailyVerificationRecord", 'Json'>
    readonly createdAt: FieldRef<"RollingDailyVerificationRecord", 'DateTime'>
    readonly updatedAt: FieldRef<"RollingDailyVerificationRecord", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * RollingDailyVerificationRecord findUnique
   */
  export type RollingDailyVerificationRecordFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyVerificationRecord
     */
    select?: RollingDailyVerificationRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyVerificationRecord
     */
    omit?: RollingDailyVerificationRecordOmit<ExtArgs> | null
    /**
     * Filter, which RollingDailyVerificationRecord to fetch.
     */
    where: RollingDailyVerificationRecordWhereUniqueInput
  }

  /**
   * RollingDailyVerificationRecord findUniqueOrThrow
   */
  export type RollingDailyVerificationRecordFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyVerificationRecord
     */
    select?: RollingDailyVerificationRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyVerificationRecord
     */
    omit?: RollingDailyVerificationRecordOmit<ExtArgs> | null
    /**
     * Filter, which RollingDailyVerificationRecord to fetch.
     */
    where: RollingDailyVerificationRecordWhereUniqueInput
  }

  /**
   * RollingDailyVerificationRecord findFirst
   */
  export type RollingDailyVerificationRecordFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyVerificationRecord
     */
    select?: RollingDailyVerificationRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyVerificationRecord
     */
    omit?: RollingDailyVerificationRecordOmit<ExtArgs> | null
    /**
     * Filter, which RollingDailyVerificationRecord to fetch.
     */
    where?: RollingDailyVerificationRecordWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RollingDailyVerificationRecords to fetch.
     */
    orderBy?: RollingDailyVerificationRecordOrderByWithRelationInput | RollingDailyVerificationRecordOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for RollingDailyVerificationRecords.
     */
    cursor?: RollingDailyVerificationRecordWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RollingDailyVerificationRecords from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RollingDailyVerificationRecords.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RollingDailyVerificationRecords.
     */
    distinct?: RollingDailyVerificationRecordScalarFieldEnum | RollingDailyVerificationRecordScalarFieldEnum[]
  }

  /**
   * RollingDailyVerificationRecord findFirstOrThrow
   */
  export type RollingDailyVerificationRecordFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyVerificationRecord
     */
    select?: RollingDailyVerificationRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyVerificationRecord
     */
    omit?: RollingDailyVerificationRecordOmit<ExtArgs> | null
    /**
     * Filter, which RollingDailyVerificationRecord to fetch.
     */
    where?: RollingDailyVerificationRecordWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RollingDailyVerificationRecords to fetch.
     */
    orderBy?: RollingDailyVerificationRecordOrderByWithRelationInput | RollingDailyVerificationRecordOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for RollingDailyVerificationRecords.
     */
    cursor?: RollingDailyVerificationRecordWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RollingDailyVerificationRecords from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RollingDailyVerificationRecords.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RollingDailyVerificationRecords.
     */
    distinct?: RollingDailyVerificationRecordScalarFieldEnum | RollingDailyVerificationRecordScalarFieldEnum[]
  }

  /**
   * RollingDailyVerificationRecord findMany
   */
  export type RollingDailyVerificationRecordFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyVerificationRecord
     */
    select?: RollingDailyVerificationRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyVerificationRecord
     */
    omit?: RollingDailyVerificationRecordOmit<ExtArgs> | null
    /**
     * Filter, which RollingDailyVerificationRecords to fetch.
     */
    where?: RollingDailyVerificationRecordWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RollingDailyVerificationRecords to fetch.
     */
    orderBy?: RollingDailyVerificationRecordOrderByWithRelationInput | RollingDailyVerificationRecordOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing RollingDailyVerificationRecords.
     */
    cursor?: RollingDailyVerificationRecordWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RollingDailyVerificationRecords from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RollingDailyVerificationRecords.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RollingDailyVerificationRecords.
     */
    distinct?: RollingDailyVerificationRecordScalarFieldEnum | RollingDailyVerificationRecordScalarFieldEnum[]
  }

  /**
   * RollingDailyVerificationRecord create
   */
  export type RollingDailyVerificationRecordCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyVerificationRecord
     */
    select?: RollingDailyVerificationRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyVerificationRecord
     */
    omit?: RollingDailyVerificationRecordOmit<ExtArgs> | null
    /**
     * The data needed to create a RollingDailyVerificationRecord.
     */
    data: XOR<RollingDailyVerificationRecordCreateInput, RollingDailyVerificationRecordUncheckedCreateInput>
  }

  /**
   * RollingDailyVerificationRecord createMany
   */
  export type RollingDailyVerificationRecordCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many RollingDailyVerificationRecords.
     */
    data: RollingDailyVerificationRecordCreateManyInput | RollingDailyVerificationRecordCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * RollingDailyVerificationRecord createManyAndReturn
   */
  export type RollingDailyVerificationRecordCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyVerificationRecord
     */
    select?: RollingDailyVerificationRecordSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyVerificationRecord
     */
    omit?: RollingDailyVerificationRecordOmit<ExtArgs> | null
    /**
     * The data used to create many RollingDailyVerificationRecords.
     */
    data: RollingDailyVerificationRecordCreateManyInput | RollingDailyVerificationRecordCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * RollingDailyVerificationRecord update
   */
  export type RollingDailyVerificationRecordUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyVerificationRecord
     */
    select?: RollingDailyVerificationRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyVerificationRecord
     */
    omit?: RollingDailyVerificationRecordOmit<ExtArgs> | null
    /**
     * The data needed to update a RollingDailyVerificationRecord.
     */
    data: XOR<RollingDailyVerificationRecordUpdateInput, RollingDailyVerificationRecordUncheckedUpdateInput>
    /**
     * Choose, which RollingDailyVerificationRecord to update.
     */
    where: RollingDailyVerificationRecordWhereUniqueInput
  }

  /**
   * RollingDailyVerificationRecord updateMany
   */
  export type RollingDailyVerificationRecordUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update RollingDailyVerificationRecords.
     */
    data: XOR<RollingDailyVerificationRecordUpdateManyMutationInput, RollingDailyVerificationRecordUncheckedUpdateManyInput>
    /**
     * Filter which RollingDailyVerificationRecords to update
     */
    where?: RollingDailyVerificationRecordWhereInput
    /**
     * Limit how many RollingDailyVerificationRecords to update.
     */
    limit?: number
  }

  /**
   * RollingDailyVerificationRecord updateManyAndReturn
   */
  export type RollingDailyVerificationRecordUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyVerificationRecord
     */
    select?: RollingDailyVerificationRecordSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyVerificationRecord
     */
    omit?: RollingDailyVerificationRecordOmit<ExtArgs> | null
    /**
     * The data used to update RollingDailyVerificationRecords.
     */
    data: XOR<RollingDailyVerificationRecordUpdateManyMutationInput, RollingDailyVerificationRecordUncheckedUpdateManyInput>
    /**
     * Filter which RollingDailyVerificationRecords to update
     */
    where?: RollingDailyVerificationRecordWhereInput
    /**
     * Limit how many RollingDailyVerificationRecords to update.
     */
    limit?: number
  }

  /**
   * RollingDailyVerificationRecord upsert
   */
  export type RollingDailyVerificationRecordUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyVerificationRecord
     */
    select?: RollingDailyVerificationRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyVerificationRecord
     */
    omit?: RollingDailyVerificationRecordOmit<ExtArgs> | null
    /**
     * The filter to search for the RollingDailyVerificationRecord to update in case it exists.
     */
    where: RollingDailyVerificationRecordWhereUniqueInput
    /**
     * In case the RollingDailyVerificationRecord found by the `where` argument doesn't exist, create a new RollingDailyVerificationRecord with this data.
     */
    create: XOR<RollingDailyVerificationRecordCreateInput, RollingDailyVerificationRecordUncheckedCreateInput>
    /**
     * In case the RollingDailyVerificationRecord was found with the provided `where` argument, update it with this data.
     */
    update: XOR<RollingDailyVerificationRecordUpdateInput, RollingDailyVerificationRecordUncheckedUpdateInput>
  }

  /**
   * RollingDailyVerificationRecord delete
   */
  export type RollingDailyVerificationRecordDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyVerificationRecord
     */
    select?: RollingDailyVerificationRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyVerificationRecord
     */
    omit?: RollingDailyVerificationRecordOmit<ExtArgs> | null
    /**
     * Filter which RollingDailyVerificationRecord to delete.
     */
    where: RollingDailyVerificationRecordWhereUniqueInput
  }

  /**
   * RollingDailyVerificationRecord deleteMany
   */
  export type RollingDailyVerificationRecordDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which RollingDailyVerificationRecords to delete
     */
    where?: RollingDailyVerificationRecordWhereInput
    /**
     * Limit how many RollingDailyVerificationRecords to delete.
     */
    limit?: number
  }

  /**
   * RollingDailyVerificationRecord without action
   */
  export type RollingDailyVerificationRecordDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyVerificationRecord
     */
    select?: RollingDailyVerificationRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyVerificationRecord
     */
    omit?: RollingDailyVerificationRecordOmit<ExtArgs> | null
  }


  /**
   * Model RollingDailyCurrentForecastSnapshot
   */

  export type AggregateRollingDailyCurrentForecastSnapshot = {
    _count: RollingDailyCurrentForecastSnapshotCountAggregateOutputType | null
    _min: RollingDailyCurrentForecastSnapshotMinAggregateOutputType | null
    _max: RollingDailyCurrentForecastSnapshotMaxAggregateOutputType | null
  }

  export type RollingDailyCurrentForecastSnapshotMinAggregateOutputType = {
    id: string | null
    seriesId: string | null
    inputSource: string | null
    inputRunId: string | null
    targetBasis: $Enums.ForecastTargetBasis | null
    methodId: string | null
    methodVersion: string | null
    modelId: string | null
    contractVersion: string | null
    status: string | null
    reasonCode: string | null
    message: string | null
    forecastOriginAt: Date | null
    sourceLatestObservationAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type RollingDailyCurrentForecastSnapshotMaxAggregateOutputType = {
    id: string | null
    seriesId: string | null
    inputSource: string | null
    inputRunId: string | null
    targetBasis: $Enums.ForecastTargetBasis | null
    methodId: string | null
    methodVersion: string | null
    modelId: string | null
    contractVersion: string | null
    status: string | null
    reasonCode: string | null
    message: string | null
    forecastOriginAt: Date | null
    sourceLatestObservationAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type RollingDailyCurrentForecastSnapshotCountAggregateOutputType = {
    id: number
    seriesId: number
    inputSource: number
    inputRunId: number
    targetBasis: number
    methodId: number
    methodVersion: number
    modelId: number
    contractVersion: number
    status: number
    reasonCode: number
    message: number
    forecastOriginAt: number
    sourceLatestObservationAt: number
    payloadJson: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type RollingDailyCurrentForecastSnapshotMinAggregateInputType = {
    id?: true
    seriesId?: true
    inputSource?: true
    inputRunId?: true
    targetBasis?: true
    methodId?: true
    methodVersion?: true
    modelId?: true
    contractVersion?: true
    status?: true
    reasonCode?: true
    message?: true
    forecastOriginAt?: true
    sourceLatestObservationAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type RollingDailyCurrentForecastSnapshotMaxAggregateInputType = {
    id?: true
    seriesId?: true
    inputSource?: true
    inputRunId?: true
    targetBasis?: true
    methodId?: true
    methodVersion?: true
    modelId?: true
    contractVersion?: true
    status?: true
    reasonCode?: true
    message?: true
    forecastOriginAt?: true
    sourceLatestObservationAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type RollingDailyCurrentForecastSnapshotCountAggregateInputType = {
    id?: true
    seriesId?: true
    inputSource?: true
    inputRunId?: true
    targetBasis?: true
    methodId?: true
    methodVersion?: true
    modelId?: true
    contractVersion?: true
    status?: true
    reasonCode?: true
    message?: true
    forecastOriginAt?: true
    sourceLatestObservationAt?: true
    payloadJson?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type RollingDailyCurrentForecastSnapshotAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which RollingDailyCurrentForecastSnapshot to aggregate.
     */
    where?: RollingDailyCurrentForecastSnapshotWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RollingDailyCurrentForecastSnapshots to fetch.
     */
    orderBy?: RollingDailyCurrentForecastSnapshotOrderByWithRelationInput | RollingDailyCurrentForecastSnapshotOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: RollingDailyCurrentForecastSnapshotWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RollingDailyCurrentForecastSnapshots from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RollingDailyCurrentForecastSnapshots.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned RollingDailyCurrentForecastSnapshots
    **/
    _count?: true | RollingDailyCurrentForecastSnapshotCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: RollingDailyCurrentForecastSnapshotMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: RollingDailyCurrentForecastSnapshotMaxAggregateInputType
  }

  export type GetRollingDailyCurrentForecastSnapshotAggregateType<T extends RollingDailyCurrentForecastSnapshotAggregateArgs> = {
        [P in keyof T & keyof AggregateRollingDailyCurrentForecastSnapshot]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateRollingDailyCurrentForecastSnapshot[P]>
      : GetScalarType<T[P], AggregateRollingDailyCurrentForecastSnapshot[P]>
  }




  export type RollingDailyCurrentForecastSnapshotGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: RollingDailyCurrentForecastSnapshotWhereInput
    orderBy?: RollingDailyCurrentForecastSnapshotOrderByWithAggregationInput | RollingDailyCurrentForecastSnapshotOrderByWithAggregationInput[]
    by: RollingDailyCurrentForecastSnapshotScalarFieldEnum[] | RollingDailyCurrentForecastSnapshotScalarFieldEnum
    having?: RollingDailyCurrentForecastSnapshotScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: RollingDailyCurrentForecastSnapshotCountAggregateInputType | true
    _min?: RollingDailyCurrentForecastSnapshotMinAggregateInputType
    _max?: RollingDailyCurrentForecastSnapshotMaxAggregateInputType
  }

  export type RollingDailyCurrentForecastSnapshotGroupByOutputType = {
    id: string
    seriesId: string
    inputSource: string
    inputRunId: string | null
    targetBasis: $Enums.ForecastTargetBasis
    methodId: string
    methodVersion: string
    modelId: string
    contractVersion: string
    status: string
    reasonCode: string | null
    message: string | null
    forecastOriginAt: Date | null
    sourceLatestObservationAt: Date | null
    payloadJson: JsonValue
    createdAt: Date
    updatedAt: Date
    _count: RollingDailyCurrentForecastSnapshotCountAggregateOutputType | null
    _min: RollingDailyCurrentForecastSnapshotMinAggregateOutputType | null
    _max: RollingDailyCurrentForecastSnapshotMaxAggregateOutputType | null
  }

  type GetRollingDailyCurrentForecastSnapshotGroupByPayload<T extends RollingDailyCurrentForecastSnapshotGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<RollingDailyCurrentForecastSnapshotGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof RollingDailyCurrentForecastSnapshotGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], RollingDailyCurrentForecastSnapshotGroupByOutputType[P]>
            : GetScalarType<T[P], RollingDailyCurrentForecastSnapshotGroupByOutputType[P]>
        }
      >
    >


  export type RollingDailyCurrentForecastSnapshotSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    seriesId?: boolean
    inputSource?: boolean
    inputRunId?: boolean
    targetBasis?: boolean
    methodId?: boolean
    methodVersion?: boolean
    modelId?: boolean
    contractVersion?: boolean
    status?: boolean
    reasonCode?: boolean
    message?: boolean
    forecastOriginAt?: boolean
    sourceLatestObservationAt?: boolean
    payloadJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["rollingDailyCurrentForecastSnapshot"]>

  export type RollingDailyCurrentForecastSnapshotSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    seriesId?: boolean
    inputSource?: boolean
    inputRunId?: boolean
    targetBasis?: boolean
    methodId?: boolean
    methodVersion?: boolean
    modelId?: boolean
    contractVersion?: boolean
    status?: boolean
    reasonCode?: boolean
    message?: boolean
    forecastOriginAt?: boolean
    sourceLatestObservationAt?: boolean
    payloadJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["rollingDailyCurrentForecastSnapshot"]>

  export type RollingDailyCurrentForecastSnapshotSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    seriesId?: boolean
    inputSource?: boolean
    inputRunId?: boolean
    targetBasis?: boolean
    methodId?: boolean
    methodVersion?: boolean
    modelId?: boolean
    contractVersion?: boolean
    status?: boolean
    reasonCode?: boolean
    message?: boolean
    forecastOriginAt?: boolean
    sourceLatestObservationAt?: boolean
    payloadJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["rollingDailyCurrentForecastSnapshot"]>

  export type RollingDailyCurrentForecastSnapshotSelectScalar = {
    id?: boolean
    seriesId?: boolean
    inputSource?: boolean
    inputRunId?: boolean
    targetBasis?: boolean
    methodId?: boolean
    methodVersion?: boolean
    modelId?: boolean
    contractVersion?: boolean
    status?: boolean
    reasonCode?: boolean
    message?: boolean
    forecastOriginAt?: boolean
    sourceLatestObservationAt?: boolean
    payloadJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type RollingDailyCurrentForecastSnapshotOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "seriesId" | "inputSource" | "inputRunId" | "targetBasis" | "methodId" | "methodVersion" | "modelId" | "contractVersion" | "status" | "reasonCode" | "message" | "forecastOriginAt" | "sourceLatestObservationAt" | "payloadJson" | "createdAt" | "updatedAt", ExtArgs["result"]["rollingDailyCurrentForecastSnapshot"]>

  export type $RollingDailyCurrentForecastSnapshotPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "RollingDailyCurrentForecastSnapshot"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      seriesId: string
      inputSource: string
      inputRunId: string | null
      targetBasis: $Enums.ForecastTargetBasis
      methodId: string
      methodVersion: string
      modelId: string
      contractVersion: string
      status: string
      reasonCode: string | null
      message: string | null
      forecastOriginAt: Date | null
      sourceLatestObservationAt: Date | null
      payloadJson: Prisma.JsonValue
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["rollingDailyCurrentForecastSnapshot"]>
    composites: {}
  }

  type RollingDailyCurrentForecastSnapshotGetPayload<S extends boolean | null | undefined | RollingDailyCurrentForecastSnapshotDefaultArgs> = $Result.GetResult<Prisma.$RollingDailyCurrentForecastSnapshotPayload, S>

  type RollingDailyCurrentForecastSnapshotCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<RollingDailyCurrentForecastSnapshotFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: RollingDailyCurrentForecastSnapshotCountAggregateInputType | true
    }

  export interface RollingDailyCurrentForecastSnapshotDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['RollingDailyCurrentForecastSnapshot'], meta: { name: 'RollingDailyCurrentForecastSnapshot' } }
    /**
     * Find zero or one RollingDailyCurrentForecastSnapshot that matches the filter.
     * @param {RollingDailyCurrentForecastSnapshotFindUniqueArgs} args - Arguments to find a RollingDailyCurrentForecastSnapshot
     * @example
     * // Get one RollingDailyCurrentForecastSnapshot
     * const rollingDailyCurrentForecastSnapshot = await prisma.rollingDailyCurrentForecastSnapshot.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends RollingDailyCurrentForecastSnapshotFindUniqueArgs>(args: SelectSubset<T, RollingDailyCurrentForecastSnapshotFindUniqueArgs<ExtArgs>>): Prisma__RollingDailyCurrentForecastSnapshotClient<$Result.GetResult<Prisma.$RollingDailyCurrentForecastSnapshotPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one RollingDailyCurrentForecastSnapshot that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {RollingDailyCurrentForecastSnapshotFindUniqueOrThrowArgs} args - Arguments to find a RollingDailyCurrentForecastSnapshot
     * @example
     * // Get one RollingDailyCurrentForecastSnapshot
     * const rollingDailyCurrentForecastSnapshot = await prisma.rollingDailyCurrentForecastSnapshot.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends RollingDailyCurrentForecastSnapshotFindUniqueOrThrowArgs>(args: SelectSubset<T, RollingDailyCurrentForecastSnapshotFindUniqueOrThrowArgs<ExtArgs>>): Prisma__RollingDailyCurrentForecastSnapshotClient<$Result.GetResult<Prisma.$RollingDailyCurrentForecastSnapshotPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first RollingDailyCurrentForecastSnapshot that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyCurrentForecastSnapshotFindFirstArgs} args - Arguments to find a RollingDailyCurrentForecastSnapshot
     * @example
     * // Get one RollingDailyCurrentForecastSnapshot
     * const rollingDailyCurrentForecastSnapshot = await prisma.rollingDailyCurrentForecastSnapshot.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends RollingDailyCurrentForecastSnapshotFindFirstArgs>(args?: SelectSubset<T, RollingDailyCurrentForecastSnapshotFindFirstArgs<ExtArgs>>): Prisma__RollingDailyCurrentForecastSnapshotClient<$Result.GetResult<Prisma.$RollingDailyCurrentForecastSnapshotPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first RollingDailyCurrentForecastSnapshot that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyCurrentForecastSnapshotFindFirstOrThrowArgs} args - Arguments to find a RollingDailyCurrentForecastSnapshot
     * @example
     * // Get one RollingDailyCurrentForecastSnapshot
     * const rollingDailyCurrentForecastSnapshot = await prisma.rollingDailyCurrentForecastSnapshot.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends RollingDailyCurrentForecastSnapshotFindFirstOrThrowArgs>(args?: SelectSubset<T, RollingDailyCurrentForecastSnapshotFindFirstOrThrowArgs<ExtArgs>>): Prisma__RollingDailyCurrentForecastSnapshotClient<$Result.GetResult<Prisma.$RollingDailyCurrentForecastSnapshotPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more RollingDailyCurrentForecastSnapshots that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyCurrentForecastSnapshotFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all RollingDailyCurrentForecastSnapshots
     * const rollingDailyCurrentForecastSnapshots = await prisma.rollingDailyCurrentForecastSnapshot.findMany()
     * 
     * // Get first 10 RollingDailyCurrentForecastSnapshots
     * const rollingDailyCurrentForecastSnapshots = await prisma.rollingDailyCurrentForecastSnapshot.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const rollingDailyCurrentForecastSnapshotWithIdOnly = await prisma.rollingDailyCurrentForecastSnapshot.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends RollingDailyCurrentForecastSnapshotFindManyArgs>(args?: SelectSubset<T, RollingDailyCurrentForecastSnapshotFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RollingDailyCurrentForecastSnapshotPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a RollingDailyCurrentForecastSnapshot.
     * @param {RollingDailyCurrentForecastSnapshotCreateArgs} args - Arguments to create a RollingDailyCurrentForecastSnapshot.
     * @example
     * // Create one RollingDailyCurrentForecastSnapshot
     * const RollingDailyCurrentForecastSnapshot = await prisma.rollingDailyCurrentForecastSnapshot.create({
     *   data: {
     *     // ... data to create a RollingDailyCurrentForecastSnapshot
     *   }
     * })
     * 
     */
    create<T extends RollingDailyCurrentForecastSnapshotCreateArgs>(args: SelectSubset<T, RollingDailyCurrentForecastSnapshotCreateArgs<ExtArgs>>): Prisma__RollingDailyCurrentForecastSnapshotClient<$Result.GetResult<Prisma.$RollingDailyCurrentForecastSnapshotPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many RollingDailyCurrentForecastSnapshots.
     * @param {RollingDailyCurrentForecastSnapshotCreateManyArgs} args - Arguments to create many RollingDailyCurrentForecastSnapshots.
     * @example
     * // Create many RollingDailyCurrentForecastSnapshots
     * const rollingDailyCurrentForecastSnapshot = await prisma.rollingDailyCurrentForecastSnapshot.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends RollingDailyCurrentForecastSnapshotCreateManyArgs>(args?: SelectSubset<T, RollingDailyCurrentForecastSnapshotCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many RollingDailyCurrentForecastSnapshots and returns the data saved in the database.
     * @param {RollingDailyCurrentForecastSnapshotCreateManyAndReturnArgs} args - Arguments to create many RollingDailyCurrentForecastSnapshots.
     * @example
     * // Create many RollingDailyCurrentForecastSnapshots
     * const rollingDailyCurrentForecastSnapshot = await prisma.rollingDailyCurrentForecastSnapshot.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many RollingDailyCurrentForecastSnapshots and only return the `id`
     * const rollingDailyCurrentForecastSnapshotWithIdOnly = await prisma.rollingDailyCurrentForecastSnapshot.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends RollingDailyCurrentForecastSnapshotCreateManyAndReturnArgs>(args?: SelectSubset<T, RollingDailyCurrentForecastSnapshotCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RollingDailyCurrentForecastSnapshotPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a RollingDailyCurrentForecastSnapshot.
     * @param {RollingDailyCurrentForecastSnapshotDeleteArgs} args - Arguments to delete one RollingDailyCurrentForecastSnapshot.
     * @example
     * // Delete one RollingDailyCurrentForecastSnapshot
     * const RollingDailyCurrentForecastSnapshot = await prisma.rollingDailyCurrentForecastSnapshot.delete({
     *   where: {
     *     // ... filter to delete one RollingDailyCurrentForecastSnapshot
     *   }
     * })
     * 
     */
    delete<T extends RollingDailyCurrentForecastSnapshotDeleteArgs>(args: SelectSubset<T, RollingDailyCurrentForecastSnapshotDeleteArgs<ExtArgs>>): Prisma__RollingDailyCurrentForecastSnapshotClient<$Result.GetResult<Prisma.$RollingDailyCurrentForecastSnapshotPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one RollingDailyCurrentForecastSnapshot.
     * @param {RollingDailyCurrentForecastSnapshotUpdateArgs} args - Arguments to update one RollingDailyCurrentForecastSnapshot.
     * @example
     * // Update one RollingDailyCurrentForecastSnapshot
     * const rollingDailyCurrentForecastSnapshot = await prisma.rollingDailyCurrentForecastSnapshot.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends RollingDailyCurrentForecastSnapshotUpdateArgs>(args: SelectSubset<T, RollingDailyCurrentForecastSnapshotUpdateArgs<ExtArgs>>): Prisma__RollingDailyCurrentForecastSnapshotClient<$Result.GetResult<Prisma.$RollingDailyCurrentForecastSnapshotPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more RollingDailyCurrentForecastSnapshots.
     * @param {RollingDailyCurrentForecastSnapshotDeleteManyArgs} args - Arguments to filter RollingDailyCurrentForecastSnapshots to delete.
     * @example
     * // Delete a few RollingDailyCurrentForecastSnapshots
     * const { count } = await prisma.rollingDailyCurrentForecastSnapshot.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends RollingDailyCurrentForecastSnapshotDeleteManyArgs>(args?: SelectSubset<T, RollingDailyCurrentForecastSnapshotDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more RollingDailyCurrentForecastSnapshots.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyCurrentForecastSnapshotUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many RollingDailyCurrentForecastSnapshots
     * const rollingDailyCurrentForecastSnapshot = await prisma.rollingDailyCurrentForecastSnapshot.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends RollingDailyCurrentForecastSnapshotUpdateManyArgs>(args: SelectSubset<T, RollingDailyCurrentForecastSnapshotUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more RollingDailyCurrentForecastSnapshots and returns the data updated in the database.
     * @param {RollingDailyCurrentForecastSnapshotUpdateManyAndReturnArgs} args - Arguments to update many RollingDailyCurrentForecastSnapshots.
     * @example
     * // Update many RollingDailyCurrentForecastSnapshots
     * const rollingDailyCurrentForecastSnapshot = await prisma.rollingDailyCurrentForecastSnapshot.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more RollingDailyCurrentForecastSnapshots and only return the `id`
     * const rollingDailyCurrentForecastSnapshotWithIdOnly = await prisma.rollingDailyCurrentForecastSnapshot.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends RollingDailyCurrentForecastSnapshotUpdateManyAndReturnArgs>(args: SelectSubset<T, RollingDailyCurrentForecastSnapshotUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RollingDailyCurrentForecastSnapshotPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one RollingDailyCurrentForecastSnapshot.
     * @param {RollingDailyCurrentForecastSnapshotUpsertArgs} args - Arguments to update or create a RollingDailyCurrentForecastSnapshot.
     * @example
     * // Update or create a RollingDailyCurrentForecastSnapshot
     * const rollingDailyCurrentForecastSnapshot = await prisma.rollingDailyCurrentForecastSnapshot.upsert({
     *   create: {
     *     // ... data to create a RollingDailyCurrentForecastSnapshot
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the RollingDailyCurrentForecastSnapshot we want to update
     *   }
     * })
     */
    upsert<T extends RollingDailyCurrentForecastSnapshotUpsertArgs>(args: SelectSubset<T, RollingDailyCurrentForecastSnapshotUpsertArgs<ExtArgs>>): Prisma__RollingDailyCurrentForecastSnapshotClient<$Result.GetResult<Prisma.$RollingDailyCurrentForecastSnapshotPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of RollingDailyCurrentForecastSnapshots.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyCurrentForecastSnapshotCountArgs} args - Arguments to filter RollingDailyCurrentForecastSnapshots to count.
     * @example
     * // Count the number of RollingDailyCurrentForecastSnapshots
     * const count = await prisma.rollingDailyCurrentForecastSnapshot.count({
     *   where: {
     *     // ... the filter for the RollingDailyCurrentForecastSnapshots we want to count
     *   }
     * })
    **/
    count<T extends RollingDailyCurrentForecastSnapshotCountArgs>(
      args?: Subset<T, RollingDailyCurrentForecastSnapshotCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], RollingDailyCurrentForecastSnapshotCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a RollingDailyCurrentForecastSnapshot.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyCurrentForecastSnapshotAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends RollingDailyCurrentForecastSnapshotAggregateArgs>(args: Subset<T, RollingDailyCurrentForecastSnapshotAggregateArgs>): Prisma.PrismaPromise<GetRollingDailyCurrentForecastSnapshotAggregateType<T>>

    /**
     * Group by RollingDailyCurrentForecastSnapshot.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyCurrentForecastSnapshotGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends RollingDailyCurrentForecastSnapshotGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: RollingDailyCurrentForecastSnapshotGroupByArgs['orderBy'] }
        : { orderBy?: RollingDailyCurrentForecastSnapshotGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, RollingDailyCurrentForecastSnapshotGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetRollingDailyCurrentForecastSnapshotGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the RollingDailyCurrentForecastSnapshot model
   */
  readonly fields: RollingDailyCurrentForecastSnapshotFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for RollingDailyCurrentForecastSnapshot.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__RollingDailyCurrentForecastSnapshotClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the RollingDailyCurrentForecastSnapshot model
   */
  interface RollingDailyCurrentForecastSnapshotFieldRefs {
    readonly id: FieldRef<"RollingDailyCurrentForecastSnapshot", 'String'>
    readonly seriesId: FieldRef<"RollingDailyCurrentForecastSnapshot", 'String'>
    readonly inputSource: FieldRef<"RollingDailyCurrentForecastSnapshot", 'String'>
    readonly inputRunId: FieldRef<"RollingDailyCurrentForecastSnapshot", 'String'>
    readonly targetBasis: FieldRef<"RollingDailyCurrentForecastSnapshot", 'ForecastTargetBasis'>
    readonly methodId: FieldRef<"RollingDailyCurrentForecastSnapshot", 'String'>
    readonly methodVersion: FieldRef<"RollingDailyCurrentForecastSnapshot", 'String'>
    readonly modelId: FieldRef<"RollingDailyCurrentForecastSnapshot", 'String'>
    readonly contractVersion: FieldRef<"RollingDailyCurrentForecastSnapshot", 'String'>
    readonly status: FieldRef<"RollingDailyCurrentForecastSnapshot", 'String'>
    readonly reasonCode: FieldRef<"RollingDailyCurrentForecastSnapshot", 'String'>
    readonly message: FieldRef<"RollingDailyCurrentForecastSnapshot", 'String'>
    readonly forecastOriginAt: FieldRef<"RollingDailyCurrentForecastSnapshot", 'DateTime'>
    readonly sourceLatestObservationAt: FieldRef<"RollingDailyCurrentForecastSnapshot", 'DateTime'>
    readonly payloadJson: FieldRef<"RollingDailyCurrentForecastSnapshot", 'Json'>
    readonly createdAt: FieldRef<"RollingDailyCurrentForecastSnapshot", 'DateTime'>
    readonly updatedAt: FieldRef<"RollingDailyCurrentForecastSnapshot", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * RollingDailyCurrentForecastSnapshot findUnique
   */
  export type RollingDailyCurrentForecastSnapshotFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyCurrentForecastSnapshot
     */
    select?: RollingDailyCurrentForecastSnapshotSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyCurrentForecastSnapshot
     */
    omit?: RollingDailyCurrentForecastSnapshotOmit<ExtArgs> | null
    /**
     * Filter, which RollingDailyCurrentForecastSnapshot to fetch.
     */
    where: RollingDailyCurrentForecastSnapshotWhereUniqueInput
  }

  /**
   * RollingDailyCurrentForecastSnapshot findUniqueOrThrow
   */
  export type RollingDailyCurrentForecastSnapshotFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyCurrentForecastSnapshot
     */
    select?: RollingDailyCurrentForecastSnapshotSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyCurrentForecastSnapshot
     */
    omit?: RollingDailyCurrentForecastSnapshotOmit<ExtArgs> | null
    /**
     * Filter, which RollingDailyCurrentForecastSnapshot to fetch.
     */
    where: RollingDailyCurrentForecastSnapshotWhereUniqueInput
  }

  /**
   * RollingDailyCurrentForecastSnapshot findFirst
   */
  export type RollingDailyCurrentForecastSnapshotFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyCurrentForecastSnapshot
     */
    select?: RollingDailyCurrentForecastSnapshotSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyCurrentForecastSnapshot
     */
    omit?: RollingDailyCurrentForecastSnapshotOmit<ExtArgs> | null
    /**
     * Filter, which RollingDailyCurrentForecastSnapshot to fetch.
     */
    where?: RollingDailyCurrentForecastSnapshotWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RollingDailyCurrentForecastSnapshots to fetch.
     */
    orderBy?: RollingDailyCurrentForecastSnapshotOrderByWithRelationInput | RollingDailyCurrentForecastSnapshotOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for RollingDailyCurrentForecastSnapshots.
     */
    cursor?: RollingDailyCurrentForecastSnapshotWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RollingDailyCurrentForecastSnapshots from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RollingDailyCurrentForecastSnapshots.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RollingDailyCurrentForecastSnapshots.
     */
    distinct?: RollingDailyCurrentForecastSnapshotScalarFieldEnum | RollingDailyCurrentForecastSnapshotScalarFieldEnum[]
  }

  /**
   * RollingDailyCurrentForecastSnapshot findFirstOrThrow
   */
  export type RollingDailyCurrentForecastSnapshotFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyCurrentForecastSnapshot
     */
    select?: RollingDailyCurrentForecastSnapshotSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyCurrentForecastSnapshot
     */
    omit?: RollingDailyCurrentForecastSnapshotOmit<ExtArgs> | null
    /**
     * Filter, which RollingDailyCurrentForecastSnapshot to fetch.
     */
    where?: RollingDailyCurrentForecastSnapshotWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RollingDailyCurrentForecastSnapshots to fetch.
     */
    orderBy?: RollingDailyCurrentForecastSnapshotOrderByWithRelationInput | RollingDailyCurrentForecastSnapshotOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for RollingDailyCurrentForecastSnapshots.
     */
    cursor?: RollingDailyCurrentForecastSnapshotWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RollingDailyCurrentForecastSnapshots from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RollingDailyCurrentForecastSnapshots.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RollingDailyCurrentForecastSnapshots.
     */
    distinct?: RollingDailyCurrentForecastSnapshotScalarFieldEnum | RollingDailyCurrentForecastSnapshotScalarFieldEnum[]
  }

  /**
   * RollingDailyCurrentForecastSnapshot findMany
   */
  export type RollingDailyCurrentForecastSnapshotFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyCurrentForecastSnapshot
     */
    select?: RollingDailyCurrentForecastSnapshotSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyCurrentForecastSnapshot
     */
    omit?: RollingDailyCurrentForecastSnapshotOmit<ExtArgs> | null
    /**
     * Filter, which RollingDailyCurrentForecastSnapshots to fetch.
     */
    where?: RollingDailyCurrentForecastSnapshotWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RollingDailyCurrentForecastSnapshots to fetch.
     */
    orderBy?: RollingDailyCurrentForecastSnapshotOrderByWithRelationInput | RollingDailyCurrentForecastSnapshotOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing RollingDailyCurrentForecastSnapshots.
     */
    cursor?: RollingDailyCurrentForecastSnapshotWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RollingDailyCurrentForecastSnapshots from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RollingDailyCurrentForecastSnapshots.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RollingDailyCurrentForecastSnapshots.
     */
    distinct?: RollingDailyCurrentForecastSnapshotScalarFieldEnum | RollingDailyCurrentForecastSnapshotScalarFieldEnum[]
  }

  /**
   * RollingDailyCurrentForecastSnapshot create
   */
  export type RollingDailyCurrentForecastSnapshotCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyCurrentForecastSnapshot
     */
    select?: RollingDailyCurrentForecastSnapshotSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyCurrentForecastSnapshot
     */
    omit?: RollingDailyCurrentForecastSnapshotOmit<ExtArgs> | null
    /**
     * The data needed to create a RollingDailyCurrentForecastSnapshot.
     */
    data: XOR<RollingDailyCurrentForecastSnapshotCreateInput, RollingDailyCurrentForecastSnapshotUncheckedCreateInput>
  }

  /**
   * RollingDailyCurrentForecastSnapshot createMany
   */
  export type RollingDailyCurrentForecastSnapshotCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many RollingDailyCurrentForecastSnapshots.
     */
    data: RollingDailyCurrentForecastSnapshotCreateManyInput | RollingDailyCurrentForecastSnapshotCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * RollingDailyCurrentForecastSnapshot createManyAndReturn
   */
  export type RollingDailyCurrentForecastSnapshotCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyCurrentForecastSnapshot
     */
    select?: RollingDailyCurrentForecastSnapshotSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyCurrentForecastSnapshot
     */
    omit?: RollingDailyCurrentForecastSnapshotOmit<ExtArgs> | null
    /**
     * The data used to create many RollingDailyCurrentForecastSnapshots.
     */
    data: RollingDailyCurrentForecastSnapshotCreateManyInput | RollingDailyCurrentForecastSnapshotCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * RollingDailyCurrentForecastSnapshot update
   */
  export type RollingDailyCurrentForecastSnapshotUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyCurrentForecastSnapshot
     */
    select?: RollingDailyCurrentForecastSnapshotSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyCurrentForecastSnapshot
     */
    omit?: RollingDailyCurrentForecastSnapshotOmit<ExtArgs> | null
    /**
     * The data needed to update a RollingDailyCurrentForecastSnapshot.
     */
    data: XOR<RollingDailyCurrentForecastSnapshotUpdateInput, RollingDailyCurrentForecastSnapshotUncheckedUpdateInput>
    /**
     * Choose, which RollingDailyCurrentForecastSnapshot to update.
     */
    where: RollingDailyCurrentForecastSnapshotWhereUniqueInput
  }

  /**
   * RollingDailyCurrentForecastSnapshot updateMany
   */
  export type RollingDailyCurrentForecastSnapshotUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update RollingDailyCurrentForecastSnapshots.
     */
    data: XOR<RollingDailyCurrentForecastSnapshotUpdateManyMutationInput, RollingDailyCurrentForecastSnapshotUncheckedUpdateManyInput>
    /**
     * Filter which RollingDailyCurrentForecastSnapshots to update
     */
    where?: RollingDailyCurrentForecastSnapshotWhereInput
    /**
     * Limit how many RollingDailyCurrentForecastSnapshots to update.
     */
    limit?: number
  }

  /**
   * RollingDailyCurrentForecastSnapshot updateManyAndReturn
   */
  export type RollingDailyCurrentForecastSnapshotUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyCurrentForecastSnapshot
     */
    select?: RollingDailyCurrentForecastSnapshotSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyCurrentForecastSnapshot
     */
    omit?: RollingDailyCurrentForecastSnapshotOmit<ExtArgs> | null
    /**
     * The data used to update RollingDailyCurrentForecastSnapshots.
     */
    data: XOR<RollingDailyCurrentForecastSnapshotUpdateManyMutationInput, RollingDailyCurrentForecastSnapshotUncheckedUpdateManyInput>
    /**
     * Filter which RollingDailyCurrentForecastSnapshots to update
     */
    where?: RollingDailyCurrentForecastSnapshotWhereInput
    /**
     * Limit how many RollingDailyCurrentForecastSnapshots to update.
     */
    limit?: number
  }

  /**
   * RollingDailyCurrentForecastSnapshot upsert
   */
  export type RollingDailyCurrentForecastSnapshotUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyCurrentForecastSnapshot
     */
    select?: RollingDailyCurrentForecastSnapshotSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyCurrentForecastSnapshot
     */
    omit?: RollingDailyCurrentForecastSnapshotOmit<ExtArgs> | null
    /**
     * The filter to search for the RollingDailyCurrentForecastSnapshot to update in case it exists.
     */
    where: RollingDailyCurrentForecastSnapshotWhereUniqueInput
    /**
     * In case the RollingDailyCurrentForecastSnapshot found by the `where` argument doesn't exist, create a new RollingDailyCurrentForecastSnapshot with this data.
     */
    create: XOR<RollingDailyCurrentForecastSnapshotCreateInput, RollingDailyCurrentForecastSnapshotUncheckedCreateInput>
    /**
     * In case the RollingDailyCurrentForecastSnapshot was found with the provided `where` argument, update it with this data.
     */
    update: XOR<RollingDailyCurrentForecastSnapshotUpdateInput, RollingDailyCurrentForecastSnapshotUncheckedUpdateInput>
  }

  /**
   * RollingDailyCurrentForecastSnapshot delete
   */
  export type RollingDailyCurrentForecastSnapshotDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyCurrentForecastSnapshot
     */
    select?: RollingDailyCurrentForecastSnapshotSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyCurrentForecastSnapshot
     */
    omit?: RollingDailyCurrentForecastSnapshotOmit<ExtArgs> | null
    /**
     * Filter which RollingDailyCurrentForecastSnapshot to delete.
     */
    where: RollingDailyCurrentForecastSnapshotWhereUniqueInput
  }

  /**
   * RollingDailyCurrentForecastSnapshot deleteMany
   */
  export type RollingDailyCurrentForecastSnapshotDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which RollingDailyCurrentForecastSnapshots to delete
     */
    where?: RollingDailyCurrentForecastSnapshotWhereInput
    /**
     * Limit how many RollingDailyCurrentForecastSnapshots to delete.
     */
    limit?: number
  }

  /**
   * RollingDailyCurrentForecastSnapshot without action
   */
  export type RollingDailyCurrentForecastSnapshotDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyCurrentForecastSnapshot
     */
    select?: RollingDailyCurrentForecastSnapshotSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyCurrentForecastSnapshot
     */
    omit?: RollingDailyCurrentForecastSnapshotOmit<ExtArgs> | null
  }


  /**
   * Model RollingDailyCalibrationGroup
   */

  export type AggregateRollingDailyCalibrationGroup = {
    _count: RollingDailyCalibrationGroupCountAggregateOutputType | null
    _avg: RollingDailyCalibrationGroupAvgAggregateOutputType | null
    _sum: RollingDailyCalibrationGroupSumAggregateOutputType | null
    _min: RollingDailyCalibrationGroupMinAggregateOutputType | null
    _max: RollingDailyCalibrationGroupMaxAggregateOutputType | null
  }

  export type RollingDailyCalibrationGroupAvgAggregateOutputType = {
    horizonMonths: number | null
    sampleCount: number | null
    residualP10: Decimal | null
    residualP90: Decimal | null
  }

  export type RollingDailyCalibrationGroupSumAggregateOutputType = {
    horizonMonths: number | null
    sampleCount: number | null
    residualP10: Decimal | null
    residualP90: Decimal | null
  }

  export type RollingDailyCalibrationGroupMinAggregateOutputType = {
    id: string | null
    seriesId: string | null
    inputSource: string | null
    inputRunId: string | null
    targetBasis: $Enums.ForecastTargetBasis | null
    methodId: string | null
    methodVersion: string | null
    modelId: string | null
    horizonLabel: string | null
    horizonMonths: number | null
    calibrationOriginAt: Date | null
    sampleCount: number | null
    residualP10: Decimal | null
    residualP90: Decimal | null
    quantileMethod: string | null
    status: $Enums.RollingDailyCalibrationStatus | null
    lastResidualObservedAt: Date | null
    refreshedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type RollingDailyCalibrationGroupMaxAggregateOutputType = {
    id: string | null
    seriesId: string | null
    inputSource: string | null
    inputRunId: string | null
    targetBasis: $Enums.ForecastTargetBasis | null
    methodId: string | null
    methodVersion: string | null
    modelId: string | null
    horizonLabel: string | null
    horizonMonths: number | null
    calibrationOriginAt: Date | null
    sampleCount: number | null
    residualP10: Decimal | null
    residualP90: Decimal | null
    quantileMethod: string | null
    status: $Enums.RollingDailyCalibrationStatus | null
    lastResidualObservedAt: Date | null
    refreshedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type RollingDailyCalibrationGroupCountAggregateOutputType = {
    id: number
    seriesId: number
    inputSource: number
    inputRunId: number
    targetBasis: number
    methodId: number
    methodVersion: number
    modelId: number
    horizonLabel: number
    horizonMonths: number
    calibrationOriginAt: number
    sampleCount: number
    residualP10: number
    residualP90: number
    quantileMethod: number
    status: number
    lastResidualObservedAt: number
    refreshedAt: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type RollingDailyCalibrationGroupAvgAggregateInputType = {
    horizonMonths?: true
    sampleCount?: true
    residualP10?: true
    residualP90?: true
  }

  export type RollingDailyCalibrationGroupSumAggregateInputType = {
    horizonMonths?: true
    sampleCount?: true
    residualP10?: true
    residualP90?: true
  }

  export type RollingDailyCalibrationGroupMinAggregateInputType = {
    id?: true
    seriesId?: true
    inputSource?: true
    inputRunId?: true
    targetBasis?: true
    methodId?: true
    methodVersion?: true
    modelId?: true
    horizonLabel?: true
    horizonMonths?: true
    calibrationOriginAt?: true
    sampleCount?: true
    residualP10?: true
    residualP90?: true
    quantileMethod?: true
    status?: true
    lastResidualObservedAt?: true
    refreshedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type RollingDailyCalibrationGroupMaxAggregateInputType = {
    id?: true
    seriesId?: true
    inputSource?: true
    inputRunId?: true
    targetBasis?: true
    methodId?: true
    methodVersion?: true
    modelId?: true
    horizonLabel?: true
    horizonMonths?: true
    calibrationOriginAt?: true
    sampleCount?: true
    residualP10?: true
    residualP90?: true
    quantileMethod?: true
    status?: true
    lastResidualObservedAt?: true
    refreshedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type RollingDailyCalibrationGroupCountAggregateInputType = {
    id?: true
    seriesId?: true
    inputSource?: true
    inputRunId?: true
    targetBasis?: true
    methodId?: true
    methodVersion?: true
    modelId?: true
    horizonLabel?: true
    horizonMonths?: true
    calibrationOriginAt?: true
    sampleCount?: true
    residualP10?: true
    residualP90?: true
    quantileMethod?: true
    status?: true
    lastResidualObservedAt?: true
    refreshedAt?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type RollingDailyCalibrationGroupAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which RollingDailyCalibrationGroup to aggregate.
     */
    where?: RollingDailyCalibrationGroupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RollingDailyCalibrationGroups to fetch.
     */
    orderBy?: RollingDailyCalibrationGroupOrderByWithRelationInput | RollingDailyCalibrationGroupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: RollingDailyCalibrationGroupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RollingDailyCalibrationGroups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RollingDailyCalibrationGroups.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned RollingDailyCalibrationGroups
    **/
    _count?: true | RollingDailyCalibrationGroupCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: RollingDailyCalibrationGroupAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: RollingDailyCalibrationGroupSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: RollingDailyCalibrationGroupMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: RollingDailyCalibrationGroupMaxAggregateInputType
  }

  export type GetRollingDailyCalibrationGroupAggregateType<T extends RollingDailyCalibrationGroupAggregateArgs> = {
        [P in keyof T & keyof AggregateRollingDailyCalibrationGroup]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateRollingDailyCalibrationGroup[P]>
      : GetScalarType<T[P], AggregateRollingDailyCalibrationGroup[P]>
  }




  export type RollingDailyCalibrationGroupGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: RollingDailyCalibrationGroupWhereInput
    orderBy?: RollingDailyCalibrationGroupOrderByWithAggregationInput | RollingDailyCalibrationGroupOrderByWithAggregationInput[]
    by: RollingDailyCalibrationGroupScalarFieldEnum[] | RollingDailyCalibrationGroupScalarFieldEnum
    having?: RollingDailyCalibrationGroupScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: RollingDailyCalibrationGroupCountAggregateInputType | true
    _avg?: RollingDailyCalibrationGroupAvgAggregateInputType
    _sum?: RollingDailyCalibrationGroupSumAggregateInputType
    _min?: RollingDailyCalibrationGroupMinAggregateInputType
    _max?: RollingDailyCalibrationGroupMaxAggregateInputType
  }

  export type RollingDailyCalibrationGroupGroupByOutputType = {
    id: string
    seriesId: string
    inputSource: string
    inputRunId: string | null
    targetBasis: $Enums.ForecastTargetBasis
    methodId: string
    methodVersion: string
    modelId: string
    horizonLabel: string
    horizonMonths: number
    calibrationOriginAt: Date
    sampleCount: number
    residualP10: Decimal | null
    residualP90: Decimal | null
    quantileMethod: string
    status: $Enums.RollingDailyCalibrationStatus
    lastResidualObservedAt: Date | null
    refreshedAt: Date
    createdAt: Date
    updatedAt: Date
    _count: RollingDailyCalibrationGroupCountAggregateOutputType | null
    _avg: RollingDailyCalibrationGroupAvgAggregateOutputType | null
    _sum: RollingDailyCalibrationGroupSumAggregateOutputType | null
    _min: RollingDailyCalibrationGroupMinAggregateOutputType | null
    _max: RollingDailyCalibrationGroupMaxAggregateOutputType | null
  }

  type GetRollingDailyCalibrationGroupGroupByPayload<T extends RollingDailyCalibrationGroupGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<RollingDailyCalibrationGroupGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof RollingDailyCalibrationGroupGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], RollingDailyCalibrationGroupGroupByOutputType[P]>
            : GetScalarType<T[P], RollingDailyCalibrationGroupGroupByOutputType[P]>
        }
      >
    >


  export type RollingDailyCalibrationGroupSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    seriesId?: boolean
    inputSource?: boolean
    inputRunId?: boolean
    targetBasis?: boolean
    methodId?: boolean
    methodVersion?: boolean
    modelId?: boolean
    horizonLabel?: boolean
    horizonMonths?: boolean
    calibrationOriginAt?: boolean
    sampleCount?: boolean
    residualP10?: boolean
    residualP90?: boolean
    quantileMethod?: boolean
    status?: boolean
    lastResidualObservedAt?: boolean
    refreshedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["rollingDailyCalibrationGroup"]>

  export type RollingDailyCalibrationGroupSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    seriesId?: boolean
    inputSource?: boolean
    inputRunId?: boolean
    targetBasis?: boolean
    methodId?: boolean
    methodVersion?: boolean
    modelId?: boolean
    horizonLabel?: boolean
    horizonMonths?: boolean
    calibrationOriginAt?: boolean
    sampleCount?: boolean
    residualP10?: boolean
    residualP90?: boolean
    quantileMethod?: boolean
    status?: boolean
    lastResidualObservedAt?: boolean
    refreshedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["rollingDailyCalibrationGroup"]>

  export type RollingDailyCalibrationGroupSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    seriesId?: boolean
    inputSource?: boolean
    inputRunId?: boolean
    targetBasis?: boolean
    methodId?: boolean
    methodVersion?: boolean
    modelId?: boolean
    horizonLabel?: boolean
    horizonMonths?: boolean
    calibrationOriginAt?: boolean
    sampleCount?: boolean
    residualP10?: boolean
    residualP90?: boolean
    quantileMethod?: boolean
    status?: boolean
    lastResidualObservedAt?: boolean
    refreshedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["rollingDailyCalibrationGroup"]>

  export type RollingDailyCalibrationGroupSelectScalar = {
    id?: boolean
    seriesId?: boolean
    inputSource?: boolean
    inputRunId?: boolean
    targetBasis?: boolean
    methodId?: boolean
    methodVersion?: boolean
    modelId?: boolean
    horizonLabel?: boolean
    horizonMonths?: boolean
    calibrationOriginAt?: boolean
    sampleCount?: boolean
    residualP10?: boolean
    residualP90?: boolean
    quantileMethod?: boolean
    status?: boolean
    lastResidualObservedAt?: boolean
    refreshedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type RollingDailyCalibrationGroupOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "seriesId" | "inputSource" | "inputRunId" | "targetBasis" | "methodId" | "methodVersion" | "modelId" | "horizonLabel" | "horizonMonths" | "calibrationOriginAt" | "sampleCount" | "residualP10" | "residualP90" | "quantileMethod" | "status" | "lastResidualObservedAt" | "refreshedAt" | "createdAt" | "updatedAt", ExtArgs["result"]["rollingDailyCalibrationGroup"]>

  export type $RollingDailyCalibrationGroupPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "RollingDailyCalibrationGroup"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      seriesId: string
      inputSource: string
      inputRunId: string | null
      targetBasis: $Enums.ForecastTargetBasis
      methodId: string
      methodVersion: string
      modelId: string
      horizonLabel: string
      horizonMonths: number
      calibrationOriginAt: Date
      sampleCount: number
      residualP10: Prisma.Decimal | null
      residualP90: Prisma.Decimal | null
      quantileMethod: string
      status: $Enums.RollingDailyCalibrationStatus
      lastResidualObservedAt: Date | null
      refreshedAt: Date
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["rollingDailyCalibrationGroup"]>
    composites: {}
  }

  type RollingDailyCalibrationGroupGetPayload<S extends boolean | null | undefined | RollingDailyCalibrationGroupDefaultArgs> = $Result.GetResult<Prisma.$RollingDailyCalibrationGroupPayload, S>

  type RollingDailyCalibrationGroupCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<RollingDailyCalibrationGroupFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: RollingDailyCalibrationGroupCountAggregateInputType | true
    }

  export interface RollingDailyCalibrationGroupDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['RollingDailyCalibrationGroup'], meta: { name: 'RollingDailyCalibrationGroup' } }
    /**
     * Find zero or one RollingDailyCalibrationGroup that matches the filter.
     * @param {RollingDailyCalibrationGroupFindUniqueArgs} args - Arguments to find a RollingDailyCalibrationGroup
     * @example
     * // Get one RollingDailyCalibrationGroup
     * const rollingDailyCalibrationGroup = await prisma.rollingDailyCalibrationGroup.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends RollingDailyCalibrationGroupFindUniqueArgs>(args: SelectSubset<T, RollingDailyCalibrationGroupFindUniqueArgs<ExtArgs>>): Prisma__RollingDailyCalibrationGroupClient<$Result.GetResult<Prisma.$RollingDailyCalibrationGroupPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one RollingDailyCalibrationGroup that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {RollingDailyCalibrationGroupFindUniqueOrThrowArgs} args - Arguments to find a RollingDailyCalibrationGroup
     * @example
     * // Get one RollingDailyCalibrationGroup
     * const rollingDailyCalibrationGroup = await prisma.rollingDailyCalibrationGroup.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends RollingDailyCalibrationGroupFindUniqueOrThrowArgs>(args: SelectSubset<T, RollingDailyCalibrationGroupFindUniqueOrThrowArgs<ExtArgs>>): Prisma__RollingDailyCalibrationGroupClient<$Result.GetResult<Prisma.$RollingDailyCalibrationGroupPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first RollingDailyCalibrationGroup that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyCalibrationGroupFindFirstArgs} args - Arguments to find a RollingDailyCalibrationGroup
     * @example
     * // Get one RollingDailyCalibrationGroup
     * const rollingDailyCalibrationGroup = await prisma.rollingDailyCalibrationGroup.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends RollingDailyCalibrationGroupFindFirstArgs>(args?: SelectSubset<T, RollingDailyCalibrationGroupFindFirstArgs<ExtArgs>>): Prisma__RollingDailyCalibrationGroupClient<$Result.GetResult<Prisma.$RollingDailyCalibrationGroupPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first RollingDailyCalibrationGroup that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyCalibrationGroupFindFirstOrThrowArgs} args - Arguments to find a RollingDailyCalibrationGroup
     * @example
     * // Get one RollingDailyCalibrationGroup
     * const rollingDailyCalibrationGroup = await prisma.rollingDailyCalibrationGroup.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends RollingDailyCalibrationGroupFindFirstOrThrowArgs>(args?: SelectSubset<T, RollingDailyCalibrationGroupFindFirstOrThrowArgs<ExtArgs>>): Prisma__RollingDailyCalibrationGroupClient<$Result.GetResult<Prisma.$RollingDailyCalibrationGroupPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more RollingDailyCalibrationGroups that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyCalibrationGroupFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all RollingDailyCalibrationGroups
     * const rollingDailyCalibrationGroups = await prisma.rollingDailyCalibrationGroup.findMany()
     * 
     * // Get first 10 RollingDailyCalibrationGroups
     * const rollingDailyCalibrationGroups = await prisma.rollingDailyCalibrationGroup.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const rollingDailyCalibrationGroupWithIdOnly = await prisma.rollingDailyCalibrationGroup.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends RollingDailyCalibrationGroupFindManyArgs>(args?: SelectSubset<T, RollingDailyCalibrationGroupFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RollingDailyCalibrationGroupPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a RollingDailyCalibrationGroup.
     * @param {RollingDailyCalibrationGroupCreateArgs} args - Arguments to create a RollingDailyCalibrationGroup.
     * @example
     * // Create one RollingDailyCalibrationGroup
     * const RollingDailyCalibrationGroup = await prisma.rollingDailyCalibrationGroup.create({
     *   data: {
     *     // ... data to create a RollingDailyCalibrationGroup
     *   }
     * })
     * 
     */
    create<T extends RollingDailyCalibrationGroupCreateArgs>(args: SelectSubset<T, RollingDailyCalibrationGroupCreateArgs<ExtArgs>>): Prisma__RollingDailyCalibrationGroupClient<$Result.GetResult<Prisma.$RollingDailyCalibrationGroupPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many RollingDailyCalibrationGroups.
     * @param {RollingDailyCalibrationGroupCreateManyArgs} args - Arguments to create many RollingDailyCalibrationGroups.
     * @example
     * // Create many RollingDailyCalibrationGroups
     * const rollingDailyCalibrationGroup = await prisma.rollingDailyCalibrationGroup.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends RollingDailyCalibrationGroupCreateManyArgs>(args?: SelectSubset<T, RollingDailyCalibrationGroupCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many RollingDailyCalibrationGroups and returns the data saved in the database.
     * @param {RollingDailyCalibrationGroupCreateManyAndReturnArgs} args - Arguments to create many RollingDailyCalibrationGroups.
     * @example
     * // Create many RollingDailyCalibrationGroups
     * const rollingDailyCalibrationGroup = await prisma.rollingDailyCalibrationGroup.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many RollingDailyCalibrationGroups and only return the `id`
     * const rollingDailyCalibrationGroupWithIdOnly = await prisma.rollingDailyCalibrationGroup.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends RollingDailyCalibrationGroupCreateManyAndReturnArgs>(args?: SelectSubset<T, RollingDailyCalibrationGroupCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RollingDailyCalibrationGroupPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a RollingDailyCalibrationGroup.
     * @param {RollingDailyCalibrationGroupDeleteArgs} args - Arguments to delete one RollingDailyCalibrationGroup.
     * @example
     * // Delete one RollingDailyCalibrationGroup
     * const RollingDailyCalibrationGroup = await prisma.rollingDailyCalibrationGroup.delete({
     *   where: {
     *     // ... filter to delete one RollingDailyCalibrationGroup
     *   }
     * })
     * 
     */
    delete<T extends RollingDailyCalibrationGroupDeleteArgs>(args: SelectSubset<T, RollingDailyCalibrationGroupDeleteArgs<ExtArgs>>): Prisma__RollingDailyCalibrationGroupClient<$Result.GetResult<Prisma.$RollingDailyCalibrationGroupPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one RollingDailyCalibrationGroup.
     * @param {RollingDailyCalibrationGroupUpdateArgs} args - Arguments to update one RollingDailyCalibrationGroup.
     * @example
     * // Update one RollingDailyCalibrationGroup
     * const rollingDailyCalibrationGroup = await prisma.rollingDailyCalibrationGroup.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends RollingDailyCalibrationGroupUpdateArgs>(args: SelectSubset<T, RollingDailyCalibrationGroupUpdateArgs<ExtArgs>>): Prisma__RollingDailyCalibrationGroupClient<$Result.GetResult<Prisma.$RollingDailyCalibrationGroupPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more RollingDailyCalibrationGroups.
     * @param {RollingDailyCalibrationGroupDeleteManyArgs} args - Arguments to filter RollingDailyCalibrationGroups to delete.
     * @example
     * // Delete a few RollingDailyCalibrationGroups
     * const { count } = await prisma.rollingDailyCalibrationGroup.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends RollingDailyCalibrationGroupDeleteManyArgs>(args?: SelectSubset<T, RollingDailyCalibrationGroupDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more RollingDailyCalibrationGroups.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyCalibrationGroupUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many RollingDailyCalibrationGroups
     * const rollingDailyCalibrationGroup = await prisma.rollingDailyCalibrationGroup.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends RollingDailyCalibrationGroupUpdateManyArgs>(args: SelectSubset<T, RollingDailyCalibrationGroupUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more RollingDailyCalibrationGroups and returns the data updated in the database.
     * @param {RollingDailyCalibrationGroupUpdateManyAndReturnArgs} args - Arguments to update many RollingDailyCalibrationGroups.
     * @example
     * // Update many RollingDailyCalibrationGroups
     * const rollingDailyCalibrationGroup = await prisma.rollingDailyCalibrationGroup.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more RollingDailyCalibrationGroups and only return the `id`
     * const rollingDailyCalibrationGroupWithIdOnly = await prisma.rollingDailyCalibrationGroup.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends RollingDailyCalibrationGroupUpdateManyAndReturnArgs>(args: SelectSubset<T, RollingDailyCalibrationGroupUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RollingDailyCalibrationGroupPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one RollingDailyCalibrationGroup.
     * @param {RollingDailyCalibrationGroupUpsertArgs} args - Arguments to update or create a RollingDailyCalibrationGroup.
     * @example
     * // Update or create a RollingDailyCalibrationGroup
     * const rollingDailyCalibrationGroup = await prisma.rollingDailyCalibrationGroup.upsert({
     *   create: {
     *     // ... data to create a RollingDailyCalibrationGroup
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the RollingDailyCalibrationGroup we want to update
     *   }
     * })
     */
    upsert<T extends RollingDailyCalibrationGroupUpsertArgs>(args: SelectSubset<T, RollingDailyCalibrationGroupUpsertArgs<ExtArgs>>): Prisma__RollingDailyCalibrationGroupClient<$Result.GetResult<Prisma.$RollingDailyCalibrationGroupPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of RollingDailyCalibrationGroups.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyCalibrationGroupCountArgs} args - Arguments to filter RollingDailyCalibrationGroups to count.
     * @example
     * // Count the number of RollingDailyCalibrationGroups
     * const count = await prisma.rollingDailyCalibrationGroup.count({
     *   where: {
     *     // ... the filter for the RollingDailyCalibrationGroups we want to count
     *   }
     * })
    **/
    count<T extends RollingDailyCalibrationGroupCountArgs>(
      args?: Subset<T, RollingDailyCalibrationGroupCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], RollingDailyCalibrationGroupCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a RollingDailyCalibrationGroup.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyCalibrationGroupAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends RollingDailyCalibrationGroupAggregateArgs>(args: Subset<T, RollingDailyCalibrationGroupAggregateArgs>): Prisma.PrismaPromise<GetRollingDailyCalibrationGroupAggregateType<T>>

    /**
     * Group by RollingDailyCalibrationGroup.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyCalibrationGroupGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends RollingDailyCalibrationGroupGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: RollingDailyCalibrationGroupGroupByArgs['orderBy'] }
        : { orderBy?: RollingDailyCalibrationGroupGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, RollingDailyCalibrationGroupGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetRollingDailyCalibrationGroupGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the RollingDailyCalibrationGroup model
   */
  readonly fields: RollingDailyCalibrationGroupFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for RollingDailyCalibrationGroup.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__RollingDailyCalibrationGroupClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the RollingDailyCalibrationGroup model
   */
  interface RollingDailyCalibrationGroupFieldRefs {
    readonly id: FieldRef<"RollingDailyCalibrationGroup", 'String'>
    readonly seriesId: FieldRef<"RollingDailyCalibrationGroup", 'String'>
    readonly inputSource: FieldRef<"RollingDailyCalibrationGroup", 'String'>
    readonly inputRunId: FieldRef<"RollingDailyCalibrationGroup", 'String'>
    readonly targetBasis: FieldRef<"RollingDailyCalibrationGroup", 'ForecastTargetBasis'>
    readonly methodId: FieldRef<"RollingDailyCalibrationGroup", 'String'>
    readonly methodVersion: FieldRef<"RollingDailyCalibrationGroup", 'String'>
    readonly modelId: FieldRef<"RollingDailyCalibrationGroup", 'String'>
    readonly horizonLabel: FieldRef<"RollingDailyCalibrationGroup", 'String'>
    readonly horizonMonths: FieldRef<"RollingDailyCalibrationGroup", 'Int'>
    readonly calibrationOriginAt: FieldRef<"RollingDailyCalibrationGroup", 'DateTime'>
    readonly sampleCount: FieldRef<"RollingDailyCalibrationGroup", 'Int'>
    readonly residualP10: FieldRef<"RollingDailyCalibrationGroup", 'Decimal'>
    readonly residualP90: FieldRef<"RollingDailyCalibrationGroup", 'Decimal'>
    readonly quantileMethod: FieldRef<"RollingDailyCalibrationGroup", 'String'>
    readonly status: FieldRef<"RollingDailyCalibrationGroup", 'RollingDailyCalibrationStatus'>
    readonly lastResidualObservedAt: FieldRef<"RollingDailyCalibrationGroup", 'DateTime'>
    readonly refreshedAt: FieldRef<"RollingDailyCalibrationGroup", 'DateTime'>
    readonly createdAt: FieldRef<"RollingDailyCalibrationGroup", 'DateTime'>
    readonly updatedAt: FieldRef<"RollingDailyCalibrationGroup", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * RollingDailyCalibrationGroup findUnique
   */
  export type RollingDailyCalibrationGroupFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyCalibrationGroup
     */
    select?: RollingDailyCalibrationGroupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyCalibrationGroup
     */
    omit?: RollingDailyCalibrationGroupOmit<ExtArgs> | null
    /**
     * Filter, which RollingDailyCalibrationGroup to fetch.
     */
    where: RollingDailyCalibrationGroupWhereUniqueInput
  }

  /**
   * RollingDailyCalibrationGroup findUniqueOrThrow
   */
  export type RollingDailyCalibrationGroupFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyCalibrationGroup
     */
    select?: RollingDailyCalibrationGroupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyCalibrationGroup
     */
    omit?: RollingDailyCalibrationGroupOmit<ExtArgs> | null
    /**
     * Filter, which RollingDailyCalibrationGroup to fetch.
     */
    where: RollingDailyCalibrationGroupWhereUniqueInput
  }

  /**
   * RollingDailyCalibrationGroup findFirst
   */
  export type RollingDailyCalibrationGroupFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyCalibrationGroup
     */
    select?: RollingDailyCalibrationGroupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyCalibrationGroup
     */
    omit?: RollingDailyCalibrationGroupOmit<ExtArgs> | null
    /**
     * Filter, which RollingDailyCalibrationGroup to fetch.
     */
    where?: RollingDailyCalibrationGroupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RollingDailyCalibrationGroups to fetch.
     */
    orderBy?: RollingDailyCalibrationGroupOrderByWithRelationInput | RollingDailyCalibrationGroupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for RollingDailyCalibrationGroups.
     */
    cursor?: RollingDailyCalibrationGroupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RollingDailyCalibrationGroups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RollingDailyCalibrationGroups.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RollingDailyCalibrationGroups.
     */
    distinct?: RollingDailyCalibrationGroupScalarFieldEnum | RollingDailyCalibrationGroupScalarFieldEnum[]
  }

  /**
   * RollingDailyCalibrationGroup findFirstOrThrow
   */
  export type RollingDailyCalibrationGroupFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyCalibrationGroup
     */
    select?: RollingDailyCalibrationGroupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyCalibrationGroup
     */
    omit?: RollingDailyCalibrationGroupOmit<ExtArgs> | null
    /**
     * Filter, which RollingDailyCalibrationGroup to fetch.
     */
    where?: RollingDailyCalibrationGroupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RollingDailyCalibrationGroups to fetch.
     */
    orderBy?: RollingDailyCalibrationGroupOrderByWithRelationInput | RollingDailyCalibrationGroupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for RollingDailyCalibrationGroups.
     */
    cursor?: RollingDailyCalibrationGroupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RollingDailyCalibrationGroups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RollingDailyCalibrationGroups.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RollingDailyCalibrationGroups.
     */
    distinct?: RollingDailyCalibrationGroupScalarFieldEnum | RollingDailyCalibrationGroupScalarFieldEnum[]
  }

  /**
   * RollingDailyCalibrationGroup findMany
   */
  export type RollingDailyCalibrationGroupFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyCalibrationGroup
     */
    select?: RollingDailyCalibrationGroupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyCalibrationGroup
     */
    omit?: RollingDailyCalibrationGroupOmit<ExtArgs> | null
    /**
     * Filter, which RollingDailyCalibrationGroups to fetch.
     */
    where?: RollingDailyCalibrationGroupWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RollingDailyCalibrationGroups to fetch.
     */
    orderBy?: RollingDailyCalibrationGroupOrderByWithRelationInput | RollingDailyCalibrationGroupOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing RollingDailyCalibrationGroups.
     */
    cursor?: RollingDailyCalibrationGroupWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RollingDailyCalibrationGroups from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RollingDailyCalibrationGroups.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RollingDailyCalibrationGroups.
     */
    distinct?: RollingDailyCalibrationGroupScalarFieldEnum | RollingDailyCalibrationGroupScalarFieldEnum[]
  }

  /**
   * RollingDailyCalibrationGroup create
   */
  export type RollingDailyCalibrationGroupCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyCalibrationGroup
     */
    select?: RollingDailyCalibrationGroupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyCalibrationGroup
     */
    omit?: RollingDailyCalibrationGroupOmit<ExtArgs> | null
    /**
     * The data needed to create a RollingDailyCalibrationGroup.
     */
    data: XOR<RollingDailyCalibrationGroupCreateInput, RollingDailyCalibrationGroupUncheckedCreateInput>
  }

  /**
   * RollingDailyCalibrationGroup createMany
   */
  export type RollingDailyCalibrationGroupCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many RollingDailyCalibrationGroups.
     */
    data: RollingDailyCalibrationGroupCreateManyInput | RollingDailyCalibrationGroupCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * RollingDailyCalibrationGroup createManyAndReturn
   */
  export type RollingDailyCalibrationGroupCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyCalibrationGroup
     */
    select?: RollingDailyCalibrationGroupSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyCalibrationGroup
     */
    omit?: RollingDailyCalibrationGroupOmit<ExtArgs> | null
    /**
     * The data used to create many RollingDailyCalibrationGroups.
     */
    data: RollingDailyCalibrationGroupCreateManyInput | RollingDailyCalibrationGroupCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * RollingDailyCalibrationGroup update
   */
  export type RollingDailyCalibrationGroupUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyCalibrationGroup
     */
    select?: RollingDailyCalibrationGroupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyCalibrationGroup
     */
    omit?: RollingDailyCalibrationGroupOmit<ExtArgs> | null
    /**
     * The data needed to update a RollingDailyCalibrationGroup.
     */
    data: XOR<RollingDailyCalibrationGroupUpdateInput, RollingDailyCalibrationGroupUncheckedUpdateInput>
    /**
     * Choose, which RollingDailyCalibrationGroup to update.
     */
    where: RollingDailyCalibrationGroupWhereUniqueInput
  }

  /**
   * RollingDailyCalibrationGroup updateMany
   */
  export type RollingDailyCalibrationGroupUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update RollingDailyCalibrationGroups.
     */
    data: XOR<RollingDailyCalibrationGroupUpdateManyMutationInput, RollingDailyCalibrationGroupUncheckedUpdateManyInput>
    /**
     * Filter which RollingDailyCalibrationGroups to update
     */
    where?: RollingDailyCalibrationGroupWhereInput
    /**
     * Limit how many RollingDailyCalibrationGroups to update.
     */
    limit?: number
  }

  /**
   * RollingDailyCalibrationGroup updateManyAndReturn
   */
  export type RollingDailyCalibrationGroupUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyCalibrationGroup
     */
    select?: RollingDailyCalibrationGroupSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyCalibrationGroup
     */
    omit?: RollingDailyCalibrationGroupOmit<ExtArgs> | null
    /**
     * The data used to update RollingDailyCalibrationGroups.
     */
    data: XOR<RollingDailyCalibrationGroupUpdateManyMutationInput, RollingDailyCalibrationGroupUncheckedUpdateManyInput>
    /**
     * Filter which RollingDailyCalibrationGroups to update
     */
    where?: RollingDailyCalibrationGroupWhereInput
    /**
     * Limit how many RollingDailyCalibrationGroups to update.
     */
    limit?: number
  }

  /**
   * RollingDailyCalibrationGroup upsert
   */
  export type RollingDailyCalibrationGroupUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyCalibrationGroup
     */
    select?: RollingDailyCalibrationGroupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyCalibrationGroup
     */
    omit?: RollingDailyCalibrationGroupOmit<ExtArgs> | null
    /**
     * The filter to search for the RollingDailyCalibrationGroup to update in case it exists.
     */
    where: RollingDailyCalibrationGroupWhereUniqueInput
    /**
     * In case the RollingDailyCalibrationGroup found by the `where` argument doesn't exist, create a new RollingDailyCalibrationGroup with this data.
     */
    create: XOR<RollingDailyCalibrationGroupCreateInput, RollingDailyCalibrationGroupUncheckedCreateInput>
    /**
     * In case the RollingDailyCalibrationGroup was found with the provided `where` argument, update it with this data.
     */
    update: XOR<RollingDailyCalibrationGroupUpdateInput, RollingDailyCalibrationGroupUncheckedUpdateInput>
  }

  /**
   * RollingDailyCalibrationGroup delete
   */
  export type RollingDailyCalibrationGroupDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyCalibrationGroup
     */
    select?: RollingDailyCalibrationGroupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyCalibrationGroup
     */
    omit?: RollingDailyCalibrationGroupOmit<ExtArgs> | null
    /**
     * Filter which RollingDailyCalibrationGroup to delete.
     */
    where: RollingDailyCalibrationGroupWhereUniqueInput
  }

  /**
   * RollingDailyCalibrationGroup deleteMany
   */
  export type RollingDailyCalibrationGroupDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which RollingDailyCalibrationGroups to delete
     */
    where?: RollingDailyCalibrationGroupWhereInput
    /**
     * Limit how many RollingDailyCalibrationGroups to delete.
     */
    limit?: number
  }

  /**
   * RollingDailyCalibrationGroup without action
   */
  export type RollingDailyCalibrationGroupDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyCalibrationGroup
     */
    select?: RollingDailyCalibrationGroupSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyCalibrationGroup
     */
    omit?: RollingDailyCalibrationGroupOmit<ExtArgs> | null
  }


  /**
   * Model RollingDailyMaintenanceState
   */

  export type AggregateRollingDailyMaintenanceState = {
    _count: RollingDailyMaintenanceStateCountAggregateOutputType | null
    _avg: RollingDailyMaintenanceStateAvgAggregateOutputType | null
    _sum: RollingDailyMaintenanceStateSumAggregateOutputType | null
    _min: RollingDailyMaintenanceStateMinAggregateOutputType | null
    _max: RollingDailyMaintenanceStateMaxAggregateOutputType | null
  }

  export type RollingDailyMaintenanceStateAvgAggregateOutputType = {
    minimumTrainingObservations: number | null
    minimumCalibrationSamples: number | null
    latestSourceObservationCount: number | null
  }

  export type RollingDailyMaintenanceStateSumAggregateOutputType = {
    minimumTrainingObservations: number | null
    minimumCalibrationSamples: number | null
    latestSourceObservationCount: number | null
  }

  export type RollingDailyMaintenanceStateMinAggregateOutputType = {
    id: string | null
    seriesId: string | null
    inputSource: string | null
    inputRunId: string | null
    targetBasis: $Enums.ForecastTargetBasis | null
    methodId: string | null
    methodVersion: string | null
    modelId: string | null
    historicalOriginStartAt: Date | null
    minimumTrainingObservations: number | null
    minimumCalibrationSamples: number | null
    latestSourceObservationAt: Date | null
    latestSourceHistoryStartAt: Date | null
    latestSourceObservationCount: number | null
    latestSourceHistoryFingerprint: string | null
    lastProcessedOriginAt: Date | null
    lastMaturedObservedAt: Date | null
    lastMaintenanceAt: Date | null
    lastMaintenanceStatus: string | null
    lastFailureReason: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type RollingDailyMaintenanceStateMaxAggregateOutputType = {
    id: string | null
    seriesId: string | null
    inputSource: string | null
    inputRunId: string | null
    targetBasis: $Enums.ForecastTargetBasis | null
    methodId: string | null
    methodVersion: string | null
    modelId: string | null
    historicalOriginStartAt: Date | null
    minimumTrainingObservations: number | null
    minimumCalibrationSamples: number | null
    latestSourceObservationAt: Date | null
    latestSourceHistoryStartAt: Date | null
    latestSourceObservationCount: number | null
    latestSourceHistoryFingerprint: string | null
    lastProcessedOriginAt: Date | null
    lastMaturedObservedAt: Date | null
    lastMaintenanceAt: Date | null
    lastMaintenanceStatus: string | null
    lastFailureReason: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type RollingDailyMaintenanceStateCountAggregateOutputType = {
    id: number
    seriesId: number
    inputSource: number
    inputRunId: number
    targetBasis: number
    methodId: number
    methodVersion: number
    modelId: number
    historicalOriginStartAt: number
    minimumTrainingObservations: number
    minimumCalibrationSamples: number
    latestSourceObservationAt: number
    latestSourceHistoryStartAt: number
    latestSourceObservationCount: number
    latestSourceHistoryFingerprint: number
    lastProcessedOriginAt: number
    lastMaturedObservedAt: number
    lastMaintenanceAt: number
    lastMaintenanceStatus: number
    lastFailureReason: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type RollingDailyMaintenanceStateAvgAggregateInputType = {
    minimumTrainingObservations?: true
    minimumCalibrationSamples?: true
    latestSourceObservationCount?: true
  }

  export type RollingDailyMaintenanceStateSumAggregateInputType = {
    minimumTrainingObservations?: true
    minimumCalibrationSamples?: true
    latestSourceObservationCount?: true
  }

  export type RollingDailyMaintenanceStateMinAggregateInputType = {
    id?: true
    seriesId?: true
    inputSource?: true
    inputRunId?: true
    targetBasis?: true
    methodId?: true
    methodVersion?: true
    modelId?: true
    historicalOriginStartAt?: true
    minimumTrainingObservations?: true
    minimumCalibrationSamples?: true
    latestSourceObservationAt?: true
    latestSourceHistoryStartAt?: true
    latestSourceObservationCount?: true
    latestSourceHistoryFingerprint?: true
    lastProcessedOriginAt?: true
    lastMaturedObservedAt?: true
    lastMaintenanceAt?: true
    lastMaintenanceStatus?: true
    lastFailureReason?: true
    createdAt?: true
    updatedAt?: true
  }

  export type RollingDailyMaintenanceStateMaxAggregateInputType = {
    id?: true
    seriesId?: true
    inputSource?: true
    inputRunId?: true
    targetBasis?: true
    methodId?: true
    methodVersion?: true
    modelId?: true
    historicalOriginStartAt?: true
    minimumTrainingObservations?: true
    minimumCalibrationSamples?: true
    latestSourceObservationAt?: true
    latestSourceHistoryStartAt?: true
    latestSourceObservationCount?: true
    latestSourceHistoryFingerprint?: true
    lastProcessedOriginAt?: true
    lastMaturedObservedAt?: true
    lastMaintenanceAt?: true
    lastMaintenanceStatus?: true
    lastFailureReason?: true
    createdAt?: true
    updatedAt?: true
  }

  export type RollingDailyMaintenanceStateCountAggregateInputType = {
    id?: true
    seriesId?: true
    inputSource?: true
    inputRunId?: true
    targetBasis?: true
    methodId?: true
    methodVersion?: true
    modelId?: true
    historicalOriginStartAt?: true
    minimumTrainingObservations?: true
    minimumCalibrationSamples?: true
    latestSourceObservationAt?: true
    latestSourceHistoryStartAt?: true
    latestSourceObservationCount?: true
    latestSourceHistoryFingerprint?: true
    lastProcessedOriginAt?: true
    lastMaturedObservedAt?: true
    lastMaintenanceAt?: true
    lastMaintenanceStatus?: true
    lastFailureReason?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type RollingDailyMaintenanceStateAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which RollingDailyMaintenanceState to aggregate.
     */
    where?: RollingDailyMaintenanceStateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RollingDailyMaintenanceStates to fetch.
     */
    orderBy?: RollingDailyMaintenanceStateOrderByWithRelationInput | RollingDailyMaintenanceStateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: RollingDailyMaintenanceStateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RollingDailyMaintenanceStates from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RollingDailyMaintenanceStates.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned RollingDailyMaintenanceStates
    **/
    _count?: true | RollingDailyMaintenanceStateCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: RollingDailyMaintenanceStateAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: RollingDailyMaintenanceStateSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: RollingDailyMaintenanceStateMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: RollingDailyMaintenanceStateMaxAggregateInputType
  }

  export type GetRollingDailyMaintenanceStateAggregateType<T extends RollingDailyMaintenanceStateAggregateArgs> = {
        [P in keyof T & keyof AggregateRollingDailyMaintenanceState]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateRollingDailyMaintenanceState[P]>
      : GetScalarType<T[P], AggregateRollingDailyMaintenanceState[P]>
  }




  export type RollingDailyMaintenanceStateGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: RollingDailyMaintenanceStateWhereInput
    orderBy?: RollingDailyMaintenanceStateOrderByWithAggregationInput | RollingDailyMaintenanceStateOrderByWithAggregationInput[]
    by: RollingDailyMaintenanceStateScalarFieldEnum[] | RollingDailyMaintenanceStateScalarFieldEnum
    having?: RollingDailyMaintenanceStateScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: RollingDailyMaintenanceStateCountAggregateInputType | true
    _avg?: RollingDailyMaintenanceStateAvgAggregateInputType
    _sum?: RollingDailyMaintenanceStateSumAggregateInputType
    _min?: RollingDailyMaintenanceStateMinAggregateInputType
    _max?: RollingDailyMaintenanceStateMaxAggregateInputType
  }

  export type RollingDailyMaintenanceStateGroupByOutputType = {
    id: string
    seriesId: string
    inputSource: string
    inputRunId: string | null
    targetBasis: $Enums.ForecastTargetBasis
    methodId: string
    methodVersion: string
    modelId: string
    historicalOriginStartAt: Date
    minimumTrainingObservations: number
    minimumCalibrationSamples: number
    latestSourceObservationAt: Date | null
    latestSourceHistoryStartAt: Date | null
    latestSourceObservationCount: number | null
    latestSourceHistoryFingerprint: string | null
    lastProcessedOriginAt: Date | null
    lastMaturedObservedAt: Date | null
    lastMaintenanceAt: Date | null
    lastMaintenanceStatus: string | null
    lastFailureReason: string | null
    createdAt: Date
    updatedAt: Date
    _count: RollingDailyMaintenanceStateCountAggregateOutputType | null
    _avg: RollingDailyMaintenanceStateAvgAggregateOutputType | null
    _sum: RollingDailyMaintenanceStateSumAggregateOutputType | null
    _min: RollingDailyMaintenanceStateMinAggregateOutputType | null
    _max: RollingDailyMaintenanceStateMaxAggregateOutputType | null
  }

  type GetRollingDailyMaintenanceStateGroupByPayload<T extends RollingDailyMaintenanceStateGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<RollingDailyMaintenanceStateGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof RollingDailyMaintenanceStateGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], RollingDailyMaintenanceStateGroupByOutputType[P]>
            : GetScalarType<T[P], RollingDailyMaintenanceStateGroupByOutputType[P]>
        }
      >
    >


  export type RollingDailyMaintenanceStateSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    seriesId?: boolean
    inputSource?: boolean
    inputRunId?: boolean
    targetBasis?: boolean
    methodId?: boolean
    methodVersion?: boolean
    modelId?: boolean
    historicalOriginStartAt?: boolean
    minimumTrainingObservations?: boolean
    minimumCalibrationSamples?: boolean
    latestSourceObservationAt?: boolean
    latestSourceHistoryStartAt?: boolean
    latestSourceObservationCount?: boolean
    latestSourceHistoryFingerprint?: boolean
    lastProcessedOriginAt?: boolean
    lastMaturedObservedAt?: boolean
    lastMaintenanceAt?: boolean
    lastMaintenanceStatus?: boolean
    lastFailureReason?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["rollingDailyMaintenanceState"]>

  export type RollingDailyMaintenanceStateSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    seriesId?: boolean
    inputSource?: boolean
    inputRunId?: boolean
    targetBasis?: boolean
    methodId?: boolean
    methodVersion?: boolean
    modelId?: boolean
    historicalOriginStartAt?: boolean
    minimumTrainingObservations?: boolean
    minimumCalibrationSamples?: boolean
    latestSourceObservationAt?: boolean
    latestSourceHistoryStartAt?: boolean
    latestSourceObservationCount?: boolean
    latestSourceHistoryFingerprint?: boolean
    lastProcessedOriginAt?: boolean
    lastMaturedObservedAt?: boolean
    lastMaintenanceAt?: boolean
    lastMaintenanceStatus?: boolean
    lastFailureReason?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["rollingDailyMaintenanceState"]>

  export type RollingDailyMaintenanceStateSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    seriesId?: boolean
    inputSource?: boolean
    inputRunId?: boolean
    targetBasis?: boolean
    methodId?: boolean
    methodVersion?: boolean
    modelId?: boolean
    historicalOriginStartAt?: boolean
    minimumTrainingObservations?: boolean
    minimumCalibrationSamples?: boolean
    latestSourceObservationAt?: boolean
    latestSourceHistoryStartAt?: boolean
    latestSourceObservationCount?: boolean
    latestSourceHistoryFingerprint?: boolean
    lastProcessedOriginAt?: boolean
    lastMaturedObservedAt?: boolean
    lastMaintenanceAt?: boolean
    lastMaintenanceStatus?: boolean
    lastFailureReason?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["rollingDailyMaintenanceState"]>

  export type RollingDailyMaintenanceStateSelectScalar = {
    id?: boolean
    seriesId?: boolean
    inputSource?: boolean
    inputRunId?: boolean
    targetBasis?: boolean
    methodId?: boolean
    methodVersion?: boolean
    modelId?: boolean
    historicalOriginStartAt?: boolean
    minimumTrainingObservations?: boolean
    minimumCalibrationSamples?: boolean
    latestSourceObservationAt?: boolean
    latestSourceHistoryStartAt?: boolean
    latestSourceObservationCount?: boolean
    latestSourceHistoryFingerprint?: boolean
    lastProcessedOriginAt?: boolean
    lastMaturedObservedAt?: boolean
    lastMaintenanceAt?: boolean
    lastMaintenanceStatus?: boolean
    lastFailureReason?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type RollingDailyMaintenanceStateOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "seriesId" | "inputSource" | "inputRunId" | "targetBasis" | "methodId" | "methodVersion" | "modelId" | "historicalOriginStartAt" | "minimumTrainingObservations" | "minimumCalibrationSamples" | "latestSourceObservationAt" | "latestSourceHistoryStartAt" | "latestSourceObservationCount" | "latestSourceHistoryFingerprint" | "lastProcessedOriginAt" | "lastMaturedObservedAt" | "lastMaintenanceAt" | "lastMaintenanceStatus" | "lastFailureReason" | "createdAt" | "updatedAt", ExtArgs["result"]["rollingDailyMaintenanceState"]>

  export type $RollingDailyMaintenanceStatePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "RollingDailyMaintenanceState"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      seriesId: string
      inputSource: string
      inputRunId: string | null
      targetBasis: $Enums.ForecastTargetBasis
      methodId: string
      methodVersion: string
      modelId: string
      historicalOriginStartAt: Date
      minimumTrainingObservations: number
      minimumCalibrationSamples: number
      latestSourceObservationAt: Date | null
      latestSourceHistoryStartAt: Date | null
      latestSourceObservationCount: number | null
      latestSourceHistoryFingerprint: string | null
      lastProcessedOriginAt: Date | null
      lastMaturedObservedAt: Date | null
      lastMaintenanceAt: Date | null
      lastMaintenanceStatus: string | null
      lastFailureReason: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["rollingDailyMaintenanceState"]>
    composites: {}
  }

  type RollingDailyMaintenanceStateGetPayload<S extends boolean | null | undefined | RollingDailyMaintenanceStateDefaultArgs> = $Result.GetResult<Prisma.$RollingDailyMaintenanceStatePayload, S>

  type RollingDailyMaintenanceStateCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<RollingDailyMaintenanceStateFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: RollingDailyMaintenanceStateCountAggregateInputType | true
    }

  export interface RollingDailyMaintenanceStateDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['RollingDailyMaintenanceState'], meta: { name: 'RollingDailyMaintenanceState' } }
    /**
     * Find zero or one RollingDailyMaintenanceState that matches the filter.
     * @param {RollingDailyMaintenanceStateFindUniqueArgs} args - Arguments to find a RollingDailyMaintenanceState
     * @example
     * // Get one RollingDailyMaintenanceState
     * const rollingDailyMaintenanceState = await prisma.rollingDailyMaintenanceState.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends RollingDailyMaintenanceStateFindUniqueArgs>(args: SelectSubset<T, RollingDailyMaintenanceStateFindUniqueArgs<ExtArgs>>): Prisma__RollingDailyMaintenanceStateClient<$Result.GetResult<Prisma.$RollingDailyMaintenanceStatePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one RollingDailyMaintenanceState that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {RollingDailyMaintenanceStateFindUniqueOrThrowArgs} args - Arguments to find a RollingDailyMaintenanceState
     * @example
     * // Get one RollingDailyMaintenanceState
     * const rollingDailyMaintenanceState = await prisma.rollingDailyMaintenanceState.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends RollingDailyMaintenanceStateFindUniqueOrThrowArgs>(args: SelectSubset<T, RollingDailyMaintenanceStateFindUniqueOrThrowArgs<ExtArgs>>): Prisma__RollingDailyMaintenanceStateClient<$Result.GetResult<Prisma.$RollingDailyMaintenanceStatePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first RollingDailyMaintenanceState that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyMaintenanceStateFindFirstArgs} args - Arguments to find a RollingDailyMaintenanceState
     * @example
     * // Get one RollingDailyMaintenanceState
     * const rollingDailyMaintenanceState = await prisma.rollingDailyMaintenanceState.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends RollingDailyMaintenanceStateFindFirstArgs>(args?: SelectSubset<T, RollingDailyMaintenanceStateFindFirstArgs<ExtArgs>>): Prisma__RollingDailyMaintenanceStateClient<$Result.GetResult<Prisma.$RollingDailyMaintenanceStatePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first RollingDailyMaintenanceState that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyMaintenanceStateFindFirstOrThrowArgs} args - Arguments to find a RollingDailyMaintenanceState
     * @example
     * // Get one RollingDailyMaintenanceState
     * const rollingDailyMaintenanceState = await prisma.rollingDailyMaintenanceState.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends RollingDailyMaintenanceStateFindFirstOrThrowArgs>(args?: SelectSubset<T, RollingDailyMaintenanceStateFindFirstOrThrowArgs<ExtArgs>>): Prisma__RollingDailyMaintenanceStateClient<$Result.GetResult<Prisma.$RollingDailyMaintenanceStatePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more RollingDailyMaintenanceStates that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyMaintenanceStateFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all RollingDailyMaintenanceStates
     * const rollingDailyMaintenanceStates = await prisma.rollingDailyMaintenanceState.findMany()
     * 
     * // Get first 10 RollingDailyMaintenanceStates
     * const rollingDailyMaintenanceStates = await prisma.rollingDailyMaintenanceState.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const rollingDailyMaintenanceStateWithIdOnly = await prisma.rollingDailyMaintenanceState.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends RollingDailyMaintenanceStateFindManyArgs>(args?: SelectSubset<T, RollingDailyMaintenanceStateFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RollingDailyMaintenanceStatePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a RollingDailyMaintenanceState.
     * @param {RollingDailyMaintenanceStateCreateArgs} args - Arguments to create a RollingDailyMaintenanceState.
     * @example
     * // Create one RollingDailyMaintenanceState
     * const RollingDailyMaintenanceState = await prisma.rollingDailyMaintenanceState.create({
     *   data: {
     *     // ... data to create a RollingDailyMaintenanceState
     *   }
     * })
     * 
     */
    create<T extends RollingDailyMaintenanceStateCreateArgs>(args: SelectSubset<T, RollingDailyMaintenanceStateCreateArgs<ExtArgs>>): Prisma__RollingDailyMaintenanceStateClient<$Result.GetResult<Prisma.$RollingDailyMaintenanceStatePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many RollingDailyMaintenanceStates.
     * @param {RollingDailyMaintenanceStateCreateManyArgs} args - Arguments to create many RollingDailyMaintenanceStates.
     * @example
     * // Create many RollingDailyMaintenanceStates
     * const rollingDailyMaintenanceState = await prisma.rollingDailyMaintenanceState.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends RollingDailyMaintenanceStateCreateManyArgs>(args?: SelectSubset<T, RollingDailyMaintenanceStateCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many RollingDailyMaintenanceStates and returns the data saved in the database.
     * @param {RollingDailyMaintenanceStateCreateManyAndReturnArgs} args - Arguments to create many RollingDailyMaintenanceStates.
     * @example
     * // Create many RollingDailyMaintenanceStates
     * const rollingDailyMaintenanceState = await prisma.rollingDailyMaintenanceState.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many RollingDailyMaintenanceStates and only return the `id`
     * const rollingDailyMaintenanceStateWithIdOnly = await prisma.rollingDailyMaintenanceState.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends RollingDailyMaintenanceStateCreateManyAndReturnArgs>(args?: SelectSubset<T, RollingDailyMaintenanceStateCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RollingDailyMaintenanceStatePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a RollingDailyMaintenanceState.
     * @param {RollingDailyMaintenanceStateDeleteArgs} args - Arguments to delete one RollingDailyMaintenanceState.
     * @example
     * // Delete one RollingDailyMaintenanceState
     * const RollingDailyMaintenanceState = await prisma.rollingDailyMaintenanceState.delete({
     *   where: {
     *     // ... filter to delete one RollingDailyMaintenanceState
     *   }
     * })
     * 
     */
    delete<T extends RollingDailyMaintenanceStateDeleteArgs>(args: SelectSubset<T, RollingDailyMaintenanceStateDeleteArgs<ExtArgs>>): Prisma__RollingDailyMaintenanceStateClient<$Result.GetResult<Prisma.$RollingDailyMaintenanceStatePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one RollingDailyMaintenanceState.
     * @param {RollingDailyMaintenanceStateUpdateArgs} args - Arguments to update one RollingDailyMaintenanceState.
     * @example
     * // Update one RollingDailyMaintenanceState
     * const rollingDailyMaintenanceState = await prisma.rollingDailyMaintenanceState.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends RollingDailyMaintenanceStateUpdateArgs>(args: SelectSubset<T, RollingDailyMaintenanceStateUpdateArgs<ExtArgs>>): Prisma__RollingDailyMaintenanceStateClient<$Result.GetResult<Prisma.$RollingDailyMaintenanceStatePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more RollingDailyMaintenanceStates.
     * @param {RollingDailyMaintenanceStateDeleteManyArgs} args - Arguments to filter RollingDailyMaintenanceStates to delete.
     * @example
     * // Delete a few RollingDailyMaintenanceStates
     * const { count } = await prisma.rollingDailyMaintenanceState.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends RollingDailyMaintenanceStateDeleteManyArgs>(args?: SelectSubset<T, RollingDailyMaintenanceStateDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more RollingDailyMaintenanceStates.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyMaintenanceStateUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many RollingDailyMaintenanceStates
     * const rollingDailyMaintenanceState = await prisma.rollingDailyMaintenanceState.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends RollingDailyMaintenanceStateUpdateManyArgs>(args: SelectSubset<T, RollingDailyMaintenanceStateUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more RollingDailyMaintenanceStates and returns the data updated in the database.
     * @param {RollingDailyMaintenanceStateUpdateManyAndReturnArgs} args - Arguments to update many RollingDailyMaintenanceStates.
     * @example
     * // Update many RollingDailyMaintenanceStates
     * const rollingDailyMaintenanceState = await prisma.rollingDailyMaintenanceState.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more RollingDailyMaintenanceStates and only return the `id`
     * const rollingDailyMaintenanceStateWithIdOnly = await prisma.rollingDailyMaintenanceState.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends RollingDailyMaintenanceStateUpdateManyAndReturnArgs>(args: SelectSubset<T, RollingDailyMaintenanceStateUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RollingDailyMaintenanceStatePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one RollingDailyMaintenanceState.
     * @param {RollingDailyMaintenanceStateUpsertArgs} args - Arguments to update or create a RollingDailyMaintenanceState.
     * @example
     * // Update or create a RollingDailyMaintenanceState
     * const rollingDailyMaintenanceState = await prisma.rollingDailyMaintenanceState.upsert({
     *   create: {
     *     // ... data to create a RollingDailyMaintenanceState
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the RollingDailyMaintenanceState we want to update
     *   }
     * })
     */
    upsert<T extends RollingDailyMaintenanceStateUpsertArgs>(args: SelectSubset<T, RollingDailyMaintenanceStateUpsertArgs<ExtArgs>>): Prisma__RollingDailyMaintenanceStateClient<$Result.GetResult<Prisma.$RollingDailyMaintenanceStatePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of RollingDailyMaintenanceStates.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyMaintenanceStateCountArgs} args - Arguments to filter RollingDailyMaintenanceStates to count.
     * @example
     * // Count the number of RollingDailyMaintenanceStates
     * const count = await prisma.rollingDailyMaintenanceState.count({
     *   where: {
     *     // ... the filter for the RollingDailyMaintenanceStates we want to count
     *   }
     * })
    **/
    count<T extends RollingDailyMaintenanceStateCountArgs>(
      args?: Subset<T, RollingDailyMaintenanceStateCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], RollingDailyMaintenanceStateCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a RollingDailyMaintenanceState.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyMaintenanceStateAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends RollingDailyMaintenanceStateAggregateArgs>(args: Subset<T, RollingDailyMaintenanceStateAggregateArgs>): Prisma.PrismaPromise<GetRollingDailyMaintenanceStateAggregateType<T>>

    /**
     * Group by RollingDailyMaintenanceState.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RollingDailyMaintenanceStateGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends RollingDailyMaintenanceStateGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: RollingDailyMaintenanceStateGroupByArgs['orderBy'] }
        : { orderBy?: RollingDailyMaintenanceStateGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, RollingDailyMaintenanceStateGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetRollingDailyMaintenanceStateGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the RollingDailyMaintenanceState model
   */
  readonly fields: RollingDailyMaintenanceStateFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for RollingDailyMaintenanceState.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__RollingDailyMaintenanceStateClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the RollingDailyMaintenanceState model
   */
  interface RollingDailyMaintenanceStateFieldRefs {
    readonly id: FieldRef<"RollingDailyMaintenanceState", 'String'>
    readonly seriesId: FieldRef<"RollingDailyMaintenanceState", 'String'>
    readonly inputSource: FieldRef<"RollingDailyMaintenanceState", 'String'>
    readonly inputRunId: FieldRef<"RollingDailyMaintenanceState", 'String'>
    readonly targetBasis: FieldRef<"RollingDailyMaintenanceState", 'ForecastTargetBasis'>
    readonly methodId: FieldRef<"RollingDailyMaintenanceState", 'String'>
    readonly methodVersion: FieldRef<"RollingDailyMaintenanceState", 'String'>
    readonly modelId: FieldRef<"RollingDailyMaintenanceState", 'String'>
    readonly historicalOriginStartAt: FieldRef<"RollingDailyMaintenanceState", 'DateTime'>
    readonly minimumTrainingObservations: FieldRef<"RollingDailyMaintenanceState", 'Int'>
    readonly minimumCalibrationSamples: FieldRef<"RollingDailyMaintenanceState", 'Int'>
    readonly latestSourceObservationAt: FieldRef<"RollingDailyMaintenanceState", 'DateTime'>
    readonly latestSourceHistoryStartAt: FieldRef<"RollingDailyMaintenanceState", 'DateTime'>
    readonly latestSourceObservationCount: FieldRef<"RollingDailyMaintenanceState", 'Int'>
    readonly latestSourceHistoryFingerprint: FieldRef<"RollingDailyMaintenanceState", 'String'>
    readonly lastProcessedOriginAt: FieldRef<"RollingDailyMaintenanceState", 'DateTime'>
    readonly lastMaturedObservedAt: FieldRef<"RollingDailyMaintenanceState", 'DateTime'>
    readonly lastMaintenanceAt: FieldRef<"RollingDailyMaintenanceState", 'DateTime'>
    readonly lastMaintenanceStatus: FieldRef<"RollingDailyMaintenanceState", 'String'>
    readonly lastFailureReason: FieldRef<"RollingDailyMaintenanceState", 'String'>
    readonly createdAt: FieldRef<"RollingDailyMaintenanceState", 'DateTime'>
    readonly updatedAt: FieldRef<"RollingDailyMaintenanceState", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * RollingDailyMaintenanceState findUnique
   */
  export type RollingDailyMaintenanceStateFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyMaintenanceState
     */
    select?: RollingDailyMaintenanceStateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyMaintenanceState
     */
    omit?: RollingDailyMaintenanceStateOmit<ExtArgs> | null
    /**
     * Filter, which RollingDailyMaintenanceState to fetch.
     */
    where: RollingDailyMaintenanceStateWhereUniqueInput
  }

  /**
   * RollingDailyMaintenanceState findUniqueOrThrow
   */
  export type RollingDailyMaintenanceStateFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyMaintenanceState
     */
    select?: RollingDailyMaintenanceStateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyMaintenanceState
     */
    omit?: RollingDailyMaintenanceStateOmit<ExtArgs> | null
    /**
     * Filter, which RollingDailyMaintenanceState to fetch.
     */
    where: RollingDailyMaintenanceStateWhereUniqueInput
  }

  /**
   * RollingDailyMaintenanceState findFirst
   */
  export type RollingDailyMaintenanceStateFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyMaintenanceState
     */
    select?: RollingDailyMaintenanceStateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyMaintenanceState
     */
    omit?: RollingDailyMaintenanceStateOmit<ExtArgs> | null
    /**
     * Filter, which RollingDailyMaintenanceState to fetch.
     */
    where?: RollingDailyMaintenanceStateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RollingDailyMaintenanceStates to fetch.
     */
    orderBy?: RollingDailyMaintenanceStateOrderByWithRelationInput | RollingDailyMaintenanceStateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for RollingDailyMaintenanceStates.
     */
    cursor?: RollingDailyMaintenanceStateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RollingDailyMaintenanceStates from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RollingDailyMaintenanceStates.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RollingDailyMaintenanceStates.
     */
    distinct?: RollingDailyMaintenanceStateScalarFieldEnum | RollingDailyMaintenanceStateScalarFieldEnum[]
  }

  /**
   * RollingDailyMaintenanceState findFirstOrThrow
   */
  export type RollingDailyMaintenanceStateFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyMaintenanceState
     */
    select?: RollingDailyMaintenanceStateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyMaintenanceState
     */
    omit?: RollingDailyMaintenanceStateOmit<ExtArgs> | null
    /**
     * Filter, which RollingDailyMaintenanceState to fetch.
     */
    where?: RollingDailyMaintenanceStateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RollingDailyMaintenanceStates to fetch.
     */
    orderBy?: RollingDailyMaintenanceStateOrderByWithRelationInput | RollingDailyMaintenanceStateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for RollingDailyMaintenanceStates.
     */
    cursor?: RollingDailyMaintenanceStateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RollingDailyMaintenanceStates from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RollingDailyMaintenanceStates.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RollingDailyMaintenanceStates.
     */
    distinct?: RollingDailyMaintenanceStateScalarFieldEnum | RollingDailyMaintenanceStateScalarFieldEnum[]
  }

  /**
   * RollingDailyMaintenanceState findMany
   */
  export type RollingDailyMaintenanceStateFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyMaintenanceState
     */
    select?: RollingDailyMaintenanceStateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyMaintenanceState
     */
    omit?: RollingDailyMaintenanceStateOmit<ExtArgs> | null
    /**
     * Filter, which RollingDailyMaintenanceStates to fetch.
     */
    where?: RollingDailyMaintenanceStateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RollingDailyMaintenanceStates to fetch.
     */
    orderBy?: RollingDailyMaintenanceStateOrderByWithRelationInput | RollingDailyMaintenanceStateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing RollingDailyMaintenanceStates.
     */
    cursor?: RollingDailyMaintenanceStateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RollingDailyMaintenanceStates from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RollingDailyMaintenanceStates.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RollingDailyMaintenanceStates.
     */
    distinct?: RollingDailyMaintenanceStateScalarFieldEnum | RollingDailyMaintenanceStateScalarFieldEnum[]
  }

  /**
   * RollingDailyMaintenanceState create
   */
  export type RollingDailyMaintenanceStateCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyMaintenanceState
     */
    select?: RollingDailyMaintenanceStateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyMaintenanceState
     */
    omit?: RollingDailyMaintenanceStateOmit<ExtArgs> | null
    /**
     * The data needed to create a RollingDailyMaintenanceState.
     */
    data: XOR<RollingDailyMaintenanceStateCreateInput, RollingDailyMaintenanceStateUncheckedCreateInput>
  }

  /**
   * RollingDailyMaintenanceState createMany
   */
  export type RollingDailyMaintenanceStateCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many RollingDailyMaintenanceStates.
     */
    data: RollingDailyMaintenanceStateCreateManyInput | RollingDailyMaintenanceStateCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * RollingDailyMaintenanceState createManyAndReturn
   */
  export type RollingDailyMaintenanceStateCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyMaintenanceState
     */
    select?: RollingDailyMaintenanceStateSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyMaintenanceState
     */
    omit?: RollingDailyMaintenanceStateOmit<ExtArgs> | null
    /**
     * The data used to create many RollingDailyMaintenanceStates.
     */
    data: RollingDailyMaintenanceStateCreateManyInput | RollingDailyMaintenanceStateCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * RollingDailyMaintenanceState update
   */
  export type RollingDailyMaintenanceStateUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyMaintenanceState
     */
    select?: RollingDailyMaintenanceStateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyMaintenanceState
     */
    omit?: RollingDailyMaintenanceStateOmit<ExtArgs> | null
    /**
     * The data needed to update a RollingDailyMaintenanceState.
     */
    data: XOR<RollingDailyMaintenanceStateUpdateInput, RollingDailyMaintenanceStateUncheckedUpdateInput>
    /**
     * Choose, which RollingDailyMaintenanceState to update.
     */
    where: RollingDailyMaintenanceStateWhereUniqueInput
  }

  /**
   * RollingDailyMaintenanceState updateMany
   */
  export type RollingDailyMaintenanceStateUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update RollingDailyMaintenanceStates.
     */
    data: XOR<RollingDailyMaintenanceStateUpdateManyMutationInput, RollingDailyMaintenanceStateUncheckedUpdateManyInput>
    /**
     * Filter which RollingDailyMaintenanceStates to update
     */
    where?: RollingDailyMaintenanceStateWhereInput
    /**
     * Limit how many RollingDailyMaintenanceStates to update.
     */
    limit?: number
  }

  /**
   * RollingDailyMaintenanceState updateManyAndReturn
   */
  export type RollingDailyMaintenanceStateUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyMaintenanceState
     */
    select?: RollingDailyMaintenanceStateSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyMaintenanceState
     */
    omit?: RollingDailyMaintenanceStateOmit<ExtArgs> | null
    /**
     * The data used to update RollingDailyMaintenanceStates.
     */
    data: XOR<RollingDailyMaintenanceStateUpdateManyMutationInput, RollingDailyMaintenanceStateUncheckedUpdateManyInput>
    /**
     * Filter which RollingDailyMaintenanceStates to update
     */
    where?: RollingDailyMaintenanceStateWhereInput
    /**
     * Limit how many RollingDailyMaintenanceStates to update.
     */
    limit?: number
  }

  /**
   * RollingDailyMaintenanceState upsert
   */
  export type RollingDailyMaintenanceStateUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyMaintenanceState
     */
    select?: RollingDailyMaintenanceStateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyMaintenanceState
     */
    omit?: RollingDailyMaintenanceStateOmit<ExtArgs> | null
    /**
     * The filter to search for the RollingDailyMaintenanceState to update in case it exists.
     */
    where: RollingDailyMaintenanceStateWhereUniqueInput
    /**
     * In case the RollingDailyMaintenanceState found by the `where` argument doesn't exist, create a new RollingDailyMaintenanceState with this data.
     */
    create: XOR<RollingDailyMaintenanceStateCreateInput, RollingDailyMaintenanceStateUncheckedCreateInput>
    /**
     * In case the RollingDailyMaintenanceState was found with the provided `where` argument, update it with this data.
     */
    update: XOR<RollingDailyMaintenanceStateUpdateInput, RollingDailyMaintenanceStateUncheckedUpdateInput>
  }

  /**
   * RollingDailyMaintenanceState delete
   */
  export type RollingDailyMaintenanceStateDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyMaintenanceState
     */
    select?: RollingDailyMaintenanceStateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyMaintenanceState
     */
    omit?: RollingDailyMaintenanceStateOmit<ExtArgs> | null
    /**
     * Filter which RollingDailyMaintenanceState to delete.
     */
    where: RollingDailyMaintenanceStateWhereUniqueInput
  }

  /**
   * RollingDailyMaintenanceState deleteMany
   */
  export type RollingDailyMaintenanceStateDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which RollingDailyMaintenanceStates to delete
     */
    where?: RollingDailyMaintenanceStateWhereInput
    /**
     * Limit how many RollingDailyMaintenanceStates to delete.
     */
    limit?: number
  }

  /**
   * RollingDailyMaintenanceState without action
   */
  export type RollingDailyMaintenanceStateDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RollingDailyMaintenanceState
     */
    select?: RollingDailyMaintenanceStateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RollingDailyMaintenanceState
     */
    omit?: RollingDailyMaintenanceStateOmit<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const ForecastCurrentRunScalarFieldEnum: {
    id: 'id',
    seriesId: 'seriesId',
    displayName: 'displayName',
    description: 'description',
    frequency: 'frequency',
    currency: 'currency',
    unit: 'unit',
    sourceLabel: 'sourceLabel',
    inputSource: 'inputSource',
    inputRunId: 'inputRunId',
    historyFingerprint: 'historyFingerprint',
    targetBasis: 'targetBasis',
    methodId: 'methodId',
    historyStartAt: 'historyStartAt',
    historyEndAt: 'historyEndAt',
    observationCount: 'observationCount',
    forecastOriginAt: 'forecastOriginAt',
    modelId: 'modelId',
    methodVersion: 'methodVersion',
    status: 'status',
    failureReason: 'failureReason',
    runtimeSeconds: 'runtimeSeconds',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type ForecastCurrentRunScalarFieldEnum = (typeof ForecastCurrentRunScalarFieldEnum)[keyof typeof ForecastCurrentRunScalarFieldEnum]


  export const ForecastCurrentPointScalarFieldEnum: {
    id: 'id',
    runId: 'runId',
    horizonLabel: 'horizonLabel',
    horizonSteps: 'horizonSteps',
    forecastDate: 'forecastDate',
    forecastValue: 'forecastValue',
    fitStatus: 'fitStatus',
    failureReason: 'failureReason',
    selectedVariant: 'selectedVariant',
    selectionMetric: 'selectionMetric',
    selectionScore: 'selectionScore',
    metadataJson: 'metadataJson',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type ForecastCurrentPointScalarFieldEnum = (typeof ForecastCurrentPointScalarFieldEnum)[keyof typeof ForecastCurrentPointScalarFieldEnum]


  export const ForecastVerificationRunScalarFieldEnum: {
    id: 'id',
    seriesId: 'seriesId',
    displayName: 'displayName',
    description: 'description',
    frequency: 'frequency',
    currency: 'currency',
    unit: 'unit',
    sourceLabel: 'sourceLabel',
    inputSource: 'inputSource',
    inputRunId: 'inputRunId',
    historyFingerprint: 'historyFingerprint',
    targetBasis: 'targetBasis',
    methodId: 'methodId',
    historyStartAt: 'historyStartAt',
    historyEndAt: 'historyEndAt',
    observationCount: 'observationCount',
    forecastOriginAt: 'forecastOriginAt',
    modelId: 'modelId',
    methodVersion: 'methodVersion',
    status: 'status',
    failureReason: 'failureReason',
    runtimeSeconds: 'runtimeSeconds',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type ForecastVerificationRunScalarFieldEnum = (typeof ForecastVerificationRunScalarFieldEnum)[keyof typeof ForecastVerificationRunScalarFieldEnum]


  export const ForecastVerificationMetricScalarFieldEnum: {
    id: 'id',
    runId: 'runId',
    horizonLabel: 'horizonLabel',
    horizonSteps: 'horizonSteps',
    origins: 'origins',
    expectedOrigins: 'expectedOrigins',
    failedOrigins: 'failedOrigins',
    coverage: 'coverage',
    mae: 'mae',
    rmse: 'rmse',
    mase: 'mase',
    smape: 'smape',
    directionalAccuracy: 'directionalAccuracy',
    bias: 'bias',
    failureSummaryJson: 'failureSummaryJson',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type ForecastVerificationMetricScalarFieldEnum = (typeof ForecastVerificationMetricScalarFieldEnum)[keyof typeof ForecastVerificationMetricScalarFieldEnum]


  export const ForecastVerificationPointScalarFieldEnum: {
    id: 'id',
    runId: 'runId',
    horizonLabel: 'horizonLabel',
    horizonSteps: 'horizonSteps',
    forecastOriginAt: 'forecastOriginAt',
    targetDate: 'targetDate',
    actualObservedAt: 'actualObservedAt',
    originValue: 'originValue',
    forecastValue: 'forecastValue',
    actualValue: 'actualValue',
    errorValue: 'errorValue',
    absoluteErrorValue: 'absoluteErrorValue',
    deltaValue: 'deltaValue',
    deltaPct: 'deltaPct',
    maseScale: 'maseScale',
    selectedVariant: 'selectedVariant',
    selectionMetric: 'selectionMetric',
    selectionScore: 'selectionScore',
    metadataJson: 'metadataJson',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type ForecastVerificationPointScalarFieldEnum = (typeof ForecastVerificationPointScalarFieldEnum)[keyof typeof ForecastVerificationPointScalarFieldEnum]


  export const RollingDailyVerificationRecordScalarFieldEnum: {
    id: 'id',
    seriesId: 'seriesId',
    inputSource: 'inputSource',
    inputRunId: 'inputRunId',
    targetBasis: 'targetBasis',
    methodId: 'methodId',
    methodVersion: 'methodVersion',
    modelId: 'modelId',
    forecastOriginAt: 'forecastOriginAt',
    horizonLabel: 'horizonLabel',
    horizonMonths: 'horizonMonths',
    horizonSteps: 'horizonSteps',
    targetCalendarDate: 'targetCalendarDate',
    verificationObservedAt: 'verificationObservedAt',
    maturityStatus: 'maturityStatus',
    originValue: 'originValue',
    forecastValue: 'forecastValue',
    actualValue: 'actualValue',
    errorValue: 'errorValue',
    absoluteErrorValue: 'absoluteErrorValue',
    deltaValue: 'deltaValue',
    deltaPct: 'deltaPct',
    residualValue: 'residualValue',
    maseScale: 'maseScale',
    trainingHistoryStartAt: 'trainingHistoryStartAt',
    trainingHistoryEndAt: 'trainingHistoryEndAt',
    trainingObservationCount: 'trainingObservationCount',
    sourceHistoryFingerprint: 'sourceHistoryFingerprint',
    selectedVariant: 'selectedVariant',
    selectionMetric: 'selectionMetric',
    selectionScore: 'selectionScore',
    metadataJson: 'metadataJson',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type RollingDailyVerificationRecordScalarFieldEnum = (typeof RollingDailyVerificationRecordScalarFieldEnum)[keyof typeof RollingDailyVerificationRecordScalarFieldEnum]


  export const RollingDailyCurrentForecastSnapshotScalarFieldEnum: {
    id: 'id',
    seriesId: 'seriesId',
    inputSource: 'inputSource',
    inputRunId: 'inputRunId',
    targetBasis: 'targetBasis',
    methodId: 'methodId',
    methodVersion: 'methodVersion',
    modelId: 'modelId',
    contractVersion: 'contractVersion',
    status: 'status',
    reasonCode: 'reasonCode',
    message: 'message',
    forecastOriginAt: 'forecastOriginAt',
    sourceLatestObservationAt: 'sourceLatestObservationAt',
    payloadJson: 'payloadJson',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type RollingDailyCurrentForecastSnapshotScalarFieldEnum = (typeof RollingDailyCurrentForecastSnapshotScalarFieldEnum)[keyof typeof RollingDailyCurrentForecastSnapshotScalarFieldEnum]


  export const RollingDailyCalibrationGroupScalarFieldEnum: {
    id: 'id',
    seriesId: 'seriesId',
    inputSource: 'inputSource',
    inputRunId: 'inputRunId',
    targetBasis: 'targetBasis',
    methodId: 'methodId',
    methodVersion: 'methodVersion',
    modelId: 'modelId',
    horizonLabel: 'horizonLabel',
    horizonMonths: 'horizonMonths',
    calibrationOriginAt: 'calibrationOriginAt',
    sampleCount: 'sampleCount',
    residualP10: 'residualP10',
    residualP90: 'residualP90',
    quantileMethod: 'quantileMethod',
    status: 'status',
    lastResidualObservedAt: 'lastResidualObservedAt',
    refreshedAt: 'refreshedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type RollingDailyCalibrationGroupScalarFieldEnum = (typeof RollingDailyCalibrationGroupScalarFieldEnum)[keyof typeof RollingDailyCalibrationGroupScalarFieldEnum]


  export const RollingDailyMaintenanceStateScalarFieldEnum: {
    id: 'id',
    seriesId: 'seriesId',
    inputSource: 'inputSource',
    inputRunId: 'inputRunId',
    targetBasis: 'targetBasis',
    methodId: 'methodId',
    methodVersion: 'methodVersion',
    modelId: 'modelId',
    historicalOriginStartAt: 'historicalOriginStartAt',
    minimumTrainingObservations: 'minimumTrainingObservations',
    minimumCalibrationSamples: 'minimumCalibrationSamples',
    latestSourceObservationAt: 'latestSourceObservationAt',
    latestSourceHistoryStartAt: 'latestSourceHistoryStartAt',
    latestSourceObservationCount: 'latestSourceObservationCount',
    latestSourceHistoryFingerprint: 'latestSourceHistoryFingerprint',
    lastProcessedOriginAt: 'lastProcessedOriginAt',
    lastMaturedObservedAt: 'lastMaturedObservedAt',
    lastMaintenanceAt: 'lastMaintenanceAt',
    lastMaintenanceStatus: 'lastMaintenanceStatus',
    lastFailureReason: 'lastFailureReason',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type RollingDailyMaintenanceStateScalarFieldEnum = (typeof RollingDailyMaintenanceStateScalarFieldEnum)[keyof typeof RollingDailyMaintenanceStateScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const NullableJsonNullValueInput: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull
  };

  export type NullableJsonNullValueInput = (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput]


  export const JsonNullValueInput: {
    JsonNull: typeof JsonNull
  };

  export type JsonNullValueInput = (typeof JsonNullValueInput)[keyof typeof JsonNullValueInput]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'ForecastTargetBasis'
   */
  export type EnumForecastTargetBasisFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'ForecastTargetBasis'>
    


  /**
   * Reference to a field of type 'ForecastTargetBasis[]'
   */
  export type ListEnumForecastTargetBasisFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'ForecastTargetBasis[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    


  /**
   * Reference to a field of type 'Decimal'
   */
  export type DecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal'>
    


  /**
   * Reference to a field of type 'Decimal[]'
   */
  export type ListDecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal[]'>
    


  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    


  /**
   * Reference to a field of type 'QueryMode'
   */
  export type EnumQueryModeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'QueryMode'>
    


  /**
   * Reference to a field of type 'RollingDailyVerificationMaturityStatus'
   */
  export type EnumRollingDailyVerificationMaturityStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'RollingDailyVerificationMaturityStatus'>
    


  /**
   * Reference to a field of type 'RollingDailyVerificationMaturityStatus[]'
   */
  export type ListEnumRollingDailyVerificationMaturityStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'RollingDailyVerificationMaturityStatus[]'>
    


  /**
   * Reference to a field of type 'RollingDailyCalibrationStatus'
   */
  export type EnumRollingDailyCalibrationStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'RollingDailyCalibrationStatus'>
    


  /**
   * Reference to a field of type 'RollingDailyCalibrationStatus[]'
   */
  export type ListEnumRollingDailyCalibrationStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'RollingDailyCalibrationStatus[]'>
    
  /**
   * Deep Input Types
   */


  export type ForecastCurrentRunWhereInput = {
    AND?: ForecastCurrentRunWhereInput | ForecastCurrentRunWhereInput[]
    OR?: ForecastCurrentRunWhereInput[]
    NOT?: ForecastCurrentRunWhereInput | ForecastCurrentRunWhereInput[]
    id?: StringFilter<"ForecastCurrentRun"> | string
    seriesId?: StringFilter<"ForecastCurrentRun"> | string
    displayName?: StringFilter<"ForecastCurrentRun"> | string
    description?: StringNullableFilter<"ForecastCurrentRun"> | string | null
    frequency?: StringNullableFilter<"ForecastCurrentRun"> | string | null
    currency?: StringNullableFilter<"ForecastCurrentRun"> | string | null
    unit?: StringNullableFilter<"ForecastCurrentRun"> | string | null
    sourceLabel?: StringNullableFilter<"ForecastCurrentRun"> | string | null
    inputSource?: StringFilter<"ForecastCurrentRun"> | string
    inputRunId?: StringNullableFilter<"ForecastCurrentRun"> | string | null
    historyFingerprint?: StringFilter<"ForecastCurrentRun"> | string
    targetBasis?: EnumForecastTargetBasisFilter<"ForecastCurrentRun"> | $Enums.ForecastTargetBasis
    methodId?: StringFilter<"ForecastCurrentRun"> | string
    historyStartAt?: DateTimeNullableFilter<"ForecastCurrentRun"> | Date | string | null
    historyEndAt?: DateTimeNullableFilter<"ForecastCurrentRun"> | Date | string | null
    observationCount?: IntFilter<"ForecastCurrentRun"> | number
    forecastOriginAt?: DateTimeNullableFilter<"ForecastCurrentRun"> | Date | string | null
    modelId?: StringFilter<"ForecastCurrentRun"> | string
    methodVersion?: StringFilter<"ForecastCurrentRun"> | string
    status?: StringFilter<"ForecastCurrentRun"> | string
    failureReason?: StringNullableFilter<"ForecastCurrentRun"> | string | null
    runtimeSeconds?: FloatNullableFilter<"ForecastCurrentRun"> | number | null
    createdAt?: DateTimeFilter<"ForecastCurrentRun"> | Date | string
    updatedAt?: DateTimeFilter<"ForecastCurrentRun"> | Date | string
    points?: ForecastCurrentPointListRelationFilter
  }

  export type ForecastCurrentRunOrderByWithRelationInput = {
    id?: SortOrder
    seriesId?: SortOrder
    displayName?: SortOrder
    description?: SortOrderInput | SortOrder
    frequency?: SortOrderInput | SortOrder
    currency?: SortOrderInput | SortOrder
    unit?: SortOrderInput | SortOrder
    sourceLabel?: SortOrderInput | SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrderInput | SortOrder
    historyFingerprint?: SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    historyStartAt?: SortOrderInput | SortOrder
    historyEndAt?: SortOrderInput | SortOrder
    observationCount?: SortOrder
    forecastOriginAt?: SortOrderInput | SortOrder
    modelId?: SortOrder
    methodVersion?: SortOrder
    status?: SortOrder
    failureReason?: SortOrderInput | SortOrder
    runtimeSeconds?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    points?: ForecastCurrentPointOrderByRelationAggregateInput
  }

  export type ForecastCurrentRunWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    seriesId_inputSource_historyFingerprint_targetBasis_methodId_modelId_methodVersion?: ForecastCurrentRunSeriesIdInputSourceHistoryFingerprintTargetBasisMethodIdModelIdMethodVersionCompoundUniqueInput
    AND?: ForecastCurrentRunWhereInput | ForecastCurrentRunWhereInput[]
    OR?: ForecastCurrentRunWhereInput[]
    NOT?: ForecastCurrentRunWhereInput | ForecastCurrentRunWhereInput[]
    seriesId?: StringFilter<"ForecastCurrentRun"> | string
    displayName?: StringFilter<"ForecastCurrentRun"> | string
    description?: StringNullableFilter<"ForecastCurrentRun"> | string | null
    frequency?: StringNullableFilter<"ForecastCurrentRun"> | string | null
    currency?: StringNullableFilter<"ForecastCurrentRun"> | string | null
    unit?: StringNullableFilter<"ForecastCurrentRun"> | string | null
    sourceLabel?: StringNullableFilter<"ForecastCurrentRun"> | string | null
    inputSource?: StringFilter<"ForecastCurrentRun"> | string
    inputRunId?: StringNullableFilter<"ForecastCurrentRun"> | string | null
    historyFingerprint?: StringFilter<"ForecastCurrentRun"> | string
    targetBasis?: EnumForecastTargetBasisFilter<"ForecastCurrentRun"> | $Enums.ForecastTargetBasis
    methodId?: StringFilter<"ForecastCurrentRun"> | string
    historyStartAt?: DateTimeNullableFilter<"ForecastCurrentRun"> | Date | string | null
    historyEndAt?: DateTimeNullableFilter<"ForecastCurrentRun"> | Date | string | null
    observationCount?: IntFilter<"ForecastCurrentRun"> | number
    forecastOriginAt?: DateTimeNullableFilter<"ForecastCurrentRun"> | Date | string | null
    modelId?: StringFilter<"ForecastCurrentRun"> | string
    methodVersion?: StringFilter<"ForecastCurrentRun"> | string
    status?: StringFilter<"ForecastCurrentRun"> | string
    failureReason?: StringNullableFilter<"ForecastCurrentRun"> | string | null
    runtimeSeconds?: FloatNullableFilter<"ForecastCurrentRun"> | number | null
    createdAt?: DateTimeFilter<"ForecastCurrentRun"> | Date | string
    updatedAt?: DateTimeFilter<"ForecastCurrentRun"> | Date | string
    points?: ForecastCurrentPointListRelationFilter
  }, "id" | "seriesId_inputSource_historyFingerprint_targetBasis_methodId_modelId_methodVersion">

  export type ForecastCurrentRunOrderByWithAggregationInput = {
    id?: SortOrder
    seriesId?: SortOrder
    displayName?: SortOrder
    description?: SortOrderInput | SortOrder
    frequency?: SortOrderInput | SortOrder
    currency?: SortOrderInput | SortOrder
    unit?: SortOrderInput | SortOrder
    sourceLabel?: SortOrderInput | SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrderInput | SortOrder
    historyFingerprint?: SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    historyStartAt?: SortOrderInput | SortOrder
    historyEndAt?: SortOrderInput | SortOrder
    observationCount?: SortOrder
    forecastOriginAt?: SortOrderInput | SortOrder
    modelId?: SortOrder
    methodVersion?: SortOrder
    status?: SortOrder
    failureReason?: SortOrderInput | SortOrder
    runtimeSeconds?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: ForecastCurrentRunCountOrderByAggregateInput
    _avg?: ForecastCurrentRunAvgOrderByAggregateInput
    _max?: ForecastCurrentRunMaxOrderByAggregateInput
    _min?: ForecastCurrentRunMinOrderByAggregateInput
    _sum?: ForecastCurrentRunSumOrderByAggregateInput
  }

  export type ForecastCurrentRunScalarWhereWithAggregatesInput = {
    AND?: ForecastCurrentRunScalarWhereWithAggregatesInput | ForecastCurrentRunScalarWhereWithAggregatesInput[]
    OR?: ForecastCurrentRunScalarWhereWithAggregatesInput[]
    NOT?: ForecastCurrentRunScalarWhereWithAggregatesInput | ForecastCurrentRunScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"ForecastCurrentRun"> | string
    seriesId?: StringWithAggregatesFilter<"ForecastCurrentRun"> | string
    displayName?: StringWithAggregatesFilter<"ForecastCurrentRun"> | string
    description?: StringNullableWithAggregatesFilter<"ForecastCurrentRun"> | string | null
    frequency?: StringNullableWithAggregatesFilter<"ForecastCurrentRun"> | string | null
    currency?: StringNullableWithAggregatesFilter<"ForecastCurrentRun"> | string | null
    unit?: StringNullableWithAggregatesFilter<"ForecastCurrentRun"> | string | null
    sourceLabel?: StringNullableWithAggregatesFilter<"ForecastCurrentRun"> | string | null
    inputSource?: StringWithAggregatesFilter<"ForecastCurrentRun"> | string
    inputRunId?: StringNullableWithAggregatesFilter<"ForecastCurrentRun"> | string | null
    historyFingerprint?: StringWithAggregatesFilter<"ForecastCurrentRun"> | string
    targetBasis?: EnumForecastTargetBasisWithAggregatesFilter<"ForecastCurrentRun"> | $Enums.ForecastTargetBasis
    methodId?: StringWithAggregatesFilter<"ForecastCurrentRun"> | string
    historyStartAt?: DateTimeNullableWithAggregatesFilter<"ForecastCurrentRun"> | Date | string | null
    historyEndAt?: DateTimeNullableWithAggregatesFilter<"ForecastCurrentRun"> | Date | string | null
    observationCount?: IntWithAggregatesFilter<"ForecastCurrentRun"> | number
    forecastOriginAt?: DateTimeNullableWithAggregatesFilter<"ForecastCurrentRun"> | Date | string | null
    modelId?: StringWithAggregatesFilter<"ForecastCurrentRun"> | string
    methodVersion?: StringWithAggregatesFilter<"ForecastCurrentRun"> | string
    status?: StringWithAggregatesFilter<"ForecastCurrentRun"> | string
    failureReason?: StringNullableWithAggregatesFilter<"ForecastCurrentRun"> | string | null
    runtimeSeconds?: FloatNullableWithAggregatesFilter<"ForecastCurrentRun"> | number | null
    createdAt?: DateTimeWithAggregatesFilter<"ForecastCurrentRun"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"ForecastCurrentRun"> | Date | string
  }

  export type ForecastCurrentPointWhereInput = {
    AND?: ForecastCurrentPointWhereInput | ForecastCurrentPointWhereInput[]
    OR?: ForecastCurrentPointWhereInput[]
    NOT?: ForecastCurrentPointWhereInput | ForecastCurrentPointWhereInput[]
    id?: StringFilter<"ForecastCurrentPoint"> | string
    runId?: StringFilter<"ForecastCurrentPoint"> | string
    horizonLabel?: StringFilter<"ForecastCurrentPoint"> | string
    horizonSteps?: IntFilter<"ForecastCurrentPoint"> | number
    forecastDate?: DateTimeFilter<"ForecastCurrentPoint"> | Date | string
    forecastValue?: DecimalNullableFilter<"ForecastCurrentPoint"> | Decimal | DecimalJsLike | number | string | null
    fitStatus?: StringNullableFilter<"ForecastCurrentPoint"> | string | null
    failureReason?: StringNullableFilter<"ForecastCurrentPoint"> | string | null
    selectedVariant?: StringNullableFilter<"ForecastCurrentPoint"> | string | null
    selectionMetric?: StringNullableFilter<"ForecastCurrentPoint"> | string | null
    selectionScore?: FloatNullableFilter<"ForecastCurrentPoint"> | number | null
    metadataJson?: JsonNullableFilter<"ForecastCurrentPoint">
    createdAt?: DateTimeFilter<"ForecastCurrentPoint"> | Date | string
    updatedAt?: DateTimeFilter<"ForecastCurrentPoint"> | Date | string
    run?: XOR<ForecastCurrentRunScalarRelationFilter, ForecastCurrentRunWhereInput>
  }

  export type ForecastCurrentPointOrderByWithRelationInput = {
    id?: SortOrder
    runId?: SortOrder
    horizonLabel?: SortOrder
    horizonSteps?: SortOrder
    forecastDate?: SortOrder
    forecastValue?: SortOrderInput | SortOrder
    fitStatus?: SortOrderInput | SortOrder
    failureReason?: SortOrderInput | SortOrder
    selectedVariant?: SortOrderInput | SortOrder
    selectionMetric?: SortOrderInput | SortOrder
    selectionScore?: SortOrderInput | SortOrder
    metadataJson?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    run?: ForecastCurrentRunOrderByWithRelationInput
  }

  export type ForecastCurrentPointWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    runId_horizonLabel?: ForecastCurrentPointRunIdHorizonLabelCompoundUniqueInput
    AND?: ForecastCurrentPointWhereInput | ForecastCurrentPointWhereInput[]
    OR?: ForecastCurrentPointWhereInput[]
    NOT?: ForecastCurrentPointWhereInput | ForecastCurrentPointWhereInput[]
    runId?: StringFilter<"ForecastCurrentPoint"> | string
    horizonLabel?: StringFilter<"ForecastCurrentPoint"> | string
    horizonSteps?: IntFilter<"ForecastCurrentPoint"> | number
    forecastDate?: DateTimeFilter<"ForecastCurrentPoint"> | Date | string
    forecastValue?: DecimalNullableFilter<"ForecastCurrentPoint"> | Decimal | DecimalJsLike | number | string | null
    fitStatus?: StringNullableFilter<"ForecastCurrentPoint"> | string | null
    failureReason?: StringNullableFilter<"ForecastCurrentPoint"> | string | null
    selectedVariant?: StringNullableFilter<"ForecastCurrentPoint"> | string | null
    selectionMetric?: StringNullableFilter<"ForecastCurrentPoint"> | string | null
    selectionScore?: FloatNullableFilter<"ForecastCurrentPoint"> | number | null
    metadataJson?: JsonNullableFilter<"ForecastCurrentPoint">
    createdAt?: DateTimeFilter<"ForecastCurrentPoint"> | Date | string
    updatedAt?: DateTimeFilter<"ForecastCurrentPoint"> | Date | string
    run?: XOR<ForecastCurrentRunScalarRelationFilter, ForecastCurrentRunWhereInput>
  }, "id" | "runId_horizonLabel">

  export type ForecastCurrentPointOrderByWithAggregationInput = {
    id?: SortOrder
    runId?: SortOrder
    horizonLabel?: SortOrder
    horizonSteps?: SortOrder
    forecastDate?: SortOrder
    forecastValue?: SortOrderInput | SortOrder
    fitStatus?: SortOrderInput | SortOrder
    failureReason?: SortOrderInput | SortOrder
    selectedVariant?: SortOrderInput | SortOrder
    selectionMetric?: SortOrderInput | SortOrder
    selectionScore?: SortOrderInput | SortOrder
    metadataJson?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: ForecastCurrentPointCountOrderByAggregateInput
    _avg?: ForecastCurrentPointAvgOrderByAggregateInput
    _max?: ForecastCurrentPointMaxOrderByAggregateInput
    _min?: ForecastCurrentPointMinOrderByAggregateInput
    _sum?: ForecastCurrentPointSumOrderByAggregateInput
  }

  export type ForecastCurrentPointScalarWhereWithAggregatesInput = {
    AND?: ForecastCurrentPointScalarWhereWithAggregatesInput | ForecastCurrentPointScalarWhereWithAggregatesInput[]
    OR?: ForecastCurrentPointScalarWhereWithAggregatesInput[]
    NOT?: ForecastCurrentPointScalarWhereWithAggregatesInput | ForecastCurrentPointScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"ForecastCurrentPoint"> | string
    runId?: StringWithAggregatesFilter<"ForecastCurrentPoint"> | string
    horizonLabel?: StringWithAggregatesFilter<"ForecastCurrentPoint"> | string
    horizonSteps?: IntWithAggregatesFilter<"ForecastCurrentPoint"> | number
    forecastDate?: DateTimeWithAggregatesFilter<"ForecastCurrentPoint"> | Date | string
    forecastValue?: DecimalNullableWithAggregatesFilter<"ForecastCurrentPoint"> | Decimal | DecimalJsLike | number | string | null
    fitStatus?: StringNullableWithAggregatesFilter<"ForecastCurrentPoint"> | string | null
    failureReason?: StringNullableWithAggregatesFilter<"ForecastCurrentPoint"> | string | null
    selectedVariant?: StringNullableWithAggregatesFilter<"ForecastCurrentPoint"> | string | null
    selectionMetric?: StringNullableWithAggregatesFilter<"ForecastCurrentPoint"> | string | null
    selectionScore?: FloatNullableWithAggregatesFilter<"ForecastCurrentPoint"> | number | null
    metadataJson?: JsonNullableWithAggregatesFilter<"ForecastCurrentPoint">
    createdAt?: DateTimeWithAggregatesFilter<"ForecastCurrentPoint"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"ForecastCurrentPoint"> | Date | string
  }

  export type ForecastVerificationRunWhereInput = {
    AND?: ForecastVerificationRunWhereInput | ForecastVerificationRunWhereInput[]
    OR?: ForecastVerificationRunWhereInput[]
    NOT?: ForecastVerificationRunWhereInput | ForecastVerificationRunWhereInput[]
    id?: StringFilter<"ForecastVerificationRun"> | string
    seriesId?: StringFilter<"ForecastVerificationRun"> | string
    displayName?: StringFilter<"ForecastVerificationRun"> | string
    description?: StringNullableFilter<"ForecastVerificationRun"> | string | null
    frequency?: StringNullableFilter<"ForecastVerificationRun"> | string | null
    currency?: StringNullableFilter<"ForecastVerificationRun"> | string | null
    unit?: StringNullableFilter<"ForecastVerificationRun"> | string | null
    sourceLabel?: StringNullableFilter<"ForecastVerificationRun"> | string | null
    inputSource?: StringFilter<"ForecastVerificationRun"> | string
    inputRunId?: StringNullableFilter<"ForecastVerificationRun"> | string | null
    historyFingerprint?: StringFilter<"ForecastVerificationRun"> | string
    targetBasis?: EnumForecastTargetBasisFilter<"ForecastVerificationRun"> | $Enums.ForecastTargetBasis
    methodId?: StringFilter<"ForecastVerificationRun"> | string
    historyStartAt?: DateTimeNullableFilter<"ForecastVerificationRun"> | Date | string | null
    historyEndAt?: DateTimeNullableFilter<"ForecastVerificationRun"> | Date | string | null
    observationCount?: IntFilter<"ForecastVerificationRun"> | number
    forecastOriginAt?: DateTimeNullableFilter<"ForecastVerificationRun"> | Date | string | null
    modelId?: StringFilter<"ForecastVerificationRun"> | string
    methodVersion?: StringFilter<"ForecastVerificationRun"> | string
    status?: StringFilter<"ForecastVerificationRun"> | string
    failureReason?: StringNullableFilter<"ForecastVerificationRun"> | string | null
    runtimeSeconds?: FloatNullableFilter<"ForecastVerificationRun"> | number | null
    createdAt?: DateTimeFilter<"ForecastVerificationRun"> | Date | string
    updatedAt?: DateTimeFilter<"ForecastVerificationRun"> | Date | string
    metrics?: ForecastVerificationMetricListRelationFilter
    points?: ForecastVerificationPointListRelationFilter
  }

  export type ForecastVerificationRunOrderByWithRelationInput = {
    id?: SortOrder
    seriesId?: SortOrder
    displayName?: SortOrder
    description?: SortOrderInput | SortOrder
    frequency?: SortOrderInput | SortOrder
    currency?: SortOrderInput | SortOrder
    unit?: SortOrderInput | SortOrder
    sourceLabel?: SortOrderInput | SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrderInput | SortOrder
    historyFingerprint?: SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    historyStartAt?: SortOrderInput | SortOrder
    historyEndAt?: SortOrderInput | SortOrder
    observationCount?: SortOrder
    forecastOriginAt?: SortOrderInput | SortOrder
    modelId?: SortOrder
    methodVersion?: SortOrder
    status?: SortOrder
    failureReason?: SortOrderInput | SortOrder
    runtimeSeconds?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    metrics?: ForecastVerificationMetricOrderByRelationAggregateInput
    points?: ForecastVerificationPointOrderByRelationAggregateInput
  }

  export type ForecastVerificationRunWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    seriesId_inputSource_historyFingerprint_targetBasis_methodId_modelId_methodVersion?: ForecastVerificationRunSeriesIdInputSourceHistoryFingerprintTargetBasisMethodIdModelIdMethodVersionCompoundUniqueInput
    AND?: ForecastVerificationRunWhereInput | ForecastVerificationRunWhereInput[]
    OR?: ForecastVerificationRunWhereInput[]
    NOT?: ForecastVerificationRunWhereInput | ForecastVerificationRunWhereInput[]
    seriesId?: StringFilter<"ForecastVerificationRun"> | string
    displayName?: StringFilter<"ForecastVerificationRun"> | string
    description?: StringNullableFilter<"ForecastVerificationRun"> | string | null
    frequency?: StringNullableFilter<"ForecastVerificationRun"> | string | null
    currency?: StringNullableFilter<"ForecastVerificationRun"> | string | null
    unit?: StringNullableFilter<"ForecastVerificationRun"> | string | null
    sourceLabel?: StringNullableFilter<"ForecastVerificationRun"> | string | null
    inputSource?: StringFilter<"ForecastVerificationRun"> | string
    inputRunId?: StringNullableFilter<"ForecastVerificationRun"> | string | null
    historyFingerprint?: StringFilter<"ForecastVerificationRun"> | string
    targetBasis?: EnumForecastTargetBasisFilter<"ForecastVerificationRun"> | $Enums.ForecastTargetBasis
    methodId?: StringFilter<"ForecastVerificationRun"> | string
    historyStartAt?: DateTimeNullableFilter<"ForecastVerificationRun"> | Date | string | null
    historyEndAt?: DateTimeNullableFilter<"ForecastVerificationRun"> | Date | string | null
    observationCount?: IntFilter<"ForecastVerificationRun"> | number
    forecastOriginAt?: DateTimeNullableFilter<"ForecastVerificationRun"> | Date | string | null
    modelId?: StringFilter<"ForecastVerificationRun"> | string
    methodVersion?: StringFilter<"ForecastVerificationRun"> | string
    status?: StringFilter<"ForecastVerificationRun"> | string
    failureReason?: StringNullableFilter<"ForecastVerificationRun"> | string | null
    runtimeSeconds?: FloatNullableFilter<"ForecastVerificationRun"> | number | null
    createdAt?: DateTimeFilter<"ForecastVerificationRun"> | Date | string
    updatedAt?: DateTimeFilter<"ForecastVerificationRun"> | Date | string
    metrics?: ForecastVerificationMetricListRelationFilter
    points?: ForecastVerificationPointListRelationFilter
  }, "id" | "seriesId_inputSource_historyFingerprint_targetBasis_methodId_modelId_methodVersion">

  export type ForecastVerificationRunOrderByWithAggregationInput = {
    id?: SortOrder
    seriesId?: SortOrder
    displayName?: SortOrder
    description?: SortOrderInput | SortOrder
    frequency?: SortOrderInput | SortOrder
    currency?: SortOrderInput | SortOrder
    unit?: SortOrderInput | SortOrder
    sourceLabel?: SortOrderInput | SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrderInput | SortOrder
    historyFingerprint?: SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    historyStartAt?: SortOrderInput | SortOrder
    historyEndAt?: SortOrderInput | SortOrder
    observationCount?: SortOrder
    forecastOriginAt?: SortOrderInput | SortOrder
    modelId?: SortOrder
    methodVersion?: SortOrder
    status?: SortOrder
    failureReason?: SortOrderInput | SortOrder
    runtimeSeconds?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: ForecastVerificationRunCountOrderByAggregateInput
    _avg?: ForecastVerificationRunAvgOrderByAggregateInput
    _max?: ForecastVerificationRunMaxOrderByAggregateInput
    _min?: ForecastVerificationRunMinOrderByAggregateInput
    _sum?: ForecastVerificationRunSumOrderByAggregateInput
  }

  export type ForecastVerificationRunScalarWhereWithAggregatesInput = {
    AND?: ForecastVerificationRunScalarWhereWithAggregatesInput | ForecastVerificationRunScalarWhereWithAggregatesInput[]
    OR?: ForecastVerificationRunScalarWhereWithAggregatesInput[]
    NOT?: ForecastVerificationRunScalarWhereWithAggregatesInput | ForecastVerificationRunScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"ForecastVerificationRun"> | string
    seriesId?: StringWithAggregatesFilter<"ForecastVerificationRun"> | string
    displayName?: StringWithAggregatesFilter<"ForecastVerificationRun"> | string
    description?: StringNullableWithAggregatesFilter<"ForecastVerificationRun"> | string | null
    frequency?: StringNullableWithAggregatesFilter<"ForecastVerificationRun"> | string | null
    currency?: StringNullableWithAggregatesFilter<"ForecastVerificationRun"> | string | null
    unit?: StringNullableWithAggregatesFilter<"ForecastVerificationRun"> | string | null
    sourceLabel?: StringNullableWithAggregatesFilter<"ForecastVerificationRun"> | string | null
    inputSource?: StringWithAggregatesFilter<"ForecastVerificationRun"> | string
    inputRunId?: StringNullableWithAggregatesFilter<"ForecastVerificationRun"> | string | null
    historyFingerprint?: StringWithAggregatesFilter<"ForecastVerificationRun"> | string
    targetBasis?: EnumForecastTargetBasisWithAggregatesFilter<"ForecastVerificationRun"> | $Enums.ForecastTargetBasis
    methodId?: StringWithAggregatesFilter<"ForecastVerificationRun"> | string
    historyStartAt?: DateTimeNullableWithAggregatesFilter<"ForecastVerificationRun"> | Date | string | null
    historyEndAt?: DateTimeNullableWithAggregatesFilter<"ForecastVerificationRun"> | Date | string | null
    observationCount?: IntWithAggregatesFilter<"ForecastVerificationRun"> | number
    forecastOriginAt?: DateTimeNullableWithAggregatesFilter<"ForecastVerificationRun"> | Date | string | null
    modelId?: StringWithAggregatesFilter<"ForecastVerificationRun"> | string
    methodVersion?: StringWithAggregatesFilter<"ForecastVerificationRun"> | string
    status?: StringWithAggregatesFilter<"ForecastVerificationRun"> | string
    failureReason?: StringNullableWithAggregatesFilter<"ForecastVerificationRun"> | string | null
    runtimeSeconds?: FloatNullableWithAggregatesFilter<"ForecastVerificationRun"> | number | null
    createdAt?: DateTimeWithAggregatesFilter<"ForecastVerificationRun"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"ForecastVerificationRun"> | Date | string
  }

  export type ForecastVerificationMetricWhereInput = {
    AND?: ForecastVerificationMetricWhereInput | ForecastVerificationMetricWhereInput[]
    OR?: ForecastVerificationMetricWhereInput[]
    NOT?: ForecastVerificationMetricWhereInput | ForecastVerificationMetricWhereInput[]
    id?: StringFilter<"ForecastVerificationMetric"> | string
    runId?: StringFilter<"ForecastVerificationMetric"> | string
    horizonLabel?: StringFilter<"ForecastVerificationMetric"> | string
    horizonSteps?: IntFilter<"ForecastVerificationMetric"> | number
    origins?: IntFilter<"ForecastVerificationMetric"> | number
    expectedOrigins?: IntFilter<"ForecastVerificationMetric"> | number
    failedOrigins?: IntFilter<"ForecastVerificationMetric"> | number
    coverage?: FloatFilter<"ForecastVerificationMetric"> | number
    mae?: FloatNullableFilter<"ForecastVerificationMetric"> | number | null
    rmse?: FloatNullableFilter<"ForecastVerificationMetric"> | number | null
    mase?: FloatNullableFilter<"ForecastVerificationMetric"> | number | null
    smape?: FloatNullableFilter<"ForecastVerificationMetric"> | number | null
    directionalAccuracy?: FloatNullableFilter<"ForecastVerificationMetric"> | number | null
    bias?: FloatNullableFilter<"ForecastVerificationMetric"> | number | null
    failureSummaryJson?: JsonNullableFilter<"ForecastVerificationMetric">
    createdAt?: DateTimeFilter<"ForecastVerificationMetric"> | Date | string
    updatedAt?: DateTimeFilter<"ForecastVerificationMetric"> | Date | string
    run?: XOR<ForecastVerificationRunScalarRelationFilter, ForecastVerificationRunWhereInput>
  }

  export type ForecastVerificationMetricOrderByWithRelationInput = {
    id?: SortOrder
    runId?: SortOrder
    horizonLabel?: SortOrder
    horizonSteps?: SortOrder
    origins?: SortOrder
    expectedOrigins?: SortOrder
    failedOrigins?: SortOrder
    coverage?: SortOrder
    mae?: SortOrderInput | SortOrder
    rmse?: SortOrderInput | SortOrder
    mase?: SortOrderInput | SortOrder
    smape?: SortOrderInput | SortOrder
    directionalAccuracy?: SortOrderInput | SortOrder
    bias?: SortOrderInput | SortOrder
    failureSummaryJson?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    run?: ForecastVerificationRunOrderByWithRelationInput
  }

  export type ForecastVerificationMetricWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    runId_horizonLabel?: ForecastVerificationMetricRunIdHorizonLabelCompoundUniqueInput
    AND?: ForecastVerificationMetricWhereInput | ForecastVerificationMetricWhereInput[]
    OR?: ForecastVerificationMetricWhereInput[]
    NOT?: ForecastVerificationMetricWhereInput | ForecastVerificationMetricWhereInput[]
    runId?: StringFilter<"ForecastVerificationMetric"> | string
    horizonLabel?: StringFilter<"ForecastVerificationMetric"> | string
    horizonSteps?: IntFilter<"ForecastVerificationMetric"> | number
    origins?: IntFilter<"ForecastVerificationMetric"> | number
    expectedOrigins?: IntFilter<"ForecastVerificationMetric"> | number
    failedOrigins?: IntFilter<"ForecastVerificationMetric"> | number
    coverage?: FloatFilter<"ForecastVerificationMetric"> | number
    mae?: FloatNullableFilter<"ForecastVerificationMetric"> | number | null
    rmse?: FloatNullableFilter<"ForecastVerificationMetric"> | number | null
    mase?: FloatNullableFilter<"ForecastVerificationMetric"> | number | null
    smape?: FloatNullableFilter<"ForecastVerificationMetric"> | number | null
    directionalAccuracy?: FloatNullableFilter<"ForecastVerificationMetric"> | number | null
    bias?: FloatNullableFilter<"ForecastVerificationMetric"> | number | null
    failureSummaryJson?: JsonNullableFilter<"ForecastVerificationMetric">
    createdAt?: DateTimeFilter<"ForecastVerificationMetric"> | Date | string
    updatedAt?: DateTimeFilter<"ForecastVerificationMetric"> | Date | string
    run?: XOR<ForecastVerificationRunScalarRelationFilter, ForecastVerificationRunWhereInput>
  }, "id" | "runId_horizonLabel">

  export type ForecastVerificationMetricOrderByWithAggregationInput = {
    id?: SortOrder
    runId?: SortOrder
    horizonLabel?: SortOrder
    horizonSteps?: SortOrder
    origins?: SortOrder
    expectedOrigins?: SortOrder
    failedOrigins?: SortOrder
    coverage?: SortOrder
    mae?: SortOrderInput | SortOrder
    rmse?: SortOrderInput | SortOrder
    mase?: SortOrderInput | SortOrder
    smape?: SortOrderInput | SortOrder
    directionalAccuracy?: SortOrderInput | SortOrder
    bias?: SortOrderInput | SortOrder
    failureSummaryJson?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: ForecastVerificationMetricCountOrderByAggregateInput
    _avg?: ForecastVerificationMetricAvgOrderByAggregateInput
    _max?: ForecastVerificationMetricMaxOrderByAggregateInput
    _min?: ForecastVerificationMetricMinOrderByAggregateInput
    _sum?: ForecastVerificationMetricSumOrderByAggregateInput
  }

  export type ForecastVerificationMetricScalarWhereWithAggregatesInput = {
    AND?: ForecastVerificationMetricScalarWhereWithAggregatesInput | ForecastVerificationMetricScalarWhereWithAggregatesInput[]
    OR?: ForecastVerificationMetricScalarWhereWithAggregatesInput[]
    NOT?: ForecastVerificationMetricScalarWhereWithAggregatesInput | ForecastVerificationMetricScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"ForecastVerificationMetric"> | string
    runId?: StringWithAggregatesFilter<"ForecastVerificationMetric"> | string
    horizonLabel?: StringWithAggregatesFilter<"ForecastVerificationMetric"> | string
    horizonSteps?: IntWithAggregatesFilter<"ForecastVerificationMetric"> | number
    origins?: IntWithAggregatesFilter<"ForecastVerificationMetric"> | number
    expectedOrigins?: IntWithAggregatesFilter<"ForecastVerificationMetric"> | number
    failedOrigins?: IntWithAggregatesFilter<"ForecastVerificationMetric"> | number
    coverage?: FloatWithAggregatesFilter<"ForecastVerificationMetric"> | number
    mae?: FloatNullableWithAggregatesFilter<"ForecastVerificationMetric"> | number | null
    rmse?: FloatNullableWithAggregatesFilter<"ForecastVerificationMetric"> | number | null
    mase?: FloatNullableWithAggregatesFilter<"ForecastVerificationMetric"> | number | null
    smape?: FloatNullableWithAggregatesFilter<"ForecastVerificationMetric"> | number | null
    directionalAccuracy?: FloatNullableWithAggregatesFilter<"ForecastVerificationMetric"> | number | null
    bias?: FloatNullableWithAggregatesFilter<"ForecastVerificationMetric"> | number | null
    failureSummaryJson?: JsonNullableWithAggregatesFilter<"ForecastVerificationMetric">
    createdAt?: DateTimeWithAggregatesFilter<"ForecastVerificationMetric"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"ForecastVerificationMetric"> | Date | string
  }

  export type ForecastVerificationPointWhereInput = {
    AND?: ForecastVerificationPointWhereInput | ForecastVerificationPointWhereInput[]
    OR?: ForecastVerificationPointWhereInput[]
    NOT?: ForecastVerificationPointWhereInput | ForecastVerificationPointWhereInput[]
    id?: StringFilter<"ForecastVerificationPoint"> | string
    runId?: StringFilter<"ForecastVerificationPoint"> | string
    horizonLabel?: StringFilter<"ForecastVerificationPoint"> | string
    horizonSteps?: IntFilter<"ForecastVerificationPoint"> | number
    forecastOriginAt?: DateTimeFilter<"ForecastVerificationPoint"> | Date | string
    targetDate?: DateTimeFilter<"ForecastVerificationPoint"> | Date | string
    actualObservedAt?: DateTimeNullableFilter<"ForecastVerificationPoint"> | Date | string | null
    originValue?: DecimalFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    forecastValue?: DecimalFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    actualValue?: DecimalFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    errorValue?: DecimalFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    absoluteErrorValue?: DecimalFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    deltaValue?: DecimalFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    deltaPct?: FloatNullableFilter<"ForecastVerificationPoint"> | number | null
    maseScale?: DecimalFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    selectedVariant?: StringNullableFilter<"ForecastVerificationPoint"> | string | null
    selectionMetric?: StringNullableFilter<"ForecastVerificationPoint"> | string | null
    selectionScore?: FloatNullableFilter<"ForecastVerificationPoint"> | number | null
    metadataJson?: JsonNullableFilter<"ForecastVerificationPoint">
    createdAt?: DateTimeFilter<"ForecastVerificationPoint"> | Date | string
    updatedAt?: DateTimeFilter<"ForecastVerificationPoint"> | Date | string
    run?: XOR<ForecastVerificationRunScalarRelationFilter, ForecastVerificationRunWhereInput>
  }

  export type ForecastVerificationPointOrderByWithRelationInput = {
    id?: SortOrder
    runId?: SortOrder
    horizonLabel?: SortOrder
    horizonSteps?: SortOrder
    forecastOriginAt?: SortOrder
    targetDate?: SortOrder
    actualObservedAt?: SortOrderInput | SortOrder
    originValue?: SortOrder
    forecastValue?: SortOrder
    actualValue?: SortOrder
    errorValue?: SortOrder
    absoluteErrorValue?: SortOrder
    deltaValue?: SortOrder
    deltaPct?: SortOrderInput | SortOrder
    maseScale?: SortOrder
    selectedVariant?: SortOrderInput | SortOrder
    selectionMetric?: SortOrderInput | SortOrder
    selectionScore?: SortOrderInput | SortOrder
    metadataJson?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    run?: ForecastVerificationRunOrderByWithRelationInput
  }

  export type ForecastVerificationPointWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    runId_horizonLabel_forecastOriginAt_targetDate?: ForecastVerificationPointRunIdHorizonLabelForecastOriginAtTargetDateCompoundUniqueInput
    AND?: ForecastVerificationPointWhereInput | ForecastVerificationPointWhereInput[]
    OR?: ForecastVerificationPointWhereInput[]
    NOT?: ForecastVerificationPointWhereInput | ForecastVerificationPointWhereInput[]
    runId?: StringFilter<"ForecastVerificationPoint"> | string
    horizonLabel?: StringFilter<"ForecastVerificationPoint"> | string
    horizonSteps?: IntFilter<"ForecastVerificationPoint"> | number
    forecastOriginAt?: DateTimeFilter<"ForecastVerificationPoint"> | Date | string
    targetDate?: DateTimeFilter<"ForecastVerificationPoint"> | Date | string
    actualObservedAt?: DateTimeNullableFilter<"ForecastVerificationPoint"> | Date | string | null
    originValue?: DecimalFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    forecastValue?: DecimalFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    actualValue?: DecimalFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    errorValue?: DecimalFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    absoluteErrorValue?: DecimalFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    deltaValue?: DecimalFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    deltaPct?: FloatNullableFilter<"ForecastVerificationPoint"> | number | null
    maseScale?: DecimalFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    selectedVariant?: StringNullableFilter<"ForecastVerificationPoint"> | string | null
    selectionMetric?: StringNullableFilter<"ForecastVerificationPoint"> | string | null
    selectionScore?: FloatNullableFilter<"ForecastVerificationPoint"> | number | null
    metadataJson?: JsonNullableFilter<"ForecastVerificationPoint">
    createdAt?: DateTimeFilter<"ForecastVerificationPoint"> | Date | string
    updatedAt?: DateTimeFilter<"ForecastVerificationPoint"> | Date | string
    run?: XOR<ForecastVerificationRunScalarRelationFilter, ForecastVerificationRunWhereInput>
  }, "id" | "runId_horizonLabel_forecastOriginAt_targetDate">

  export type ForecastVerificationPointOrderByWithAggregationInput = {
    id?: SortOrder
    runId?: SortOrder
    horizonLabel?: SortOrder
    horizonSteps?: SortOrder
    forecastOriginAt?: SortOrder
    targetDate?: SortOrder
    actualObservedAt?: SortOrderInput | SortOrder
    originValue?: SortOrder
    forecastValue?: SortOrder
    actualValue?: SortOrder
    errorValue?: SortOrder
    absoluteErrorValue?: SortOrder
    deltaValue?: SortOrder
    deltaPct?: SortOrderInput | SortOrder
    maseScale?: SortOrder
    selectedVariant?: SortOrderInput | SortOrder
    selectionMetric?: SortOrderInput | SortOrder
    selectionScore?: SortOrderInput | SortOrder
    metadataJson?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: ForecastVerificationPointCountOrderByAggregateInput
    _avg?: ForecastVerificationPointAvgOrderByAggregateInput
    _max?: ForecastVerificationPointMaxOrderByAggregateInput
    _min?: ForecastVerificationPointMinOrderByAggregateInput
    _sum?: ForecastVerificationPointSumOrderByAggregateInput
  }

  export type ForecastVerificationPointScalarWhereWithAggregatesInput = {
    AND?: ForecastVerificationPointScalarWhereWithAggregatesInput | ForecastVerificationPointScalarWhereWithAggregatesInput[]
    OR?: ForecastVerificationPointScalarWhereWithAggregatesInput[]
    NOT?: ForecastVerificationPointScalarWhereWithAggregatesInput | ForecastVerificationPointScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"ForecastVerificationPoint"> | string
    runId?: StringWithAggregatesFilter<"ForecastVerificationPoint"> | string
    horizonLabel?: StringWithAggregatesFilter<"ForecastVerificationPoint"> | string
    horizonSteps?: IntWithAggregatesFilter<"ForecastVerificationPoint"> | number
    forecastOriginAt?: DateTimeWithAggregatesFilter<"ForecastVerificationPoint"> | Date | string
    targetDate?: DateTimeWithAggregatesFilter<"ForecastVerificationPoint"> | Date | string
    actualObservedAt?: DateTimeNullableWithAggregatesFilter<"ForecastVerificationPoint"> | Date | string | null
    originValue?: DecimalWithAggregatesFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    forecastValue?: DecimalWithAggregatesFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    actualValue?: DecimalWithAggregatesFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    errorValue?: DecimalWithAggregatesFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    absoluteErrorValue?: DecimalWithAggregatesFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    deltaValue?: DecimalWithAggregatesFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    deltaPct?: FloatNullableWithAggregatesFilter<"ForecastVerificationPoint"> | number | null
    maseScale?: DecimalWithAggregatesFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    selectedVariant?: StringNullableWithAggregatesFilter<"ForecastVerificationPoint"> | string | null
    selectionMetric?: StringNullableWithAggregatesFilter<"ForecastVerificationPoint"> | string | null
    selectionScore?: FloatNullableWithAggregatesFilter<"ForecastVerificationPoint"> | number | null
    metadataJson?: JsonNullableWithAggregatesFilter<"ForecastVerificationPoint">
    createdAt?: DateTimeWithAggregatesFilter<"ForecastVerificationPoint"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"ForecastVerificationPoint"> | Date | string
  }

  export type RollingDailyVerificationRecordWhereInput = {
    AND?: RollingDailyVerificationRecordWhereInput | RollingDailyVerificationRecordWhereInput[]
    OR?: RollingDailyVerificationRecordWhereInput[]
    NOT?: RollingDailyVerificationRecordWhereInput | RollingDailyVerificationRecordWhereInput[]
    id?: StringFilter<"RollingDailyVerificationRecord"> | string
    seriesId?: StringFilter<"RollingDailyVerificationRecord"> | string
    inputSource?: StringFilter<"RollingDailyVerificationRecord"> | string
    inputRunId?: StringNullableFilter<"RollingDailyVerificationRecord"> | string | null
    targetBasis?: EnumForecastTargetBasisFilter<"RollingDailyVerificationRecord"> | $Enums.ForecastTargetBasis
    methodId?: StringFilter<"RollingDailyVerificationRecord"> | string
    methodVersion?: StringFilter<"RollingDailyVerificationRecord"> | string
    modelId?: StringFilter<"RollingDailyVerificationRecord"> | string
    forecastOriginAt?: DateTimeFilter<"RollingDailyVerificationRecord"> | Date | string
    horizonLabel?: StringFilter<"RollingDailyVerificationRecord"> | string
    horizonMonths?: IntFilter<"RollingDailyVerificationRecord"> | number
    horizonSteps?: IntFilter<"RollingDailyVerificationRecord"> | number
    targetCalendarDate?: DateTimeFilter<"RollingDailyVerificationRecord"> | Date | string
    verificationObservedAt?: DateTimeNullableFilter<"RollingDailyVerificationRecord"> | Date | string | null
    maturityStatus?: EnumRollingDailyVerificationMaturityStatusFilter<"RollingDailyVerificationRecord"> | $Enums.RollingDailyVerificationMaturityStatus
    originValue?: DecimalFilter<"RollingDailyVerificationRecord"> | Decimal | DecimalJsLike | number | string
    forecastValue?: DecimalFilter<"RollingDailyVerificationRecord"> | Decimal | DecimalJsLike | number | string
    actualValue?: DecimalNullableFilter<"RollingDailyVerificationRecord"> | Decimal | DecimalJsLike | number | string | null
    errorValue?: DecimalNullableFilter<"RollingDailyVerificationRecord"> | Decimal | DecimalJsLike | number | string | null
    absoluteErrorValue?: DecimalNullableFilter<"RollingDailyVerificationRecord"> | Decimal | DecimalJsLike | number | string | null
    deltaValue?: DecimalNullableFilter<"RollingDailyVerificationRecord"> | Decimal | DecimalJsLike | number | string | null
    deltaPct?: FloatNullableFilter<"RollingDailyVerificationRecord"> | number | null
    residualValue?: DecimalNullableFilter<"RollingDailyVerificationRecord"> | Decimal | DecimalJsLike | number | string | null
    maseScale?: FloatFilter<"RollingDailyVerificationRecord"> | number
    trainingHistoryStartAt?: DateTimeNullableFilter<"RollingDailyVerificationRecord"> | Date | string | null
    trainingHistoryEndAt?: DateTimeFilter<"RollingDailyVerificationRecord"> | Date | string
    trainingObservationCount?: IntFilter<"RollingDailyVerificationRecord"> | number
    sourceHistoryFingerprint?: StringFilter<"RollingDailyVerificationRecord"> | string
    selectedVariant?: StringNullableFilter<"RollingDailyVerificationRecord"> | string | null
    selectionMetric?: StringNullableFilter<"RollingDailyVerificationRecord"> | string | null
    selectionScore?: FloatNullableFilter<"RollingDailyVerificationRecord"> | number | null
    metadataJson?: JsonNullableFilter<"RollingDailyVerificationRecord">
    createdAt?: DateTimeFilter<"RollingDailyVerificationRecord"> | Date | string
    updatedAt?: DateTimeFilter<"RollingDailyVerificationRecord"> | Date | string
  }

  export type RollingDailyVerificationRecordOrderByWithRelationInput = {
    id?: SortOrder
    seriesId?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrderInput | SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    methodVersion?: SortOrder
    modelId?: SortOrder
    forecastOriginAt?: SortOrder
    horizonLabel?: SortOrder
    horizonMonths?: SortOrder
    horizonSteps?: SortOrder
    targetCalendarDate?: SortOrder
    verificationObservedAt?: SortOrderInput | SortOrder
    maturityStatus?: SortOrder
    originValue?: SortOrder
    forecastValue?: SortOrder
    actualValue?: SortOrderInput | SortOrder
    errorValue?: SortOrderInput | SortOrder
    absoluteErrorValue?: SortOrderInput | SortOrder
    deltaValue?: SortOrderInput | SortOrder
    deltaPct?: SortOrderInput | SortOrder
    residualValue?: SortOrderInput | SortOrder
    maseScale?: SortOrder
    trainingHistoryStartAt?: SortOrderInput | SortOrder
    trainingHistoryEndAt?: SortOrder
    trainingObservationCount?: SortOrder
    sourceHistoryFingerprint?: SortOrder
    selectedVariant?: SortOrderInput | SortOrder
    selectionMetric?: SortOrderInput | SortOrder
    selectionScore?: SortOrderInput | SortOrder
    metadataJson?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type RollingDailyVerificationRecordWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    seriesId_inputSource_targetBasis_methodId_methodVersion_modelId_forecastOriginAt_horizonLabel?: RollingDailyVerificationRecordSeriesIdInputSourceTargetBasisMethodIdMethodVersionModelIdForecastOriginAtHorizonLabelCompoundUniqueInput
    AND?: RollingDailyVerificationRecordWhereInput | RollingDailyVerificationRecordWhereInput[]
    OR?: RollingDailyVerificationRecordWhereInput[]
    NOT?: RollingDailyVerificationRecordWhereInput | RollingDailyVerificationRecordWhereInput[]
    seriesId?: StringFilter<"RollingDailyVerificationRecord"> | string
    inputSource?: StringFilter<"RollingDailyVerificationRecord"> | string
    inputRunId?: StringNullableFilter<"RollingDailyVerificationRecord"> | string | null
    targetBasis?: EnumForecastTargetBasisFilter<"RollingDailyVerificationRecord"> | $Enums.ForecastTargetBasis
    methodId?: StringFilter<"RollingDailyVerificationRecord"> | string
    methodVersion?: StringFilter<"RollingDailyVerificationRecord"> | string
    modelId?: StringFilter<"RollingDailyVerificationRecord"> | string
    forecastOriginAt?: DateTimeFilter<"RollingDailyVerificationRecord"> | Date | string
    horizonLabel?: StringFilter<"RollingDailyVerificationRecord"> | string
    horizonMonths?: IntFilter<"RollingDailyVerificationRecord"> | number
    horizonSteps?: IntFilter<"RollingDailyVerificationRecord"> | number
    targetCalendarDate?: DateTimeFilter<"RollingDailyVerificationRecord"> | Date | string
    verificationObservedAt?: DateTimeNullableFilter<"RollingDailyVerificationRecord"> | Date | string | null
    maturityStatus?: EnumRollingDailyVerificationMaturityStatusFilter<"RollingDailyVerificationRecord"> | $Enums.RollingDailyVerificationMaturityStatus
    originValue?: DecimalFilter<"RollingDailyVerificationRecord"> | Decimal | DecimalJsLike | number | string
    forecastValue?: DecimalFilter<"RollingDailyVerificationRecord"> | Decimal | DecimalJsLike | number | string
    actualValue?: DecimalNullableFilter<"RollingDailyVerificationRecord"> | Decimal | DecimalJsLike | number | string | null
    errorValue?: DecimalNullableFilter<"RollingDailyVerificationRecord"> | Decimal | DecimalJsLike | number | string | null
    absoluteErrorValue?: DecimalNullableFilter<"RollingDailyVerificationRecord"> | Decimal | DecimalJsLike | number | string | null
    deltaValue?: DecimalNullableFilter<"RollingDailyVerificationRecord"> | Decimal | DecimalJsLike | number | string | null
    deltaPct?: FloatNullableFilter<"RollingDailyVerificationRecord"> | number | null
    residualValue?: DecimalNullableFilter<"RollingDailyVerificationRecord"> | Decimal | DecimalJsLike | number | string | null
    maseScale?: FloatFilter<"RollingDailyVerificationRecord"> | number
    trainingHistoryStartAt?: DateTimeNullableFilter<"RollingDailyVerificationRecord"> | Date | string | null
    trainingHistoryEndAt?: DateTimeFilter<"RollingDailyVerificationRecord"> | Date | string
    trainingObservationCount?: IntFilter<"RollingDailyVerificationRecord"> | number
    sourceHistoryFingerprint?: StringFilter<"RollingDailyVerificationRecord"> | string
    selectedVariant?: StringNullableFilter<"RollingDailyVerificationRecord"> | string | null
    selectionMetric?: StringNullableFilter<"RollingDailyVerificationRecord"> | string | null
    selectionScore?: FloatNullableFilter<"RollingDailyVerificationRecord"> | number | null
    metadataJson?: JsonNullableFilter<"RollingDailyVerificationRecord">
    createdAt?: DateTimeFilter<"RollingDailyVerificationRecord"> | Date | string
    updatedAt?: DateTimeFilter<"RollingDailyVerificationRecord"> | Date | string
  }, "id" | "seriesId_inputSource_targetBasis_methodId_methodVersion_modelId_forecastOriginAt_horizonLabel">

  export type RollingDailyVerificationRecordOrderByWithAggregationInput = {
    id?: SortOrder
    seriesId?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrderInput | SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    methodVersion?: SortOrder
    modelId?: SortOrder
    forecastOriginAt?: SortOrder
    horizonLabel?: SortOrder
    horizonMonths?: SortOrder
    horizonSteps?: SortOrder
    targetCalendarDate?: SortOrder
    verificationObservedAt?: SortOrderInput | SortOrder
    maturityStatus?: SortOrder
    originValue?: SortOrder
    forecastValue?: SortOrder
    actualValue?: SortOrderInput | SortOrder
    errorValue?: SortOrderInput | SortOrder
    absoluteErrorValue?: SortOrderInput | SortOrder
    deltaValue?: SortOrderInput | SortOrder
    deltaPct?: SortOrderInput | SortOrder
    residualValue?: SortOrderInput | SortOrder
    maseScale?: SortOrder
    trainingHistoryStartAt?: SortOrderInput | SortOrder
    trainingHistoryEndAt?: SortOrder
    trainingObservationCount?: SortOrder
    sourceHistoryFingerprint?: SortOrder
    selectedVariant?: SortOrderInput | SortOrder
    selectionMetric?: SortOrderInput | SortOrder
    selectionScore?: SortOrderInput | SortOrder
    metadataJson?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: RollingDailyVerificationRecordCountOrderByAggregateInput
    _avg?: RollingDailyVerificationRecordAvgOrderByAggregateInput
    _max?: RollingDailyVerificationRecordMaxOrderByAggregateInput
    _min?: RollingDailyVerificationRecordMinOrderByAggregateInput
    _sum?: RollingDailyVerificationRecordSumOrderByAggregateInput
  }

  export type RollingDailyVerificationRecordScalarWhereWithAggregatesInput = {
    AND?: RollingDailyVerificationRecordScalarWhereWithAggregatesInput | RollingDailyVerificationRecordScalarWhereWithAggregatesInput[]
    OR?: RollingDailyVerificationRecordScalarWhereWithAggregatesInput[]
    NOT?: RollingDailyVerificationRecordScalarWhereWithAggregatesInput | RollingDailyVerificationRecordScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"RollingDailyVerificationRecord"> | string
    seriesId?: StringWithAggregatesFilter<"RollingDailyVerificationRecord"> | string
    inputSource?: StringWithAggregatesFilter<"RollingDailyVerificationRecord"> | string
    inputRunId?: StringNullableWithAggregatesFilter<"RollingDailyVerificationRecord"> | string | null
    targetBasis?: EnumForecastTargetBasisWithAggregatesFilter<"RollingDailyVerificationRecord"> | $Enums.ForecastTargetBasis
    methodId?: StringWithAggregatesFilter<"RollingDailyVerificationRecord"> | string
    methodVersion?: StringWithAggregatesFilter<"RollingDailyVerificationRecord"> | string
    modelId?: StringWithAggregatesFilter<"RollingDailyVerificationRecord"> | string
    forecastOriginAt?: DateTimeWithAggregatesFilter<"RollingDailyVerificationRecord"> | Date | string
    horizonLabel?: StringWithAggregatesFilter<"RollingDailyVerificationRecord"> | string
    horizonMonths?: IntWithAggregatesFilter<"RollingDailyVerificationRecord"> | number
    horizonSteps?: IntWithAggregatesFilter<"RollingDailyVerificationRecord"> | number
    targetCalendarDate?: DateTimeWithAggregatesFilter<"RollingDailyVerificationRecord"> | Date | string
    verificationObservedAt?: DateTimeNullableWithAggregatesFilter<"RollingDailyVerificationRecord"> | Date | string | null
    maturityStatus?: EnumRollingDailyVerificationMaturityStatusWithAggregatesFilter<"RollingDailyVerificationRecord"> | $Enums.RollingDailyVerificationMaturityStatus
    originValue?: DecimalWithAggregatesFilter<"RollingDailyVerificationRecord"> | Decimal | DecimalJsLike | number | string
    forecastValue?: DecimalWithAggregatesFilter<"RollingDailyVerificationRecord"> | Decimal | DecimalJsLike | number | string
    actualValue?: DecimalNullableWithAggregatesFilter<"RollingDailyVerificationRecord"> | Decimal | DecimalJsLike | number | string | null
    errorValue?: DecimalNullableWithAggregatesFilter<"RollingDailyVerificationRecord"> | Decimal | DecimalJsLike | number | string | null
    absoluteErrorValue?: DecimalNullableWithAggregatesFilter<"RollingDailyVerificationRecord"> | Decimal | DecimalJsLike | number | string | null
    deltaValue?: DecimalNullableWithAggregatesFilter<"RollingDailyVerificationRecord"> | Decimal | DecimalJsLike | number | string | null
    deltaPct?: FloatNullableWithAggregatesFilter<"RollingDailyVerificationRecord"> | number | null
    residualValue?: DecimalNullableWithAggregatesFilter<"RollingDailyVerificationRecord"> | Decimal | DecimalJsLike | number | string | null
    maseScale?: FloatWithAggregatesFilter<"RollingDailyVerificationRecord"> | number
    trainingHistoryStartAt?: DateTimeNullableWithAggregatesFilter<"RollingDailyVerificationRecord"> | Date | string | null
    trainingHistoryEndAt?: DateTimeWithAggregatesFilter<"RollingDailyVerificationRecord"> | Date | string
    trainingObservationCount?: IntWithAggregatesFilter<"RollingDailyVerificationRecord"> | number
    sourceHistoryFingerprint?: StringWithAggregatesFilter<"RollingDailyVerificationRecord"> | string
    selectedVariant?: StringNullableWithAggregatesFilter<"RollingDailyVerificationRecord"> | string | null
    selectionMetric?: StringNullableWithAggregatesFilter<"RollingDailyVerificationRecord"> | string | null
    selectionScore?: FloatNullableWithAggregatesFilter<"RollingDailyVerificationRecord"> | number | null
    metadataJson?: JsonNullableWithAggregatesFilter<"RollingDailyVerificationRecord">
    createdAt?: DateTimeWithAggregatesFilter<"RollingDailyVerificationRecord"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"RollingDailyVerificationRecord"> | Date | string
  }

  export type RollingDailyCurrentForecastSnapshotWhereInput = {
    AND?: RollingDailyCurrentForecastSnapshotWhereInput | RollingDailyCurrentForecastSnapshotWhereInput[]
    OR?: RollingDailyCurrentForecastSnapshotWhereInput[]
    NOT?: RollingDailyCurrentForecastSnapshotWhereInput | RollingDailyCurrentForecastSnapshotWhereInput[]
    id?: StringFilter<"RollingDailyCurrentForecastSnapshot"> | string
    seriesId?: StringFilter<"RollingDailyCurrentForecastSnapshot"> | string
    inputSource?: StringFilter<"RollingDailyCurrentForecastSnapshot"> | string
    inputRunId?: StringNullableFilter<"RollingDailyCurrentForecastSnapshot"> | string | null
    targetBasis?: EnumForecastTargetBasisFilter<"RollingDailyCurrentForecastSnapshot"> | $Enums.ForecastTargetBasis
    methodId?: StringFilter<"RollingDailyCurrentForecastSnapshot"> | string
    methodVersion?: StringFilter<"RollingDailyCurrentForecastSnapshot"> | string
    modelId?: StringFilter<"RollingDailyCurrentForecastSnapshot"> | string
    contractVersion?: StringFilter<"RollingDailyCurrentForecastSnapshot"> | string
    status?: StringFilter<"RollingDailyCurrentForecastSnapshot"> | string
    reasonCode?: StringNullableFilter<"RollingDailyCurrentForecastSnapshot"> | string | null
    message?: StringNullableFilter<"RollingDailyCurrentForecastSnapshot"> | string | null
    forecastOriginAt?: DateTimeNullableFilter<"RollingDailyCurrentForecastSnapshot"> | Date | string | null
    sourceLatestObservationAt?: DateTimeNullableFilter<"RollingDailyCurrentForecastSnapshot"> | Date | string | null
    payloadJson?: JsonFilter<"RollingDailyCurrentForecastSnapshot">
    createdAt?: DateTimeFilter<"RollingDailyCurrentForecastSnapshot"> | Date | string
    updatedAt?: DateTimeFilter<"RollingDailyCurrentForecastSnapshot"> | Date | string
  }

  export type RollingDailyCurrentForecastSnapshotOrderByWithRelationInput = {
    id?: SortOrder
    seriesId?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrderInput | SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    methodVersion?: SortOrder
    modelId?: SortOrder
    contractVersion?: SortOrder
    status?: SortOrder
    reasonCode?: SortOrderInput | SortOrder
    message?: SortOrderInput | SortOrder
    forecastOriginAt?: SortOrderInput | SortOrder
    sourceLatestObservationAt?: SortOrderInput | SortOrder
    payloadJson?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type RollingDailyCurrentForecastSnapshotWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    seriesId_inputSource_targetBasis_methodId_methodVersion_modelId?: RollingDailyCurrentForecastSnapshotSeriesIdInputSourceTargetBasisMethodIdMethodVersionModelIdCompoundUniqueInput
    AND?: RollingDailyCurrentForecastSnapshotWhereInput | RollingDailyCurrentForecastSnapshotWhereInput[]
    OR?: RollingDailyCurrentForecastSnapshotWhereInput[]
    NOT?: RollingDailyCurrentForecastSnapshotWhereInput | RollingDailyCurrentForecastSnapshotWhereInput[]
    seriesId?: StringFilter<"RollingDailyCurrentForecastSnapshot"> | string
    inputSource?: StringFilter<"RollingDailyCurrentForecastSnapshot"> | string
    inputRunId?: StringNullableFilter<"RollingDailyCurrentForecastSnapshot"> | string | null
    targetBasis?: EnumForecastTargetBasisFilter<"RollingDailyCurrentForecastSnapshot"> | $Enums.ForecastTargetBasis
    methodId?: StringFilter<"RollingDailyCurrentForecastSnapshot"> | string
    methodVersion?: StringFilter<"RollingDailyCurrentForecastSnapshot"> | string
    modelId?: StringFilter<"RollingDailyCurrentForecastSnapshot"> | string
    contractVersion?: StringFilter<"RollingDailyCurrentForecastSnapshot"> | string
    status?: StringFilter<"RollingDailyCurrentForecastSnapshot"> | string
    reasonCode?: StringNullableFilter<"RollingDailyCurrentForecastSnapshot"> | string | null
    message?: StringNullableFilter<"RollingDailyCurrentForecastSnapshot"> | string | null
    forecastOriginAt?: DateTimeNullableFilter<"RollingDailyCurrentForecastSnapshot"> | Date | string | null
    sourceLatestObservationAt?: DateTimeNullableFilter<"RollingDailyCurrentForecastSnapshot"> | Date | string | null
    payloadJson?: JsonFilter<"RollingDailyCurrentForecastSnapshot">
    createdAt?: DateTimeFilter<"RollingDailyCurrentForecastSnapshot"> | Date | string
    updatedAt?: DateTimeFilter<"RollingDailyCurrentForecastSnapshot"> | Date | string
  }, "id" | "seriesId_inputSource_targetBasis_methodId_methodVersion_modelId">

  export type RollingDailyCurrentForecastSnapshotOrderByWithAggregationInput = {
    id?: SortOrder
    seriesId?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrderInput | SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    methodVersion?: SortOrder
    modelId?: SortOrder
    contractVersion?: SortOrder
    status?: SortOrder
    reasonCode?: SortOrderInput | SortOrder
    message?: SortOrderInput | SortOrder
    forecastOriginAt?: SortOrderInput | SortOrder
    sourceLatestObservationAt?: SortOrderInput | SortOrder
    payloadJson?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: RollingDailyCurrentForecastSnapshotCountOrderByAggregateInput
    _max?: RollingDailyCurrentForecastSnapshotMaxOrderByAggregateInput
    _min?: RollingDailyCurrentForecastSnapshotMinOrderByAggregateInput
  }

  export type RollingDailyCurrentForecastSnapshotScalarWhereWithAggregatesInput = {
    AND?: RollingDailyCurrentForecastSnapshotScalarWhereWithAggregatesInput | RollingDailyCurrentForecastSnapshotScalarWhereWithAggregatesInput[]
    OR?: RollingDailyCurrentForecastSnapshotScalarWhereWithAggregatesInput[]
    NOT?: RollingDailyCurrentForecastSnapshotScalarWhereWithAggregatesInput | RollingDailyCurrentForecastSnapshotScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"RollingDailyCurrentForecastSnapshot"> | string
    seriesId?: StringWithAggregatesFilter<"RollingDailyCurrentForecastSnapshot"> | string
    inputSource?: StringWithAggregatesFilter<"RollingDailyCurrentForecastSnapshot"> | string
    inputRunId?: StringNullableWithAggregatesFilter<"RollingDailyCurrentForecastSnapshot"> | string | null
    targetBasis?: EnumForecastTargetBasisWithAggregatesFilter<"RollingDailyCurrentForecastSnapshot"> | $Enums.ForecastTargetBasis
    methodId?: StringWithAggregatesFilter<"RollingDailyCurrentForecastSnapshot"> | string
    methodVersion?: StringWithAggregatesFilter<"RollingDailyCurrentForecastSnapshot"> | string
    modelId?: StringWithAggregatesFilter<"RollingDailyCurrentForecastSnapshot"> | string
    contractVersion?: StringWithAggregatesFilter<"RollingDailyCurrentForecastSnapshot"> | string
    status?: StringWithAggregatesFilter<"RollingDailyCurrentForecastSnapshot"> | string
    reasonCode?: StringNullableWithAggregatesFilter<"RollingDailyCurrentForecastSnapshot"> | string | null
    message?: StringNullableWithAggregatesFilter<"RollingDailyCurrentForecastSnapshot"> | string | null
    forecastOriginAt?: DateTimeNullableWithAggregatesFilter<"RollingDailyCurrentForecastSnapshot"> | Date | string | null
    sourceLatestObservationAt?: DateTimeNullableWithAggregatesFilter<"RollingDailyCurrentForecastSnapshot"> | Date | string | null
    payloadJson?: JsonWithAggregatesFilter<"RollingDailyCurrentForecastSnapshot">
    createdAt?: DateTimeWithAggregatesFilter<"RollingDailyCurrentForecastSnapshot"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"RollingDailyCurrentForecastSnapshot"> | Date | string
  }

  export type RollingDailyCalibrationGroupWhereInput = {
    AND?: RollingDailyCalibrationGroupWhereInput | RollingDailyCalibrationGroupWhereInput[]
    OR?: RollingDailyCalibrationGroupWhereInput[]
    NOT?: RollingDailyCalibrationGroupWhereInput | RollingDailyCalibrationGroupWhereInput[]
    id?: StringFilter<"RollingDailyCalibrationGroup"> | string
    seriesId?: StringFilter<"RollingDailyCalibrationGroup"> | string
    inputSource?: StringFilter<"RollingDailyCalibrationGroup"> | string
    inputRunId?: StringNullableFilter<"RollingDailyCalibrationGroup"> | string | null
    targetBasis?: EnumForecastTargetBasisFilter<"RollingDailyCalibrationGroup"> | $Enums.ForecastTargetBasis
    methodId?: StringFilter<"RollingDailyCalibrationGroup"> | string
    methodVersion?: StringFilter<"RollingDailyCalibrationGroup"> | string
    modelId?: StringFilter<"RollingDailyCalibrationGroup"> | string
    horizonLabel?: StringFilter<"RollingDailyCalibrationGroup"> | string
    horizonMonths?: IntFilter<"RollingDailyCalibrationGroup"> | number
    calibrationOriginAt?: DateTimeFilter<"RollingDailyCalibrationGroup"> | Date | string
    sampleCount?: IntFilter<"RollingDailyCalibrationGroup"> | number
    residualP10?: DecimalNullableFilter<"RollingDailyCalibrationGroup"> | Decimal | DecimalJsLike | number | string | null
    residualP90?: DecimalNullableFilter<"RollingDailyCalibrationGroup"> | Decimal | DecimalJsLike | number | string | null
    quantileMethod?: StringFilter<"RollingDailyCalibrationGroup"> | string
    status?: EnumRollingDailyCalibrationStatusFilter<"RollingDailyCalibrationGroup"> | $Enums.RollingDailyCalibrationStatus
    lastResidualObservedAt?: DateTimeNullableFilter<"RollingDailyCalibrationGroup"> | Date | string | null
    refreshedAt?: DateTimeFilter<"RollingDailyCalibrationGroup"> | Date | string
    createdAt?: DateTimeFilter<"RollingDailyCalibrationGroup"> | Date | string
    updatedAt?: DateTimeFilter<"RollingDailyCalibrationGroup"> | Date | string
  }

  export type RollingDailyCalibrationGroupOrderByWithRelationInput = {
    id?: SortOrder
    seriesId?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrderInput | SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    methodVersion?: SortOrder
    modelId?: SortOrder
    horizonLabel?: SortOrder
    horizonMonths?: SortOrder
    calibrationOriginAt?: SortOrder
    sampleCount?: SortOrder
    residualP10?: SortOrderInput | SortOrder
    residualP90?: SortOrderInput | SortOrder
    quantileMethod?: SortOrder
    status?: SortOrder
    lastResidualObservedAt?: SortOrderInput | SortOrder
    refreshedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type RollingDailyCalibrationGroupWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    seriesId_inputSource_targetBasis_methodId_methodVersion_modelId_horizonLabel?: RollingDailyCalibrationGroupSeriesIdInputSourceTargetBasisMethodIdMethodVersionModelIdHorizonLabelCompoundUniqueInput
    AND?: RollingDailyCalibrationGroupWhereInput | RollingDailyCalibrationGroupWhereInput[]
    OR?: RollingDailyCalibrationGroupWhereInput[]
    NOT?: RollingDailyCalibrationGroupWhereInput | RollingDailyCalibrationGroupWhereInput[]
    seriesId?: StringFilter<"RollingDailyCalibrationGroup"> | string
    inputSource?: StringFilter<"RollingDailyCalibrationGroup"> | string
    inputRunId?: StringNullableFilter<"RollingDailyCalibrationGroup"> | string | null
    targetBasis?: EnumForecastTargetBasisFilter<"RollingDailyCalibrationGroup"> | $Enums.ForecastTargetBasis
    methodId?: StringFilter<"RollingDailyCalibrationGroup"> | string
    methodVersion?: StringFilter<"RollingDailyCalibrationGroup"> | string
    modelId?: StringFilter<"RollingDailyCalibrationGroup"> | string
    horizonLabel?: StringFilter<"RollingDailyCalibrationGroup"> | string
    horizonMonths?: IntFilter<"RollingDailyCalibrationGroup"> | number
    calibrationOriginAt?: DateTimeFilter<"RollingDailyCalibrationGroup"> | Date | string
    sampleCount?: IntFilter<"RollingDailyCalibrationGroup"> | number
    residualP10?: DecimalNullableFilter<"RollingDailyCalibrationGroup"> | Decimal | DecimalJsLike | number | string | null
    residualP90?: DecimalNullableFilter<"RollingDailyCalibrationGroup"> | Decimal | DecimalJsLike | number | string | null
    quantileMethod?: StringFilter<"RollingDailyCalibrationGroup"> | string
    status?: EnumRollingDailyCalibrationStatusFilter<"RollingDailyCalibrationGroup"> | $Enums.RollingDailyCalibrationStatus
    lastResidualObservedAt?: DateTimeNullableFilter<"RollingDailyCalibrationGroup"> | Date | string | null
    refreshedAt?: DateTimeFilter<"RollingDailyCalibrationGroup"> | Date | string
    createdAt?: DateTimeFilter<"RollingDailyCalibrationGroup"> | Date | string
    updatedAt?: DateTimeFilter<"RollingDailyCalibrationGroup"> | Date | string
  }, "id" | "seriesId_inputSource_targetBasis_methodId_methodVersion_modelId_horizonLabel">

  export type RollingDailyCalibrationGroupOrderByWithAggregationInput = {
    id?: SortOrder
    seriesId?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrderInput | SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    methodVersion?: SortOrder
    modelId?: SortOrder
    horizonLabel?: SortOrder
    horizonMonths?: SortOrder
    calibrationOriginAt?: SortOrder
    sampleCount?: SortOrder
    residualP10?: SortOrderInput | SortOrder
    residualP90?: SortOrderInput | SortOrder
    quantileMethod?: SortOrder
    status?: SortOrder
    lastResidualObservedAt?: SortOrderInput | SortOrder
    refreshedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: RollingDailyCalibrationGroupCountOrderByAggregateInput
    _avg?: RollingDailyCalibrationGroupAvgOrderByAggregateInput
    _max?: RollingDailyCalibrationGroupMaxOrderByAggregateInput
    _min?: RollingDailyCalibrationGroupMinOrderByAggregateInput
    _sum?: RollingDailyCalibrationGroupSumOrderByAggregateInput
  }

  export type RollingDailyCalibrationGroupScalarWhereWithAggregatesInput = {
    AND?: RollingDailyCalibrationGroupScalarWhereWithAggregatesInput | RollingDailyCalibrationGroupScalarWhereWithAggregatesInput[]
    OR?: RollingDailyCalibrationGroupScalarWhereWithAggregatesInput[]
    NOT?: RollingDailyCalibrationGroupScalarWhereWithAggregatesInput | RollingDailyCalibrationGroupScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"RollingDailyCalibrationGroup"> | string
    seriesId?: StringWithAggregatesFilter<"RollingDailyCalibrationGroup"> | string
    inputSource?: StringWithAggregatesFilter<"RollingDailyCalibrationGroup"> | string
    inputRunId?: StringNullableWithAggregatesFilter<"RollingDailyCalibrationGroup"> | string | null
    targetBasis?: EnumForecastTargetBasisWithAggregatesFilter<"RollingDailyCalibrationGroup"> | $Enums.ForecastTargetBasis
    methodId?: StringWithAggregatesFilter<"RollingDailyCalibrationGroup"> | string
    methodVersion?: StringWithAggregatesFilter<"RollingDailyCalibrationGroup"> | string
    modelId?: StringWithAggregatesFilter<"RollingDailyCalibrationGroup"> | string
    horizonLabel?: StringWithAggregatesFilter<"RollingDailyCalibrationGroup"> | string
    horizonMonths?: IntWithAggregatesFilter<"RollingDailyCalibrationGroup"> | number
    calibrationOriginAt?: DateTimeWithAggregatesFilter<"RollingDailyCalibrationGroup"> | Date | string
    sampleCount?: IntWithAggregatesFilter<"RollingDailyCalibrationGroup"> | number
    residualP10?: DecimalNullableWithAggregatesFilter<"RollingDailyCalibrationGroup"> | Decimal | DecimalJsLike | number | string | null
    residualP90?: DecimalNullableWithAggregatesFilter<"RollingDailyCalibrationGroup"> | Decimal | DecimalJsLike | number | string | null
    quantileMethod?: StringWithAggregatesFilter<"RollingDailyCalibrationGroup"> | string
    status?: EnumRollingDailyCalibrationStatusWithAggregatesFilter<"RollingDailyCalibrationGroup"> | $Enums.RollingDailyCalibrationStatus
    lastResidualObservedAt?: DateTimeNullableWithAggregatesFilter<"RollingDailyCalibrationGroup"> | Date | string | null
    refreshedAt?: DateTimeWithAggregatesFilter<"RollingDailyCalibrationGroup"> | Date | string
    createdAt?: DateTimeWithAggregatesFilter<"RollingDailyCalibrationGroup"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"RollingDailyCalibrationGroup"> | Date | string
  }

  export type RollingDailyMaintenanceStateWhereInput = {
    AND?: RollingDailyMaintenanceStateWhereInput | RollingDailyMaintenanceStateWhereInput[]
    OR?: RollingDailyMaintenanceStateWhereInput[]
    NOT?: RollingDailyMaintenanceStateWhereInput | RollingDailyMaintenanceStateWhereInput[]
    id?: StringFilter<"RollingDailyMaintenanceState"> | string
    seriesId?: StringFilter<"RollingDailyMaintenanceState"> | string
    inputSource?: StringFilter<"RollingDailyMaintenanceState"> | string
    inputRunId?: StringNullableFilter<"RollingDailyMaintenanceState"> | string | null
    targetBasis?: EnumForecastTargetBasisFilter<"RollingDailyMaintenanceState"> | $Enums.ForecastTargetBasis
    methodId?: StringFilter<"RollingDailyMaintenanceState"> | string
    methodVersion?: StringFilter<"RollingDailyMaintenanceState"> | string
    modelId?: StringFilter<"RollingDailyMaintenanceState"> | string
    historicalOriginStartAt?: DateTimeFilter<"RollingDailyMaintenanceState"> | Date | string
    minimumTrainingObservations?: IntFilter<"RollingDailyMaintenanceState"> | number
    minimumCalibrationSamples?: IntFilter<"RollingDailyMaintenanceState"> | number
    latestSourceObservationAt?: DateTimeNullableFilter<"RollingDailyMaintenanceState"> | Date | string | null
    latestSourceHistoryStartAt?: DateTimeNullableFilter<"RollingDailyMaintenanceState"> | Date | string | null
    latestSourceObservationCount?: IntNullableFilter<"RollingDailyMaintenanceState"> | number | null
    latestSourceHistoryFingerprint?: StringNullableFilter<"RollingDailyMaintenanceState"> | string | null
    lastProcessedOriginAt?: DateTimeNullableFilter<"RollingDailyMaintenanceState"> | Date | string | null
    lastMaturedObservedAt?: DateTimeNullableFilter<"RollingDailyMaintenanceState"> | Date | string | null
    lastMaintenanceAt?: DateTimeNullableFilter<"RollingDailyMaintenanceState"> | Date | string | null
    lastMaintenanceStatus?: StringNullableFilter<"RollingDailyMaintenanceState"> | string | null
    lastFailureReason?: StringNullableFilter<"RollingDailyMaintenanceState"> | string | null
    createdAt?: DateTimeFilter<"RollingDailyMaintenanceState"> | Date | string
    updatedAt?: DateTimeFilter<"RollingDailyMaintenanceState"> | Date | string
  }

  export type RollingDailyMaintenanceStateOrderByWithRelationInput = {
    id?: SortOrder
    seriesId?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrderInput | SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    methodVersion?: SortOrder
    modelId?: SortOrder
    historicalOriginStartAt?: SortOrder
    minimumTrainingObservations?: SortOrder
    minimumCalibrationSamples?: SortOrder
    latestSourceObservationAt?: SortOrderInput | SortOrder
    latestSourceHistoryStartAt?: SortOrderInput | SortOrder
    latestSourceObservationCount?: SortOrderInput | SortOrder
    latestSourceHistoryFingerprint?: SortOrderInput | SortOrder
    lastProcessedOriginAt?: SortOrderInput | SortOrder
    lastMaturedObservedAt?: SortOrderInput | SortOrder
    lastMaintenanceAt?: SortOrderInput | SortOrder
    lastMaintenanceStatus?: SortOrderInput | SortOrder
    lastFailureReason?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type RollingDailyMaintenanceStateWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    seriesId_inputSource_targetBasis_methodId_methodVersion_modelId?: RollingDailyMaintenanceStateSeriesIdInputSourceTargetBasisMethodIdMethodVersionModelIdCompoundUniqueInput
    AND?: RollingDailyMaintenanceStateWhereInput | RollingDailyMaintenanceStateWhereInput[]
    OR?: RollingDailyMaintenanceStateWhereInput[]
    NOT?: RollingDailyMaintenanceStateWhereInput | RollingDailyMaintenanceStateWhereInput[]
    seriesId?: StringFilter<"RollingDailyMaintenanceState"> | string
    inputSource?: StringFilter<"RollingDailyMaintenanceState"> | string
    inputRunId?: StringNullableFilter<"RollingDailyMaintenanceState"> | string | null
    targetBasis?: EnumForecastTargetBasisFilter<"RollingDailyMaintenanceState"> | $Enums.ForecastTargetBasis
    methodId?: StringFilter<"RollingDailyMaintenanceState"> | string
    methodVersion?: StringFilter<"RollingDailyMaintenanceState"> | string
    modelId?: StringFilter<"RollingDailyMaintenanceState"> | string
    historicalOriginStartAt?: DateTimeFilter<"RollingDailyMaintenanceState"> | Date | string
    minimumTrainingObservations?: IntFilter<"RollingDailyMaintenanceState"> | number
    minimumCalibrationSamples?: IntFilter<"RollingDailyMaintenanceState"> | number
    latestSourceObservationAt?: DateTimeNullableFilter<"RollingDailyMaintenanceState"> | Date | string | null
    latestSourceHistoryStartAt?: DateTimeNullableFilter<"RollingDailyMaintenanceState"> | Date | string | null
    latestSourceObservationCount?: IntNullableFilter<"RollingDailyMaintenanceState"> | number | null
    latestSourceHistoryFingerprint?: StringNullableFilter<"RollingDailyMaintenanceState"> | string | null
    lastProcessedOriginAt?: DateTimeNullableFilter<"RollingDailyMaintenanceState"> | Date | string | null
    lastMaturedObservedAt?: DateTimeNullableFilter<"RollingDailyMaintenanceState"> | Date | string | null
    lastMaintenanceAt?: DateTimeNullableFilter<"RollingDailyMaintenanceState"> | Date | string | null
    lastMaintenanceStatus?: StringNullableFilter<"RollingDailyMaintenanceState"> | string | null
    lastFailureReason?: StringNullableFilter<"RollingDailyMaintenanceState"> | string | null
    createdAt?: DateTimeFilter<"RollingDailyMaintenanceState"> | Date | string
    updatedAt?: DateTimeFilter<"RollingDailyMaintenanceState"> | Date | string
  }, "id" | "seriesId_inputSource_targetBasis_methodId_methodVersion_modelId">

  export type RollingDailyMaintenanceStateOrderByWithAggregationInput = {
    id?: SortOrder
    seriesId?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrderInput | SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    methodVersion?: SortOrder
    modelId?: SortOrder
    historicalOriginStartAt?: SortOrder
    minimumTrainingObservations?: SortOrder
    minimumCalibrationSamples?: SortOrder
    latestSourceObservationAt?: SortOrderInput | SortOrder
    latestSourceHistoryStartAt?: SortOrderInput | SortOrder
    latestSourceObservationCount?: SortOrderInput | SortOrder
    latestSourceHistoryFingerprint?: SortOrderInput | SortOrder
    lastProcessedOriginAt?: SortOrderInput | SortOrder
    lastMaturedObservedAt?: SortOrderInput | SortOrder
    lastMaintenanceAt?: SortOrderInput | SortOrder
    lastMaintenanceStatus?: SortOrderInput | SortOrder
    lastFailureReason?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: RollingDailyMaintenanceStateCountOrderByAggregateInput
    _avg?: RollingDailyMaintenanceStateAvgOrderByAggregateInput
    _max?: RollingDailyMaintenanceStateMaxOrderByAggregateInput
    _min?: RollingDailyMaintenanceStateMinOrderByAggregateInput
    _sum?: RollingDailyMaintenanceStateSumOrderByAggregateInput
  }

  export type RollingDailyMaintenanceStateScalarWhereWithAggregatesInput = {
    AND?: RollingDailyMaintenanceStateScalarWhereWithAggregatesInput | RollingDailyMaintenanceStateScalarWhereWithAggregatesInput[]
    OR?: RollingDailyMaintenanceStateScalarWhereWithAggregatesInput[]
    NOT?: RollingDailyMaintenanceStateScalarWhereWithAggregatesInput | RollingDailyMaintenanceStateScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"RollingDailyMaintenanceState"> | string
    seriesId?: StringWithAggregatesFilter<"RollingDailyMaintenanceState"> | string
    inputSource?: StringWithAggregatesFilter<"RollingDailyMaintenanceState"> | string
    inputRunId?: StringNullableWithAggregatesFilter<"RollingDailyMaintenanceState"> | string | null
    targetBasis?: EnumForecastTargetBasisWithAggregatesFilter<"RollingDailyMaintenanceState"> | $Enums.ForecastTargetBasis
    methodId?: StringWithAggregatesFilter<"RollingDailyMaintenanceState"> | string
    methodVersion?: StringWithAggregatesFilter<"RollingDailyMaintenanceState"> | string
    modelId?: StringWithAggregatesFilter<"RollingDailyMaintenanceState"> | string
    historicalOriginStartAt?: DateTimeWithAggregatesFilter<"RollingDailyMaintenanceState"> | Date | string
    minimumTrainingObservations?: IntWithAggregatesFilter<"RollingDailyMaintenanceState"> | number
    minimumCalibrationSamples?: IntWithAggregatesFilter<"RollingDailyMaintenanceState"> | number
    latestSourceObservationAt?: DateTimeNullableWithAggregatesFilter<"RollingDailyMaintenanceState"> | Date | string | null
    latestSourceHistoryStartAt?: DateTimeNullableWithAggregatesFilter<"RollingDailyMaintenanceState"> | Date | string | null
    latestSourceObservationCount?: IntNullableWithAggregatesFilter<"RollingDailyMaintenanceState"> | number | null
    latestSourceHistoryFingerprint?: StringNullableWithAggregatesFilter<"RollingDailyMaintenanceState"> | string | null
    lastProcessedOriginAt?: DateTimeNullableWithAggregatesFilter<"RollingDailyMaintenanceState"> | Date | string | null
    lastMaturedObservedAt?: DateTimeNullableWithAggregatesFilter<"RollingDailyMaintenanceState"> | Date | string | null
    lastMaintenanceAt?: DateTimeNullableWithAggregatesFilter<"RollingDailyMaintenanceState"> | Date | string | null
    lastMaintenanceStatus?: StringNullableWithAggregatesFilter<"RollingDailyMaintenanceState"> | string | null
    lastFailureReason?: StringNullableWithAggregatesFilter<"RollingDailyMaintenanceState"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"RollingDailyMaintenanceState"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"RollingDailyMaintenanceState"> | Date | string
  }

  export type ForecastCurrentRunCreateInput = {
    id?: string
    seriesId: string
    displayName: string
    description?: string | null
    frequency?: string | null
    currency?: string | null
    unit?: string | null
    sourceLabel?: string | null
    inputSource: string
    inputRunId?: string | null
    historyFingerprint: string
    targetBasis?: $Enums.ForecastTargetBasis
    methodId: string
    historyStartAt?: Date | string | null
    historyEndAt?: Date | string | null
    observationCount: number
    forecastOriginAt?: Date | string | null
    modelId: string
    methodVersion: string
    status: string
    failureReason?: string | null
    runtimeSeconds?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    points?: ForecastCurrentPointCreateNestedManyWithoutRunInput
  }

  export type ForecastCurrentRunUncheckedCreateInput = {
    id?: string
    seriesId: string
    displayName: string
    description?: string | null
    frequency?: string | null
    currency?: string | null
    unit?: string | null
    sourceLabel?: string | null
    inputSource: string
    inputRunId?: string | null
    historyFingerprint: string
    targetBasis?: $Enums.ForecastTargetBasis
    methodId: string
    historyStartAt?: Date | string | null
    historyEndAt?: Date | string | null
    observationCount: number
    forecastOriginAt?: Date | string | null
    modelId: string
    methodVersion: string
    status: string
    failureReason?: string | null
    runtimeSeconds?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    points?: ForecastCurrentPointUncheckedCreateNestedManyWithoutRunInput
  }

  export type ForecastCurrentRunUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    frequency?: NullableStringFieldUpdateOperationsInput | string | null
    currency?: NullableStringFieldUpdateOperationsInput | string | null
    unit?: NullableStringFieldUpdateOperationsInput | string | null
    sourceLabel?: NullableStringFieldUpdateOperationsInput | string | null
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    historyFingerprint?: StringFieldUpdateOperationsInput | string
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    historyStartAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    historyEndAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    observationCount?: IntFieldUpdateOperationsInput | number
    forecastOriginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    modelId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    failureReason?: NullableStringFieldUpdateOperationsInput | string | null
    runtimeSeconds?: NullableFloatFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    points?: ForecastCurrentPointUpdateManyWithoutRunNestedInput
  }

  export type ForecastCurrentRunUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    frequency?: NullableStringFieldUpdateOperationsInput | string | null
    currency?: NullableStringFieldUpdateOperationsInput | string | null
    unit?: NullableStringFieldUpdateOperationsInput | string | null
    sourceLabel?: NullableStringFieldUpdateOperationsInput | string | null
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    historyFingerprint?: StringFieldUpdateOperationsInput | string
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    historyStartAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    historyEndAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    observationCount?: IntFieldUpdateOperationsInput | number
    forecastOriginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    modelId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    failureReason?: NullableStringFieldUpdateOperationsInput | string | null
    runtimeSeconds?: NullableFloatFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    points?: ForecastCurrentPointUncheckedUpdateManyWithoutRunNestedInput
  }

  export type ForecastCurrentRunCreateManyInput = {
    id?: string
    seriesId: string
    displayName: string
    description?: string | null
    frequency?: string | null
    currency?: string | null
    unit?: string | null
    sourceLabel?: string | null
    inputSource: string
    inputRunId?: string | null
    historyFingerprint: string
    targetBasis?: $Enums.ForecastTargetBasis
    methodId: string
    historyStartAt?: Date | string | null
    historyEndAt?: Date | string | null
    observationCount: number
    forecastOriginAt?: Date | string | null
    modelId: string
    methodVersion: string
    status: string
    failureReason?: string | null
    runtimeSeconds?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ForecastCurrentRunUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    frequency?: NullableStringFieldUpdateOperationsInput | string | null
    currency?: NullableStringFieldUpdateOperationsInput | string | null
    unit?: NullableStringFieldUpdateOperationsInput | string | null
    sourceLabel?: NullableStringFieldUpdateOperationsInput | string | null
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    historyFingerprint?: StringFieldUpdateOperationsInput | string
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    historyStartAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    historyEndAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    observationCount?: IntFieldUpdateOperationsInput | number
    forecastOriginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    modelId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    failureReason?: NullableStringFieldUpdateOperationsInput | string | null
    runtimeSeconds?: NullableFloatFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ForecastCurrentRunUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    frequency?: NullableStringFieldUpdateOperationsInput | string | null
    currency?: NullableStringFieldUpdateOperationsInput | string | null
    unit?: NullableStringFieldUpdateOperationsInput | string | null
    sourceLabel?: NullableStringFieldUpdateOperationsInput | string | null
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    historyFingerprint?: StringFieldUpdateOperationsInput | string
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    historyStartAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    historyEndAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    observationCount?: IntFieldUpdateOperationsInput | number
    forecastOriginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    modelId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    failureReason?: NullableStringFieldUpdateOperationsInput | string | null
    runtimeSeconds?: NullableFloatFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ForecastCurrentPointCreateInput = {
    id?: string
    horizonLabel: string
    horizonSteps: number
    forecastDate: Date | string
    forecastValue?: Decimal | DecimalJsLike | number | string | null
    fitStatus?: string | null
    failureReason?: string | null
    selectedVariant?: string | null
    selectionMetric?: string | null
    selectionScore?: number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    run: ForecastCurrentRunCreateNestedOneWithoutPointsInput
  }

  export type ForecastCurrentPointUncheckedCreateInput = {
    id?: string
    runId: string
    horizonLabel: string
    horizonSteps: number
    forecastDate: Date | string
    forecastValue?: Decimal | DecimalJsLike | number | string | null
    fitStatus?: string | null
    failureReason?: string | null
    selectedVariant?: string | null
    selectionMetric?: string | null
    selectionScore?: number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ForecastCurrentPointUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonSteps?: IntFieldUpdateOperationsInput | number
    forecastDate?: DateTimeFieldUpdateOperationsInput | Date | string
    forecastValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    fitStatus?: NullableStringFieldUpdateOperationsInput | string | null
    failureReason?: NullableStringFieldUpdateOperationsInput | string | null
    selectedVariant?: NullableStringFieldUpdateOperationsInput | string | null
    selectionMetric?: NullableStringFieldUpdateOperationsInput | string | null
    selectionScore?: NullableFloatFieldUpdateOperationsInput | number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    run?: ForecastCurrentRunUpdateOneRequiredWithoutPointsNestedInput
  }

  export type ForecastCurrentPointUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    runId?: StringFieldUpdateOperationsInput | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonSteps?: IntFieldUpdateOperationsInput | number
    forecastDate?: DateTimeFieldUpdateOperationsInput | Date | string
    forecastValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    fitStatus?: NullableStringFieldUpdateOperationsInput | string | null
    failureReason?: NullableStringFieldUpdateOperationsInput | string | null
    selectedVariant?: NullableStringFieldUpdateOperationsInput | string | null
    selectionMetric?: NullableStringFieldUpdateOperationsInput | string | null
    selectionScore?: NullableFloatFieldUpdateOperationsInput | number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ForecastCurrentPointCreateManyInput = {
    id?: string
    runId: string
    horizonLabel: string
    horizonSteps: number
    forecastDate: Date | string
    forecastValue?: Decimal | DecimalJsLike | number | string | null
    fitStatus?: string | null
    failureReason?: string | null
    selectedVariant?: string | null
    selectionMetric?: string | null
    selectionScore?: number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ForecastCurrentPointUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonSteps?: IntFieldUpdateOperationsInput | number
    forecastDate?: DateTimeFieldUpdateOperationsInput | Date | string
    forecastValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    fitStatus?: NullableStringFieldUpdateOperationsInput | string | null
    failureReason?: NullableStringFieldUpdateOperationsInput | string | null
    selectedVariant?: NullableStringFieldUpdateOperationsInput | string | null
    selectionMetric?: NullableStringFieldUpdateOperationsInput | string | null
    selectionScore?: NullableFloatFieldUpdateOperationsInput | number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ForecastCurrentPointUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    runId?: StringFieldUpdateOperationsInput | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonSteps?: IntFieldUpdateOperationsInput | number
    forecastDate?: DateTimeFieldUpdateOperationsInput | Date | string
    forecastValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    fitStatus?: NullableStringFieldUpdateOperationsInput | string | null
    failureReason?: NullableStringFieldUpdateOperationsInput | string | null
    selectedVariant?: NullableStringFieldUpdateOperationsInput | string | null
    selectionMetric?: NullableStringFieldUpdateOperationsInput | string | null
    selectionScore?: NullableFloatFieldUpdateOperationsInput | number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ForecastVerificationRunCreateInput = {
    id?: string
    seriesId: string
    displayName: string
    description?: string | null
    frequency?: string | null
    currency?: string | null
    unit?: string | null
    sourceLabel?: string | null
    inputSource: string
    inputRunId?: string | null
    historyFingerprint: string
    targetBasis?: $Enums.ForecastTargetBasis
    methodId: string
    historyStartAt?: Date | string | null
    historyEndAt?: Date | string | null
    observationCount: number
    forecastOriginAt?: Date | string | null
    modelId: string
    methodVersion: string
    status: string
    failureReason?: string | null
    runtimeSeconds?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    metrics?: ForecastVerificationMetricCreateNestedManyWithoutRunInput
    points?: ForecastVerificationPointCreateNestedManyWithoutRunInput
  }

  export type ForecastVerificationRunUncheckedCreateInput = {
    id?: string
    seriesId: string
    displayName: string
    description?: string | null
    frequency?: string | null
    currency?: string | null
    unit?: string | null
    sourceLabel?: string | null
    inputSource: string
    inputRunId?: string | null
    historyFingerprint: string
    targetBasis?: $Enums.ForecastTargetBasis
    methodId: string
    historyStartAt?: Date | string | null
    historyEndAt?: Date | string | null
    observationCount: number
    forecastOriginAt?: Date | string | null
    modelId: string
    methodVersion: string
    status: string
    failureReason?: string | null
    runtimeSeconds?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    metrics?: ForecastVerificationMetricUncheckedCreateNestedManyWithoutRunInput
    points?: ForecastVerificationPointUncheckedCreateNestedManyWithoutRunInput
  }

  export type ForecastVerificationRunUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    frequency?: NullableStringFieldUpdateOperationsInput | string | null
    currency?: NullableStringFieldUpdateOperationsInput | string | null
    unit?: NullableStringFieldUpdateOperationsInput | string | null
    sourceLabel?: NullableStringFieldUpdateOperationsInput | string | null
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    historyFingerprint?: StringFieldUpdateOperationsInput | string
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    historyStartAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    historyEndAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    observationCount?: IntFieldUpdateOperationsInput | number
    forecastOriginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    modelId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    failureReason?: NullableStringFieldUpdateOperationsInput | string | null
    runtimeSeconds?: NullableFloatFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metrics?: ForecastVerificationMetricUpdateManyWithoutRunNestedInput
    points?: ForecastVerificationPointUpdateManyWithoutRunNestedInput
  }

  export type ForecastVerificationRunUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    frequency?: NullableStringFieldUpdateOperationsInput | string | null
    currency?: NullableStringFieldUpdateOperationsInput | string | null
    unit?: NullableStringFieldUpdateOperationsInput | string | null
    sourceLabel?: NullableStringFieldUpdateOperationsInput | string | null
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    historyFingerprint?: StringFieldUpdateOperationsInput | string
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    historyStartAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    historyEndAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    observationCount?: IntFieldUpdateOperationsInput | number
    forecastOriginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    modelId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    failureReason?: NullableStringFieldUpdateOperationsInput | string | null
    runtimeSeconds?: NullableFloatFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metrics?: ForecastVerificationMetricUncheckedUpdateManyWithoutRunNestedInput
    points?: ForecastVerificationPointUncheckedUpdateManyWithoutRunNestedInput
  }

  export type ForecastVerificationRunCreateManyInput = {
    id?: string
    seriesId: string
    displayName: string
    description?: string | null
    frequency?: string | null
    currency?: string | null
    unit?: string | null
    sourceLabel?: string | null
    inputSource: string
    inputRunId?: string | null
    historyFingerprint: string
    targetBasis?: $Enums.ForecastTargetBasis
    methodId: string
    historyStartAt?: Date | string | null
    historyEndAt?: Date | string | null
    observationCount: number
    forecastOriginAt?: Date | string | null
    modelId: string
    methodVersion: string
    status: string
    failureReason?: string | null
    runtimeSeconds?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ForecastVerificationRunUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    frequency?: NullableStringFieldUpdateOperationsInput | string | null
    currency?: NullableStringFieldUpdateOperationsInput | string | null
    unit?: NullableStringFieldUpdateOperationsInput | string | null
    sourceLabel?: NullableStringFieldUpdateOperationsInput | string | null
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    historyFingerprint?: StringFieldUpdateOperationsInput | string
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    historyStartAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    historyEndAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    observationCount?: IntFieldUpdateOperationsInput | number
    forecastOriginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    modelId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    failureReason?: NullableStringFieldUpdateOperationsInput | string | null
    runtimeSeconds?: NullableFloatFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ForecastVerificationRunUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    frequency?: NullableStringFieldUpdateOperationsInput | string | null
    currency?: NullableStringFieldUpdateOperationsInput | string | null
    unit?: NullableStringFieldUpdateOperationsInput | string | null
    sourceLabel?: NullableStringFieldUpdateOperationsInput | string | null
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    historyFingerprint?: StringFieldUpdateOperationsInput | string
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    historyStartAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    historyEndAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    observationCount?: IntFieldUpdateOperationsInput | number
    forecastOriginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    modelId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    failureReason?: NullableStringFieldUpdateOperationsInput | string | null
    runtimeSeconds?: NullableFloatFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ForecastVerificationMetricCreateInput = {
    id?: string
    horizonLabel: string
    horizonSteps: number
    origins: number
    expectedOrigins: number
    failedOrigins: number
    coverage: number
    mae?: number | null
    rmse?: number | null
    mase?: number | null
    smape?: number | null
    directionalAccuracy?: number | null
    bias?: number | null
    failureSummaryJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    run: ForecastVerificationRunCreateNestedOneWithoutMetricsInput
  }

  export type ForecastVerificationMetricUncheckedCreateInput = {
    id?: string
    runId: string
    horizonLabel: string
    horizonSteps: number
    origins: number
    expectedOrigins: number
    failedOrigins: number
    coverage: number
    mae?: number | null
    rmse?: number | null
    mase?: number | null
    smape?: number | null
    directionalAccuracy?: number | null
    bias?: number | null
    failureSummaryJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ForecastVerificationMetricUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonSteps?: IntFieldUpdateOperationsInput | number
    origins?: IntFieldUpdateOperationsInput | number
    expectedOrigins?: IntFieldUpdateOperationsInput | number
    failedOrigins?: IntFieldUpdateOperationsInput | number
    coverage?: FloatFieldUpdateOperationsInput | number
    mae?: NullableFloatFieldUpdateOperationsInput | number | null
    rmse?: NullableFloatFieldUpdateOperationsInput | number | null
    mase?: NullableFloatFieldUpdateOperationsInput | number | null
    smape?: NullableFloatFieldUpdateOperationsInput | number | null
    directionalAccuracy?: NullableFloatFieldUpdateOperationsInput | number | null
    bias?: NullableFloatFieldUpdateOperationsInput | number | null
    failureSummaryJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    run?: ForecastVerificationRunUpdateOneRequiredWithoutMetricsNestedInput
  }

  export type ForecastVerificationMetricUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    runId?: StringFieldUpdateOperationsInput | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonSteps?: IntFieldUpdateOperationsInput | number
    origins?: IntFieldUpdateOperationsInput | number
    expectedOrigins?: IntFieldUpdateOperationsInput | number
    failedOrigins?: IntFieldUpdateOperationsInput | number
    coverage?: FloatFieldUpdateOperationsInput | number
    mae?: NullableFloatFieldUpdateOperationsInput | number | null
    rmse?: NullableFloatFieldUpdateOperationsInput | number | null
    mase?: NullableFloatFieldUpdateOperationsInput | number | null
    smape?: NullableFloatFieldUpdateOperationsInput | number | null
    directionalAccuracy?: NullableFloatFieldUpdateOperationsInput | number | null
    bias?: NullableFloatFieldUpdateOperationsInput | number | null
    failureSummaryJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ForecastVerificationMetricCreateManyInput = {
    id?: string
    runId: string
    horizonLabel: string
    horizonSteps: number
    origins: number
    expectedOrigins: number
    failedOrigins: number
    coverage: number
    mae?: number | null
    rmse?: number | null
    mase?: number | null
    smape?: number | null
    directionalAccuracy?: number | null
    bias?: number | null
    failureSummaryJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ForecastVerificationMetricUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonSteps?: IntFieldUpdateOperationsInput | number
    origins?: IntFieldUpdateOperationsInput | number
    expectedOrigins?: IntFieldUpdateOperationsInput | number
    failedOrigins?: IntFieldUpdateOperationsInput | number
    coverage?: FloatFieldUpdateOperationsInput | number
    mae?: NullableFloatFieldUpdateOperationsInput | number | null
    rmse?: NullableFloatFieldUpdateOperationsInput | number | null
    mase?: NullableFloatFieldUpdateOperationsInput | number | null
    smape?: NullableFloatFieldUpdateOperationsInput | number | null
    directionalAccuracy?: NullableFloatFieldUpdateOperationsInput | number | null
    bias?: NullableFloatFieldUpdateOperationsInput | number | null
    failureSummaryJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ForecastVerificationMetricUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    runId?: StringFieldUpdateOperationsInput | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonSteps?: IntFieldUpdateOperationsInput | number
    origins?: IntFieldUpdateOperationsInput | number
    expectedOrigins?: IntFieldUpdateOperationsInput | number
    failedOrigins?: IntFieldUpdateOperationsInput | number
    coverage?: FloatFieldUpdateOperationsInput | number
    mae?: NullableFloatFieldUpdateOperationsInput | number | null
    rmse?: NullableFloatFieldUpdateOperationsInput | number | null
    mase?: NullableFloatFieldUpdateOperationsInput | number | null
    smape?: NullableFloatFieldUpdateOperationsInput | number | null
    directionalAccuracy?: NullableFloatFieldUpdateOperationsInput | number | null
    bias?: NullableFloatFieldUpdateOperationsInput | number | null
    failureSummaryJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ForecastVerificationPointCreateInput = {
    id?: string
    horizonLabel: string
    horizonSteps: number
    forecastOriginAt: Date | string
    targetDate: Date | string
    actualObservedAt?: Date | string | null
    originValue: Decimal | DecimalJsLike | number | string
    forecastValue: Decimal | DecimalJsLike | number | string
    actualValue: Decimal | DecimalJsLike | number | string
    errorValue: Decimal | DecimalJsLike | number | string
    absoluteErrorValue: Decimal | DecimalJsLike | number | string
    deltaValue: Decimal | DecimalJsLike | number | string
    deltaPct?: number | null
    maseScale: Decimal | DecimalJsLike | number | string
    selectedVariant?: string | null
    selectionMetric?: string | null
    selectionScore?: number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    run: ForecastVerificationRunCreateNestedOneWithoutPointsInput
  }

  export type ForecastVerificationPointUncheckedCreateInput = {
    id?: string
    runId: string
    horizonLabel: string
    horizonSteps: number
    forecastOriginAt: Date | string
    targetDate: Date | string
    actualObservedAt?: Date | string | null
    originValue: Decimal | DecimalJsLike | number | string
    forecastValue: Decimal | DecimalJsLike | number | string
    actualValue: Decimal | DecimalJsLike | number | string
    errorValue: Decimal | DecimalJsLike | number | string
    absoluteErrorValue: Decimal | DecimalJsLike | number | string
    deltaValue: Decimal | DecimalJsLike | number | string
    deltaPct?: number | null
    maseScale: Decimal | DecimalJsLike | number | string
    selectedVariant?: string | null
    selectionMetric?: string | null
    selectionScore?: number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ForecastVerificationPointUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonSteps?: IntFieldUpdateOperationsInput | number
    forecastOriginAt?: DateTimeFieldUpdateOperationsInput | Date | string
    targetDate?: DateTimeFieldUpdateOperationsInput | Date | string
    actualObservedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    originValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    forecastValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    actualValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    errorValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    absoluteErrorValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    deltaValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    deltaPct?: NullableFloatFieldUpdateOperationsInput | number | null
    maseScale?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    selectedVariant?: NullableStringFieldUpdateOperationsInput | string | null
    selectionMetric?: NullableStringFieldUpdateOperationsInput | string | null
    selectionScore?: NullableFloatFieldUpdateOperationsInput | number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    run?: ForecastVerificationRunUpdateOneRequiredWithoutPointsNestedInput
  }

  export type ForecastVerificationPointUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    runId?: StringFieldUpdateOperationsInput | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonSteps?: IntFieldUpdateOperationsInput | number
    forecastOriginAt?: DateTimeFieldUpdateOperationsInput | Date | string
    targetDate?: DateTimeFieldUpdateOperationsInput | Date | string
    actualObservedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    originValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    forecastValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    actualValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    errorValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    absoluteErrorValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    deltaValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    deltaPct?: NullableFloatFieldUpdateOperationsInput | number | null
    maseScale?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    selectedVariant?: NullableStringFieldUpdateOperationsInput | string | null
    selectionMetric?: NullableStringFieldUpdateOperationsInput | string | null
    selectionScore?: NullableFloatFieldUpdateOperationsInput | number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ForecastVerificationPointCreateManyInput = {
    id?: string
    runId: string
    horizonLabel: string
    horizonSteps: number
    forecastOriginAt: Date | string
    targetDate: Date | string
    actualObservedAt?: Date | string | null
    originValue: Decimal | DecimalJsLike | number | string
    forecastValue: Decimal | DecimalJsLike | number | string
    actualValue: Decimal | DecimalJsLike | number | string
    errorValue: Decimal | DecimalJsLike | number | string
    absoluteErrorValue: Decimal | DecimalJsLike | number | string
    deltaValue: Decimal | DecimalJsLike | number | string
    deltaPct?: number | null
    maseScale: Decimal | DecimalJsLike | number | string
    selectedVariant?: string | null
    selectionMetric?: string | null
    selectionScore?: number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ForecastVerificationPointUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonSteps?: IntFieldUpdateOperationsInput | number
    forecastOriginAt?: DateTimeFieldUpdateOperationsInput | Date | string
    targetDate?: DateTimeFieldUpdateOperationsInput | Date | string
    actualObservedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    originValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    forecastValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    actualValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    errorValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    absoluteErrorValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    deltaValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    deltaPct?: NullableFloatFieldUpdateOperationsInput | number | null
    maseScale?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    selectedVariant?: NullableStringFieldUpdateOperationsInput | string | null
    selectionMetric?: NullableStringFieldUpdateOperationsInput | string | null
    selectionScore?: NullableFloatFieldUpdateOperationsInput | number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ForecastVerificationPointUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    runId?: StringFieldUpdateOperationsInput | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonSteps?: IntFieldUpdateOperationsInput | number
    forecastOriginAt?: DateTimeFieldUpdateOperationsInput | Date | string
    targetDate?: DateTimeFieldUpdateOperationsInput | Date | string
    actualObservedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    originValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    forecastValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    actualValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    errorValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    absoluteErrorValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    deltaValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    deltaPct?: NullableFloatFieldUpdateOperationsInput | number | null
    maseScale?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    selectedVariant?: NullableStringFieldUpdateOperationsInput | string | null
    selectionMetric?: NullableStringFieldUpdateOperationsInput | string | null
    selectionScore?: NullableFloatFieldUpdateOperationsInput | number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RollingDailyVerificationRecordCreateInput = {
    id?: string
    seriesId: string
    inputSource: string
    inputRunId?: string | null
    targetBasis?: $Enums.ForecastTargetBasis
    methodId: string
    methodVersion: string
    modelId: string
    forecastOriginAt: Date | string
    horizonLabel: string
    horizonMonths: number
    horizonSteps: number
    targetCalendarDate: Date | string
    verificationObservedAt?: Date | string | null
    maturityStatus: $Enums.RollingDailyVerificationMaturityStatus
    originValue: Decimal | DecimalJsLike | number | string
    forecastValue: Decimal | DecimalJsLike | number | string
    actualValue?: Decimal | DecimalJsLike | number | string | null
    errorValue?: Decimal | DecimalJsLike | number | string | null
    absoluteErrorValue?: Decimal | DecimalJsLike | number | string | null
    deltaValue?: Decimal | DecimalJsLike | number | string | null
    deltaPct?: number | null
    residualValue?: Decimal | DecimalJsLike | number | string | null
    maseScale: number
    trainingHistoryStartAt?: Date | string | null
    trainingHistoryEndAt: Date | string
    trainingObservationCount: number
    sourceHistoryFingerprint: string
    selectedVariant?: string | null
    selectionMetric?: string | null
    selectionScore?: number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type RollingDailyVerificationRecordUncheckedCreateInput = {
    id?: string
    seriesId: string
    inputSource: string
    inputRunId?: string | null
    targetBasis?: $Enums.ForecastTargetBasis
    methodId: string
    methodVersion: string
    modelId: string
    forecastOriginAt: Date | string
    horizonLabel: string
    horizonMonths: number
    horizonSteps: number
    targetCalendarDate: Date | string
    verificationObservedAt?: Date | string | null
    maturityStatus: $Enums.RollingDailyVerificationMaturityStatus
    originValue: Decimal | DecimalJsLike | number | string
    forecastValue: Decimal | DecimalJsLike | number | string
    actualValue?: Decimal | DecimalJsLike | number | string | null
    errorValue?: Decimal | DecimalJsLike | number | string | null
    absoluteErrorValue?: Decimal | DecimalJsLike | number | string | null
    deltaValue?: Decimal | DecimalJsLike | number | string | null
    deltaPct?: number | null
    residualValue?: Decimal | DecimalJsLike | number | string | null
    maseScale: number
    trainingHistoryStartAt?: Date | string | null
    trainingHistoryEndAt: Date | string
    trainingObservationCount: number
    sourceHistoryFingerprint: string
    selectedVariant?: string | null
    selectionMetric?: string | null
    selectionScore?: number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type RollingDailyVerificationRecordUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    modelId?: StringFieldUpdateOperationsInput | string
    forecastOriginAt?: DateTimeFieldUpdateOperationsInput | Date | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonMonths?: IntFieldUpdateOperationsInput | number
    horizonSteps?: IntFieldUpdateOperationsInput | number
    targetCalendarDate?: DateTimeFieldUpdateOperationsInput | Date | string
    verificationObservedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    maturityStatus?: EnumRollingDailyVerificationMaturityStatusFieldUpdateOperationsInput | $Enums.RollingDailyVerificationMaturityStatus
    originValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    forecastValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    actualValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    errorValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    absoluteErrorValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    deltaValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    deltaPct?: NullableFloatFieldUpdateOperationsInput | number | null
    residualValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maseScale?: FloatFieldUpdateOperationsInput | number
    trainingHistoryStartAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    trainingHistoryEndAt?: DateTimeFieldUpdateOperationsInput | Date | string
    trainingObservationCount?: IntFieldUpdateOperationsInput | number
    sourceHistoryFingerprint?: StringFieldUpdateOperationsInput | string
    selectedVariant?: NullableStringFieldUpdateOperationsInput | string | null
    selectionMetric?: NullableStringFieldUpdateOperationsInput | string | null
    selectionScore?: NullableFloatFieldUpdateOperationsInput | number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RollingDailyVerificationRecordUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    modelId?: StringFieldUpdateOperationsInput | string
    forecastOriginAt?: DateTimeFieldUpdateOperationsInput | Date | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonMonths?: IntFieldUpdateOperationsInput | number
    horizonSteps?: IntFieldUpdateOperationsInput | number
    targetCalendarDate?: DateTimeFieldUpdateOperationsInput | Date | string
    verificationObservedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    maturityStatus?: EnumRollingDailyVerificationMaturityStatusFieldUpdateOperationsInput | $Enums.RollingDailyVerificationMaturityStatus
    originValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    forecastValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    actualValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    errorValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    absoluteErrorValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    deltaValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    deltaPct?: NullableFloatFieldUpdateOperationsInput | number | null
    residualValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maseScale?: FloatFieldUpdateOperationsInput | number
    trainingHistoryStartAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    trainingHistoryEndAt?: DateTimeFieldUpdateOperationsInput | Date | string
    trainingObservationCount?: IntFieldUpdateOperationsInput | number
    sourceHistoryFingerprint?: StringFieldUpdateOperationsInput | string
    selectedVariant?: NullableStringFieldUpdateOperationsInput | string | null
    selectionMetric?: NullableStringFieldUpdateOperationsInput | string | null
    selectionScore?: NullableFloatFieldUpdateOperationsInput | number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RollingDailyVerificationRecordCreateManyInput = {
    id?: string
    seriesId: string
    inputSource: string
    inputRunId?: string | null
    targetBasis?: $Enums.ForecastTargetBasis
    methodId: string
    methodVersion: string
    modelId: string
    forecastOriginAt: Date | string
    horizonLabel: string
    horizonMonths: number
    horizonSteps: number
    targetCalendarDate: Date | string
    verificationObservedAt?: Date | string | null
    maturityStatus: $Enums.RollingDailyVerificationMaturityStatus
    originValue: Decimal | DecimalJsLike | number | string
    forecastValue: Decimal | DecimalJsLike | number | string
    actualValue?: Decimal | DecimalJsLike | number | string | null
    errorValue?: Decimal | DecimalJsLike | number | string | null
    absoluteErrorValue?: Decimal | DecimalJsLike | number | string | null
    deltaValue?: Decimal | DecimalJsLike | number | string | null
    deltaPct?: number | null
    residualValue?: Decimal | DecimalJsLike | number | string | null
    maseScale: number
    trainingHistoryStartAt?: Date | string | null
    trainingHistoryEndAt: Date | string
    trainingObservationCount: number
    sourceHistoryFingerprint: string
    selectedVariant?: string | null
    selectionMetric?: string | null
    selectionScore?: number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type RollingDailyVerificationRecordUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    modelId?: StringFieldUpdateOperationsInput | string
    forecastOriginAt?: DateTimeFieldUpdateOperationsInput | Date | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonMonths?: IntFieldUpdateOperationsInput | number
    horizonSteps?: IntFieldUpdateOperationsInput | number
    targetCalendarDate?: DateTimeFieldUpdateOperationsInput | Date | string
    verificationObservedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    maturityStatus?: EnumRollingDailyVerificationMaturityStatusFieldUpdateOperationsInput | $Enums.RollingDailyVerificationMaturityStatus
    originValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    forecastValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    actualValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    errorValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    absoluteErrorValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    deltaValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    deltaPct?: NullableFloatFieldUpdateOperationsInput | number | null
    residualValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maseScale?: FloatFieldUpdateOperationsInput | number
    trainingHistoryStartAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    trainingHistoryEndAt?: DateTimeFieldUpdateOperationsInput | Date | string
    trainingObservationCount?: IntFieldUpdateOperationsInput | number
    sourceHistoryFingerprint?: StringFieldUpdateOperationsInput | string
    selectedVariant?: NullableStringFieldUpdateOperationsInput | string | null
    selectionMetric?: NullableStringFieldUpdateOperationsInput | string | null
    selectionScore?: NullableFloatFieldUpdateOperationsInput | number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RollingDailyVerificationRecordUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    modelId?: StringFieldUpdateOperationsInput | string
    forecastOriginAt?: DateTimeFieldUpdateOperationsInput | Date | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonMonths?: IntFieldUpdateOperationsInput | number
    horizonSteps?: IntFieldUpdateOperationsInput | number
    targetCalendarDate?: DateTimeFieldUpdateOperationsInput | Date | string
    verificationObservedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    maturityStatus?: EnumRollingDailyVerificationMaturityStatusFieldUpdateOperationsInput | $Enums.RollingDailyVerificationMaturityStatus
    originValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    forecastValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    actualValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    errorValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    absoluteErrorValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    deltaValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    deltaPct?: NullableFloatFieldUpdateOperationsInput | number | null
    residualValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maseScale?: FloatFieldUpdateOperationsInput | number
    trainingHistoryStartAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    trainingHistoryEndAt?: DateTimeFieldUpdateOperationsInput | Date | string
    trainingObservationCount?: IntFieldUpdateOperationsInput | number
    sourceHistoryFingerprint?: StringFieldUpdateOperationsInput | string
    selectedVariant?: NullableStringFieldUpdateOperationsInput | string | null
    selectionMetric?: NullableStringFieldUpdateOperationsInput | string | null
    selectionScore?: NullableFloatFieldUpdateOperationsInput | number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RollingDailyCurrentForecastSnapshotCreateInput = {
    id?: string
    seriesId: string
    inputSource: string
    inputRunId?: string | null
    targetBasis?: $Enums.ForecastTargetBasis
    methodId: string
    methodVersion: string
    modelId: string
    contractVersion: string
    status: string
    reasonCode?: string | null
    message?: string | null
    forecastOriginAt?: Date | string | null
    sourceLatestObservationAt?: Date | string | null
    payloadJson: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type RollingDailyCurrentForecastSnapshotUncheckedCreateInput = {
    id?: string
    seriesId: string
    inputSource: string
    inputRunId?: string | null
    targetBasis?: $Enums.ForecastTargetBasis
    methodId: string
    methodVersion: string
    modelId: string
    contractVersion: string
    status: string
    reasonCode?: string | null
    message?: string | null
    forecastOriginAt?: Date | string | null
    sourceLatestObservationAt?: Date | string | null
    payloadJson: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type RollingDailyCurrentForecastSnapshotUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    modelId?: StringFieldUpdateOperationsInput | string
    contractVersion?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    reasonCode?: NullableStringFieldUpdateOperationsInput | string | null
    message?: NullableStringFieldUpdateOperationsInput | string | null
    forecastOriginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    sourceLatestObservationAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    payloadJson?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RollingDailyCurrentForecastSnapshotUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    modelId?: StringFieldUpdateOperationsInput | string
    contractVersion?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    reasonCode?: NullableStringFieldUpdateOperationsInput | string | null
    message?: NullableStringFieldUpdateOperationsInput | string | null
    forecastOriginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    sourceLatestObservationAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    payloadJson?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RollingDailyCurrentForecastSnapshotCreateManyInput = {
    id?: string
    seriesId: string
    inputSource: string
    inputRunId?: string | null
    targetBasis?: $Enums.ForecastTargetBasis
    methodId: string
    methodVersion: string
    modelId: string
    contractVersion: string
    status: string
    reasonCode?: string | null
    message?: string | null
    forecastOriginAt?: Date | string | null
    sourceLatestObservationAt?: Date | string | null
    payloadJson: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type RollingDailyCurrentForecastSnapshotUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    modelId?: StringFieldUpdateOperationsInput | string
    contractVersion?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    reasonCode?: NullableStringFieldUpdateOperationsInput | string | null
    message?: NullableStringFieldUpdateOperationsInput | string | null
    forecastOriginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    sourceLatestObservationAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    payloadJson?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RollingDailyCurrentForecastSnapshotUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    modelId?: StringFieldUpdateOperationsInput | string
    contractVersion?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    reasonCode?: NullableStringFieldUpdateOperationsInput | string | null
    message?: NullableStringFieldUpdateOperationsInput | string | null
    forecastOriginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    sourceLatestObservationAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    payloadJson?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RollingDailyCalibrationGroupCreateInput = {
    id?: string
    seriesId: string
    inputSource: string
    inputRunId?: string | null
    targetBasis?: $Enums.ForecastTargetBasis
    methodId: string
    methodVersion: string
    modelId: string
    horizonLabel: string
    horizonMonths: number
    calibrationOriginAt: Date | string
    sampleCount: number
    residualP10?: Decimal | DecimalJsLike | number | string | null
    residualP90?: Decimal | DecimalJsLike | number | string | null
    quantileMethod: string
    status: $Enums.RollingDailyCalibrationStatus
    lastResidualObservedAt?: Date | string | null
    refreshedAt: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type RollingDailyCalibrationGroupUncheckedCreateInput = {
    id?: string
    seriesId: string
    inputSource: string
    inputRunId?: string | null
    targetBasis?: $Enums.ForecastTargetBasis
    methodId: string
    methodVersion: string
    modelId: string
    horizonLabel: string
    horizonMonths: number
    calibrationOriginAt: Date | string
    sampleCount: number
    residualP10?: Decimal | DecimalJsLike | number | string | null
    residualP90?: Decimal | DecimalJsLike | number | string | null
    quantileMethod: string
    status: $Enums.RollingDailyCalibrationStatus
    lastResidualObservedAt?: Date | string | null
    refreshedAt: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type RollingDailyCalibrationGroupUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    modelId?: StringFieldUpdateOperationsInput | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonMonths?: IntFieldUpdateOperationsInput | number
    calibrationOriginAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sampleCount?: IntFieldUpdateOperationsInput | number
    residualP10?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    residualP90?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    quantileMethod?: StringFieldUpdateOperationsInput | string
    status?: EnumRollingDailyCalibrationStatusFieldUpdateOperationsInput | $Enums.RollingDailyCalibrationStatus
    lastResidualObservedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    refreshedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RollingDailyCalibrationGroupUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    modelId?: StringFieldUpdateOperationsInput | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonMonths?: IntFieldUpdateOperationsInput | number
    calibrationOriginAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sampleCount?: IntFieldUpdateOperationsInput | number
    residualP10?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    residualP90?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    quantileMethod?: StringFieldUpdateOperationsInput | string
    status?: EnumRollingDailyCalibrationStatusFieldUpdateOperationsInput | $Enums.RollingDailyCalibrationStatus
    lastResidualObservedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    refreshedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RollingDailyCalibrationGroupCreateManyInput = {
    id?: string
    seriesId: string
    inputSource: string
    inputRunId?: string | null
    targetBasis?: $Enums.ForecastTargetBasis
    methodId: string
    methodVersion: string
    modelId: string
    horizonLabel: string
    horizonMonths: number
    calibrationOriginAt: Date | string
    sampleCount: number
    residualP10?: Decimal | DecimalJsLike | number | string | null
    residualP90?: Decimal | DecimalJsLike | number | string | null
    quantileMethod: string
    status: $Enums.RollingDailyCalibrationStatus
    lastResidualObservedAt?: Date | string | null
    refreshedAt: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type RollingDailyCalibrationGroupUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    modelId?: StringFieldUpdateOperationsInput | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonMonths?: IntFieldUpdateOperationsInput | number
    calibrationOriginAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sampleCount?: IntFieldUpdateOperationsInput | number
    residualP10?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    residualP90?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    quantileMethod?: StringFieldUpdateOperationsInput | string
    status?: EnumRollingDailyCalibrationStatusFieldUpdateOperationsInput | $Enums.RollingDailyCalibrationStatus
    lastResidualObservedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    refreshedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RollingDailyCalibrationGroupUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    modelId?: StringFieldUpdateOperationsInput | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonMonths?: IntFieldUpdateOperationsInput | number
    calibrationOriginAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sampleCount?: IntFieldUpdateOperationsInput | number
    residualP10?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    residualP90?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    quantileMethod?: StringFieldUpdateOperationsInput | string
    status?: EnumRollingDailyCalibrationStatusFieldUpdateOperationsInput | $Enums.RollingDailyCalibrationStatus
    lastResidualObservedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    refreshedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RollingDailyMaintenanceStateCreateInput = {
    id?: string
    seriesId: string
    inputSource: string
    inputRunId?: string | null
    targetBasis?: $Enums.ForecastTargetBasis
    methodId: string
    methodVersion: string
    modelId: string
    historicalOriginStartAt: Date | string
    minimumTrainingObservations: number
    minimumCalibrationSamples: number
    latestSourceObservationAt?: Date | string | null
    latestSourceHistoryStartAt?: Date | string | null
    latestSourceObservationCount?: number | null
    latestSourceHistoryFingerprint?: string | null
    lastProcessedOriginAt?: Date | string | null
    lastMaturedObservedAt?: Date | string | null
    lastMaintenanceAt?: Date | string | null
    lastMaintenanceStatus?: string | null
    lastFailureReason?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type RollingDailyMaintenanceStateUncheckedCreateInput = {
    id?: string
    seriesId: string
    inputSource: string
    inputRunId?: string | null
    targetBasis?: $Enums.ForecastTargetBasis
    methodId: string
    methodVersion: string
    modelId: string
    historicalOriginStartAt: Date | string
    minimumTrainingObservations: number
    minimumCalibrationSamples: number
    latestSourceObservationAt?: Date | string | null
    latestSourceHistoryStartAt?: Date | string | null
    latestSourceObservationCount?: number | null
    latestSourceHistoryFingerprint?: string | null
    lastProcessedOriginAt?: Date | string | null
    lastMaturedObservedAt?: Date | string | null
    lastMaintenanceAt?: Date | string | null
    lastMaintenanceStatus?: string | null
    lastFailureReason?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type RollingDailyMaintenanceStateUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    modelId?: StringFieldUpdateOperationsInput | string
    historicalOriginStartAt?: DateTimeFieldUpdateOperationsInput | Date | string
    minimumTrainingObservations?: IntFieldUpdateOperationsInput | number
    minimumCalibrationSamples?: IntFieldUpdateOperationsInput | number
    latestSourceObservationAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    latestSourceHistoryStartAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    latestSourceObservationCount?: NullableIntFieldUpdateOperationsInput | number | null
    latestSourceHistoryFingerprint?: NullableStringFieldUpdateOperationsInput | string | null
    lastProcessedOriginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastMaturedObservedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastMaintenanceAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastMaintenanceStatus?: NullableStringFieldUpdateOperationsInput | string | null
    lastFailureReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RollingDailyMaintenanceStateUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    modelId?: StringFieldUpdateOperationsInput | string
    historicalOriginStartAt?: DateTimeFieldUpdateOperationsInput | Date | string
    minimumTrainingObservations?: IntFieldUpdateOperationsInput | number
    minimumCalibrationSamples?: IntFieldUpdateOperationsInput | number
    latestSourceObservationAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    latestSourceHistoryStartAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    latestSourceObservationCount?: NullableIntFieldUpdateOperationsInput | number | null
    latestSourceHistoryFingerprint?: NullableStringFieldUpdateOperationsInput | string | null
    lastProcessedOriginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastMaturedObservedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastMaintenanceAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastMaintenanceStatus?: NullableStringFieldUpdateOperationsInput | string | null
    lastFailureReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RollingDailyMaintenanceStateCreateManyInput = {
    id?: string
    seriesId: string
    inputSource: string
    inputRunId?: string | null
    targetBasis?: $Enums.ForecastTargetBasis
    methodId: string
    methodVersion: string
    modelId: string
    historicalOriginStartAt: Date | string
    minimumTrainingObservations: number
    minimumCalibrationSamples: number
    latestSourceObservationAt?: Date | string | null
    latestSourceHistoryStartAt?: Date | string | null
    latestSourceObservationCount?: number | null
    latestSourceHistoryFingerprint?: string | null
    lastProcessedOriginAt?: Date | string | null
    lastMaturedObservedAt?: Date | string | null
    lastMaintenanceAt?: Date | string | null
    lastMaintenanceStatus?: string | null
    lastFailureReason?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type RollingDailyMaintenanceStateUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    modelId?: StringFieldUpdateOperationsInput | string
    historicalOriginStartAt?: DateTimeFieldUpdateOperationsInput | Date | string
    minimumTrainingObservations?: IntFieldUpdateOperationsInput | number
    minimumCalibrationSamples?: IntFieldUpdateOperationsInput | number
    latestSourceObservationAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    latestSourceHistoryStartAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    latestSourceObservationCount?: NullableIntFieldUpdateOperationsInput | number | null
    latestSourceHistoryFingerprint?: NullableStringFieldUpdateOperationsInput | string | null
    lastProcessedOriginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastMaturedObservedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastMaintenanceAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastMaintenanceStatus?: NullableStringFieldUpdateOperationsInput | string | null
    lastFailureReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RollingDailyMaintenanceStateUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    modelId?: StringFieldUpdateOperationsInput | string
    historicalOriginStartAt?: DateTimeFieldUpdateOperationsInput | Date | string
    minimumTrainingObservations?: IntFieldUpdateOperationsInput | number
    minimumCalibrationSamples?: IntFieldUpdateOperationsInput | number
    latestSourceObservationAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    latestSourceHistoryStartAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    latestSourceObservationCount?: NullableIntFieldUpdateOperationsInput | number | null
    latestSourceHistoryFingerprint?: NullableStringFieldUpdateOperationsInput | string | null
    lastProcessedOriginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastMaturedObservedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastMaintenanceAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastMaintenanceStatus?: NullableStringFieldUpdateOperationsInput | string | null
    lastFailureReason?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type EnumForecastTargetBasisFilter<$PrismaModel = never> = {
    equals?: $Enums.ForecastTargetBasis | EnumForecastTargetBasisFieldRefInput<$PrismaModel>
    in?: $Enums.ForecastTargetBasis[] | ListEnumForecastTargetBasisFieldRefInput<$PrismaModel>
    notIn?: $Enums.ForecastTargetBasis[] | ListEnumForecastTargetBasisFieldRefInput<$PrismaModel>
    not?: NestedEnumForecastTargetBasisFilter<$PrismaModel> | $Enums.ForecastTargetBasis
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type FloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type ForecastCurrentPointListRelationFilter = {
    every?: ForecastCurrentPointWhereInput
    some?: ForecastCurrentPointWhereInput
    none?: ForecastCurrentPointWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type ForecastCurrentPointOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ForecastCurrentRunSeriesIdInputSourceHistoryFingerprintTargetBasisMethodIdModelIdMethodVersionCompoundUniqueInput = {
    seriesId: string
    inputSource: string
    historyFingerprint: string
    targetBasis: $Enums.ForecastTargetBasis
    methodId: string
    modelId: string
    methodVersion: string
  }

  export type ForecastCurrentRunCountOrderByAggregateInput = {
    id?: SortOrder
    seriesId?: SortOrder
    displayName?: SortOrder
    description?: SortOrder
    frequency?: SortOrder
    currency?: SortOrder
    unit?: SortOrder
    sourceLabel?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrder
    historyFingerprint?: SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    historyStartAt?: SortOrder
    historyEndAt?: SortOrder
    observationCount?: SortOrder
    forecastOriginAt?: SortOrder
    modelId?: SortOrder
    methodVersion?: SortOrder
    status?: SortOrder
    failureReason?: SortOrder
    runtimeSeconds?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ForecastCurrentRunAvgOrderByAggregateInput = {
    observationCount?: SortOrder
    runtimeSeconds?: SortOrder
  }

  export type ForecastCurrentRunMaxOrderByAggregateInput = {
    id?: SortOrder
    seriesId?: SortOrder
    displayName?: SortOrder
    description?: SortOrder
    frequency?: SortOrder
    currency?: SortOrder
    unit?: SortOrder
    sourceLabel?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrder
    historyFingerprint?: SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    historyStartAt?: SortOrder
    historyEndAt?: SortOrder
    observationCount?: SortOrder
    forecastOriginAt?: SortOrder
    modelId?: SortOrder
    methodVersion?: SortOrder
    status?: SortOrder
    failureReason?: SortOrder
    runtimeSeconds?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ForecastCurrentRunMinOrderByAggregateInput = {
    id?: SortOrder
    seriesId?: SortOrder
    displayName?: SortOrder
    description?: SortOrder
    frequency?: SortOrder
    currency?: SortOrder
    unit?: SortOrder
    sourceLabel?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrder
    historyFingerprint?: SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    historyStartAt?: SortOrder
    historyEndAt?: SortOrder
    observationCount?: SortOrder
    forecastOriginAt?: SortOrder
    modelId?: SortOrder
    methodVersion?: SortOrder
    status?: SortOrder
    failureReason?: SortOrder
    runtimeSeconds?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ForecastCurrentRunSumOrderByAggregateInput = {
    observationCount?: SortOrder
    runtimeSeconds?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type EnumForecastTargetBasisWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.ForecastTargetBasis | EnumForecastTargetBasisFieldRefInput<$PrismaModel>
    in?: $Enums.ForecastTargetBasis[] | ListEnumForecastTargetBasisFieldRefInput<$PrismaModel>
    notIn?: $Enums.ForecastTargetBasis[] | ListEnumForecastTargetBasisFieldRefInput<$PrismaModel>
    not?: NestedEnumForecastTargetBasisWithAggregatesFilter<$PrismaModel> | $Enums.ForecastTargetBasis
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumForecastTargetBasisFilter<$PrismaModel>
    _max?: NestedEnumForecastTargetBasisFilter<$PrismaModel>
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type FloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedFloatNullableFilter<$PrismaModel>
    _min?: NestedFloatNullableFilter<$PrismaModel>
    _max?: NestedFloatNullableFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type DecimalNullableFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel> | null
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalNullableFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string | null
  }
  export type JsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type ForecastCurrentRunScalarRelationFilter = {
    is?: ForecastCurrentRunWhereInput
    isNot?: ForecastCurrentRunWhereInput
  }

  export type ForecastCurrentPointRunIdHorizonLabelCompoundUniqueInput = {
    runId: string
    horizonLabel: string
  }

  export type ForecastCurrentPointCountOrderByAggregateInput = {
    id?: SortOrder
    runId?: SortOrder
    horizonLabel?: SortOrder
    horizonSteps?: SortOrder
    forecastDate?: SortOrder
    forecastValue?: SortOrder
    fitStatus?: SortOrder
    failureReason?: SortOrder
    selectedVariant?: SortOrder
    selectionMetric?: SortOrder
    selectionScore?: SortOrder
    metadataJson?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ForecastCurrentPointAvgOrderByAggregateInput = {
    horizonSteps?: SortOrder
    forecastValue?: SortOrder
    selectionScore?: SortOrder
  }

  export type ForecastCurrentPointMaxOrderByAggregateInput = {
    id?: SortOrder
    runId?: SortOrder
    horizonLabel?: SortOrder
    horizonSteps?: SortOrder
    forecastDate?: SortOrder
    forecastValue?: SortOrder
    fitStatus?: SortOrder
    failureReason?: SortOrder
    selectedVariant?: SortOrder
    selectionMetric?: SortOrder
    selectionScore?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ForecastCurrentPointMinOrderByAggregateInput = {
    id?: SortOrder
    runId?: SortOrder
    horizonLabel?: SortOrder
    horizonSteps?: SortOrder
    forecastDate?: SortOrder
    forecastValue?: SortOrder
    fitStatus?: SortOrder
    failureReason?: SortOrder
    selectedVariant?: SortOrder
    selectionMetric?: SortOrder
    selectionScore?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ForecastCurrentPointSumOrderByAggregateInput = {
    horizonSteps?: SortOrder
    forecastValue?: SortOrder
    selectionScore?: SortOrder
  }

  export type DecimalNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel> | null
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalNullableWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedDecimalNullableFilter<$PrismaModel>
    _sum?: NestedDecimalNullableFilter<$PrismaModel>
    _min?: NestedDecimalNullableFilter<$PrismaModel>
    _max?: NestedDecimalNullableFilter<$PrismaModel>
  }
  export type JsonNullableWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedJsonNullableFilter<$PrismaModel>
    _max?: NestedJsonNullableFilter<$PrismaModel>
  }

  export type ForecastVerificationMetricListRelationFilter = {
    every?: ForecastVerificationMetricWhereInput
    some?: ForecastVerificationMetricWhereInput
    none?: ForecastVerificationMetricWhereInput
  }

  export type ForecastVerificationPointListRelationFilter = {
    every?: ForecastVerificationPointWhereInput
    some?: ForecastVerificationPointWhereInput
    none?: ForecastVerificationPointWhereInput
  }

  export type ForecastVerificationMetricOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ForecastVerificationPointOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ForecastVerificationRunSeriesIdInputSourceHistoryFingerprintTargetBasisMethodIdModelIdMethodVersionCompoundUniqueInput = {
    seriesId: string
    inputSource: string
    historyFingerprint: string
    targetBasis: $Enums.ForecastTargetBasis
    methodId: string
    modelId: string
    methodVersion: string
  }

  export type ForecastVerificationRunCountOrderByAggregateInput = {
    id?: SortOrder
    seriesId?: SortOrder
    displayName?: SortOrder
    description?: SortOrder
    frequency?: SortOrder
    currency?: SortOrder
    unit?: SortOrder
    sourceLabel?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrder
    historyFingerprint?: SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    historyStartAt?: SortOrder
    historyEndAt?: SortOrder
    observationCount?: SortOrder
    forecastOriginAt?: SortOrder
    modelId?: SortOrder
    methodVersion?: SortOrder
    status?: SortOrder
    failureReason?: SortOrder
    runtimeSeconds?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ForecastVerificationRunAvgOrderByAggregateInput = {
    observationCount?: SortOrder
    runtimeSeconds?: SortOrder
  }

  export type ForecastVerificationRunMaxOrderByAggregateInput = {
    id?: SortOrder
    seriesId?: SortOrder
    displayName?: SortOrder
    description?: SortOrder
    frequency?: SortOrder
    currency?: SortOrder
    unit?: SortOrder
    sourceLabel?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrder
    historyFingerprint?: SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    historyStartAt?: SortOrder
    historyEndAt?: SortOrder
    observationCount?: SortOrder
    forecastOriginAt?: SortOrder
    modelId?: SortOrder
    methodVersion?: SortOrder
    status?: SortOrder
    failureReason?: SortOrder
    runtimeSeconds?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ForecastVerificationRunMinOrderByAggregateInput = {
    id?: SortOrder
    seriesId?: SortOrder
    displayName?: SortOrder
    description?: SortOrder
    frequency?: SortOrder
    currency?: SortOrder
    unit?: SortOrder
    sourceLabel?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrder
    historyFingerprint?: SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    historyStartAt?: SortOrder
    historyEndAt?: SortOrder
    observationCount?: SortOrder
    forecastOriginAt?: SortOrder
    modelId?: SortOrder
    methodVersion?: SortOrder
    status?: SortOrder
    failureReason?: SortOrder
    runtimeSeconds?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ForecastVerificationRunSumOrderByAggregateInput = {
    observationCount?: SortOrder
    runtimeSeconds?: SortOrder
  }

  export type FloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type ForecastVerificationRunScalarRelationFilter = {
    is?: ForecastVerificationRunWhereInput
    isNot?: ForecastVerificationRunWhereInput
  }

  export type ForecastVerificationMetricRunIdHorizonLabelCompoundUniqueInput = {
    runId: string
    horizonLabel: string
  }

  export type ForecastVerificationMetricCountOrderByAggregateInput = {
    id?: SortOrder
    runId?: SortOrder
    horizonLabel?: SortOrder
    horizonSteps?: SortOrder
    origins?: SortOrder
    expectedOrigins?: SortOrder
    failedOrigins?: SortOrder
    coverage?: SortOrder
    mae?: SortOrder
    rmse?: SortOrder
    mase?: SortOrder
    smape?: SortOrder
    directionalAccuracy?: SortOrder
    bias?: SortOrder
    failureSummaryJson?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ForecastVerificationMetricAvgOrderByAggregateInput = {
    horizonSteps?: SortOrder
    origins?: SortOrder
    expectedOrigins?: SortOrder
    failedOrigins?: SortOrder
    coverage?: SortOrder
    mae?: SortOrder
    rmse?: SortOrder
    mase?: SortOrder
    smape?: SortOrder
    directionalAccuracy?: SortOrder
    bias?: SortOrder
  }

  export type ForecastVerificationMetricMaxOrderByAggregateInput = {
    id?: SortOrder
    runId?: SortOrder
    horizonLabel?: SortOrder
    horizonSteps?: SortOrder
    origins?: SortOrder
    expectedOrigins?: SortOrder
    failedOrigins?: SortOrder
    coverage?: SortOrder
    mae?: SortOrder
    rmse?: SortOrder
    mase?: SortOrder
    smape?: SortOrder
    directionalAccuracy?: SortOrder
    bias?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ForecastVerificationMetricMinOrderByAggregateInput = {
    id?: SortOrder
    runId?: SortOrder
    horizonLabel?: SortOrder
    horizonSteps?: SortOrder
    origins?: SortOrder
    expectedOrigins?: SortOrder
    failedOrigins?: SortOrder
    coverage?: SortOrder
    mae?: SortOrder
    rmse?: SortOrder
    mase?: SortOrder
    smape?: SortOrder
    directionalAccuracy?: SortOrder
    bias?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ForecastVerificationMetricSumOrderByAggregateInput = {
    horizonSteps?: SortOrder
    origins?: SortOrder
    expectedOrigins?: SortOrder
    failedOrigins?: SortOrder
    coverage?: SortOrder
    mae?: SortOrder
    rmse?: SortOrder
    mase?: SortOrder
    smape?: SortOrder
    directionalAccuracy?: SortOrder
    bias?: SortOrder
  }

  export type FloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type DecimalFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
  }

  export type ForecastVerificationPointRunIdHorizonLabelForecastOriginAtTargetDateCompoundUniqueInput = {
    runId: string
    horizonLabel: string
    forecastOriginAt: Date | string
    targetDate: Date | string
  }

  export type ForecastVerificationPointCountOrderByAggregateInput = {
    id?: SortOrder
    runId?: SortOrder
    horizonLabel?: SortOrder
    horizonSteps?: SortOrder
    forecastOriginAt?: SortOrder
    targetDate?: SortOrder
    actualObservedAt?: SortOrder
    originValue?: SortOrder
    forecastValue?: SortOrder
    actualValue?: SortOrder
    errorValue?: SortOrder
    absoluteErrorValue?: SortOrder
    deltaValue?: SortOrder
    deltaPct?: SortOrder
    maseScale?: SortOrder
    selectedVariant?: SortOrder
    selectionMetric?: SortOrder
    selectionScore?: SortOrder
    metadataJson?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ForecastVerificationPointAvgOrderByAggregateInput = {
    horizonSteps?: SortOrder
    originValue?: SortOrder
    forecastValue?: SortOrder
    actualValue?: SortOrder
    errorValue?: SortOrder
    absoluteErrorValue?: SortOrder
    deltaValue?: SortOrder
    deltaPct?: SortOrder
    maseScale?: SortOrder
    selectionScore?: SortOrder
  }

  export type ForecastVerificationPointMaxOrderByAggregateInput = {
    id?: SortOrder
    runId?: SortOrder
    horizonLabel?: SortOrder
    horizonSteps?: SortOrder
    forecastOriginAt?: SortOrder
    targetDate?: SortOrder
    actualObservedAt?: SortOrder
    originValue?: SortOrder
    forecastValue?: SortOrder
    actualValue?: SortOrder
    errorValue?: SortOrder
    absoluteErrorValue?: SortOrder
    deltaValue?: SortOrder
    deltaPct?: SortOrder
    maseScale?: SortOrder
    selectedVariant?: SortOrder
    selectionMetric?: SortOrder
    selectionScore?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ForecastVerificationPointMinOrderByAggregateInput = {
    id?: SortOrder
    runId?: SortOrder
    horizonLabel?: SortOrder
    horizonSteps?: SortOrder
    forecastOriginAt?: SortOrder
    targetDate?: SortOrder
    actualObservedAt?: SortOrder
    originValue?: SortOrder
    forecastValue?: SortOrder
    actualValue?: SortOrder
    errorValue?: SortOrder
    absoluteErrorValue?: SortOrder
    deltaValue?: SortOrder
    deltaPct?: SortOrder
    maseScale?: SortOrder
    selectedVariant?: SortOrder
    selectionMetric?: SortOrder
    selectionScore?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ForecastVerificationPointSumOrderByAggregateInput = {
    horizonSteps?: SortOrder
    originValue?: SortOrder
    forecastValue?: SortOrder
    actualValue?: SortOrder
    errorValue?: SortOrder
    absoluteErrorValue?: SortOrder
    deltaValue?: SortOrder
    deltaPct?: SortOrder
    maseScale?: SortOrder
    selectionScore?: SortOrder
  }

  export type DecimalWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedDecimalFilter<$PrismaModel>
    _sum?: NestedDecimalFilter<$PrismaModel>
    _min?: NestedDecimalFilter<$PrismaModel>
    _max?: NestedDecimalFilter<$PrismaModel>
  }

  export type EnumRollingDailyVerificationMaturityStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.RollingDailyVerificationMaturityStatus | EnumRollingDailyVerificationMaturityStatusFieldRefInput<$PrismaModel>
    in?: $Enums.RollingDailyVerificationMaturityStatus[] | ListEnumRollingDailyVerificationMaturityStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.RollingDailyVerificationMaturityStatus[] | ListEnumRollingDailyVerificationMaturityStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumRollingDailyVerificationMaturityStatusFilter<$PrismaModel> | $Enums.RollingDailyVerificationMaturityStatus
  }

  export type RollingDailyVerificationRecordSeriesIdInputSourceTargetBasisMethodIdMethodVersionModelIdForecastOriginAtHorizonLabelCompoundUniqueInput = {
    seriesId: string
    inputSource: string
    targetBasis: $Enums.ForecastTargetBasis
    methodId: string
    methodVersion: string
    modelId: string
    forecastOriginAt: Date | string
    horizonLabel: string
  }

  export type RollingDailyVerificationRecordCountOrderByAggregateInput = {
    id?: SortOrder
    seriesId?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    methodVersion?: SortOrder
    modelId?: SortOrder
    forecastOriginAt?: SortOrder
    horizonLabel?: SortOrder
    horizonMonths?: SortOrder
    horizonSteps?: SortOrder
    targetCalendarDate?: SortOrder
    verificationObservedAt?: SortOrder
    maturityStatus?: SortOrder
    originValue?: SortOrder
    forecastValue?: SortOrder
    actualValue?: SortOrder
    errorValue?: SortOrder
    absoluteErrorValue?: SortOrder
    deltaValue?: SortOrder
    deltaPct?: SortOrder
    residualValue?: SortOrder
    maseScale?: SortOrder
    trainingHistoryStartAt?: SortOrder
    trainingHistoryEndAt?: SortOrder
    trainingObservationCount?: SortOrder
    sourceHistoryFingerprint?: SortOrder
    selectedVariant?: SortOrder
    selectionMetric?: SortOrder
    selectionScore?: SortOrder
    metadataJson?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type RollingDailyVerificationRecordAvgOrderByAggregateInput = {
    horizonMonths?: SortOrder
    horizonSteps?: SortOrder
    originValue?: SortOrder
    forecastValue?: SortOrder
    actualValue?: SortOrder
    errorValue?: SortOrder
    absoluteErrorValue?: SortOrder
    deltaValue?: SortOrder
    deltaPct?: SortOrder
    residualValue?: SortOrder
    maseScale?: SortOrder
    trainingObservationCount?: SortOrder
    selectionScore?: SortOrder
  }

  export type RollingDailyVerificationRecordMaxOrderByAggregateInput = {
    id?: SortOrder
    seriesId?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    methodVersion?: SortOrder
    modelId?: SortOrder
    forecastOriginAt?: SortOrder
    horizonLabel?: SortOrder
    horizonMonths?: SortOrder
    horizonSteps?: SortOrder
    targetCalendarDate?: SortOrder
    verificationObservedAt?: SortOrder
    maturityStatus?: SortOrder
    originValue?: SortOrder
    forecastValue?: SortOrder
    actualValue?: SortOrder
    errorValue?: SortOrder
    absoluteErrorValue?: SortOrder
    deltaValue?: SortOrder
    deltaPct?: SortOrder
    residualValue?: SortOrder
    maseScale?: SortOrder
    trainingHistoryStartAt?: SortOrder
    trainingHistoryEndAt?: SortOrder
    trainingObservationCount?: SortOrder
    sourceHistoryFingerprint?: SortOrder
    selectedVariant?: SortOrder
    selectionMetric?: SortOrder
    selectionScore?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type RollingDailyVerificationRecordMinOrderByAggregateInput = {
    id?: SortOrder
    seriesId?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    methodVersion?: SortOrder
    modelId?: SortOrder
    forecastOriginAt?: SortOrder
    horizonLabel?: SortOrder
    horizonMonths?: SortOrder
    horizonSteps?: SortOrder
    targetCalendarDate?: SortOrder
    verificationObservedAt?: SortOrder
    maturityStatus?: SortOrder
    originValue?: SortOrder
    forecastValue?: SortOrder
    actualValue?: SortOrder
    errorValue?: SortOrder
    absoluteErrorValue?: SortOrder
    deltaValue?: SortOrder
    deltaPct?: SortOrder
    residualValue?: SortOrder
    maseScale?: SortOrder
    trainingHistoryStartAt?: SortOrder
    trainingHistoryEndAt?: SortOrder
    trainingObservationCount?: SortOrder
    sourceHistoryFingerprint?: SortOrder
    selectedVariant?: SortOrder
    selectionMetric?: SortOrder
    selectionScore?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type RollingDailyVerificationRecordSumOrderByAggregateInput = {
    horizonMonths?: SortOrder
    horizonSteps?: SortOrder
    originValue?: SortOrder
    forecastValue?: SortOrder
    actualValue?: SortOrder
    errorValue?: SortOrder
    absoluteErrorValue?: SortOrder
    deltaValue?: SortOrder
    deltaPct?: SortOrder
    residualValue?: SortOrder
    maseScale?: SortOrder
    trainingObservationCount?: SortOrder
    selectionScore?: SortOrder
  }

  export type EnumRollingDailyVerificationMaturityStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.RollingDailyVerificationMaturityStatus | EnumRollingDailyVerificationMaturityStatusFieldRefInput<$PrismaModel>
    in?: $Enums.RollingDailyVerificationMaturityStatus[] | ListEnumRollingDailyVerificationMaturityStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.RollingDailyVerificationMaturityStatus[] | ListEnumRollingDailyVerificationMaturityStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumRollingDailyVerificationMaturityStatusWithAggregatesFilter<$PrismaModel> | $Enums.RollingDailyVerificationMaturityStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumRollingDailyVerificationMaturityStatusFilter<$PrismaModel>
    _max?: NestedEnumRollingDailyVerificationMaturityStatusFilter<$PrismaModel>
  }
  export type JsonFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonFilterBase<$PrismaModel>>, 'path'>>

  export type JsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type RollingDailyCurrentForecastSnapshotSeriesIdInputSourceTargetBasisMethodIdMethodVersionModelIdCompoundUniqueInput = {
    seriesId: string
    inputSource: string
    targetBasis: $Enums.ForecastTargetBasis
    methodId: string
    methodVersion: string
    modelId: string
  }

  export type RollingDailyCurrentForecastSnapshotCountOrderByAggregateInput = {
    id?: SortOrder
    seriesId?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    methodVersion?: SortOrder
    modelId?: SortOrder
    contractVersion?: SortOrder
    status?: SortOrder
    reasonCode?: SortOrder
    message?: SortOrder
    forecastOriginAt?: SortOrder
    sourceLatestObservationAt?: SortOrder
    payloadJson?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type RollingDailyCurrentForecastSnapshotMaxOrderByAggregateInput = {
    id?: SortOrder
    seriesId?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    methodVersion?: SortOrder
    modelId?: SortOrder
    contractVersion?: SortOrder
    status?: SortOrder
    reasonCode?: SortOrder
    message?: SortOrder
    forecastOriginAt?: SortOrder
    sourceLatestObservationAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type RollingDailyCurrentForecastSnapshotMinOrderByAggregateInput = {
    id?: SortOrder
    seriesId?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    methodVersion?: SortOrder
    modelId?: SortOrder
    contractVersion?: SortOrder
    status?: SortOrder
    reasonCode?: SortOrder
    message?: SortOrder
    forecastOriginAt?: SortOrder
    sourceLatestObservationAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }
  export type JsonWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedJsonFilter<$PrismaModel>
    _max?: NestedJsonFilter<$PrismaModel>
  }

  export type EnumRollingDailyCalibrationStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.RollingDailyCalibrationStatus | EnumRollingDailyCalibrationStatusFieldRefInput<$PrismaModel>
    in?: $Enums.RollingDailyCalibrationStatus[] | ListEnumRollingDailyCalibrationStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.RollingDailyCalibrationStatus[] | ListEnumRollingDailyCalibrationStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumRollingDailyCalibrationStatusFilter<$PrismaModel> | $Enums.RollingDailyCalibrationStatus
  }

  export type RollingDailyCalibrationGroupSeriesIdInputSourceTargetBasisMethodIdMethodVersionModelIdHorizonLabelCompoundUniqueInput = {
    seriesId: string
    inputSource: string
    targetBasis: $Enums.ForecastTargetBasis
    methodId: string
    methodVersion: string
    modelId: string
    horizonLabel: string
  }

  export type RollingDailyCalibrationGroupCountOrderByAggregateInput = {
    id?: SortOrder
    seriesId?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    methodVersion?: SortOrder
    modelId?: SortOrder
    horizonLabel?: SortOrder
    horizonMonths?: SortOrder
    calibrationOriginAt?: SortOrder
    sampleCount?: SortOrder
    residualP10?: SortOrder
    residualP90?: SortOrder
    quantileMethod?: SortOrder
    status?: SortOrder
    lastResidualObservedAt?: SortOrder
    refreshedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type RollingDailyCalibrationGroupAvgOrderByAggregateInput = {
    horizonMonths?: SortOrder
    sampleCount?: SortOrder
    residualP10?: SortOrder
    residualP90?: SortOrder
  }

  export type RollingDailyCalibrationGroupMaxOrderByAggregateInput = {
    id?: SortOrder
    seriesId?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    methodVersion?: SortOrder
    modelId?: SortOrder
    horizonLabel?: SortOrder
    horizonMonths?: SortOrder
    calibrationOriginAt?: SortOrder
    sampleCount?: SortOrder
    residualP10?: SortOrder
    residualP90?: SortOrder
    quantileMethod?: SortOrder
    status?: SortOrder
    lastResidualObservedAt?: SortOrder
    refreshedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type RollingDailyCalibrationGroupMinOrderByAggregateInput = {
    id?: SortOrder
    seriesId?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    methodVersion?: SortOrder
    modelId?: SortOrder
    horizonLabel?: SortOrder
    horizonMonths?: SortOrder
    calibrationOriginAt?: SortOrder
    sampleCount?: SortOrder
    residualP10?: SortOrder
    residualP90?: SortOrder
    quantileMethod?: SortOrder
    status?: SortOrder
    lastResidualObservedAt?: SortOrder
    refreshedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type RollingDailyCalibrationGroupSumOrderByAggregateInput = {
    horizonMonths?: SortOrder
    sampleCount?: SortOrder
    residualP10?: SortOrder
    residualP90?: SortOrder
  }

  export type EnumRollingDailyCalibrationStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.RollingDailyCalibrationStatus | EnumRollingDailyCalibrationStatusFieldRefInput<$PrismaModel>
    in?: $Enums.RollingDailyCalibrationStatus[] | ListEnumRollingDailyCalibrationStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.RollingDailyCalibrationStatus[] | ListEnumRollingDailyCalibrationStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumRollingDailyCalibrationStatusWithAggregatesFilter<$PrismaModel> | $Enums.RollingDailyCalibrationStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumRollingDailyCalibrationStatusFilter<$PrismaModel>
    _max?: NestedEnumRollingDailyCalibrationStatusFilter<$PrismaModel>
  }

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type RollingDailyMaintenanceStateSeriesIdInputSourceTargetBasisMethodIdMethodVersionModelIdCompoundUniqueInput = {
    seriesId: string
    inputSource: string
    targetBasis: $Enums.ForecastTargetBasis
    methodId: string
    methodVersion: string
    modelId: string
  }

  export type RollingDailyMaintenanceStateCountOrderByAggregateInput = {
    id?: SortOrder
    seriesId?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    methodVersion?: SortOrder
    modelId?: SortOrder
    historicalOriginStartAt?: SortOrder
    minimumTrainingObservations?: SortOrder
    minimumCalibrationSamples?: SortOrder
    latestSourceObservationAt?: SortOrder
    latestSourceHistoryStartAt?: SortOrder
    latestSourceObservationCount?: SortOrder
    latestSourceHistoryFingerprint?: SortOrder
    lastProcessedOriginAt?: SortOrder
    lastMaturedObservedAt?: SortOrder
    lastMaintenanceAt?: SortOrder
    lastMaintenanceStatus?: SortOrder
    lastFailureReason?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type RollingDailyMaintenanceStateAvgOrderByAggregateInput = {
    minimumTrainingObservations?: SortOrder
    minimumCalibrationSamples?: SortOrder
    latestSourceObservationCount?: SortOrder
  }

  export type RollingDailyMaintenanceStateMaxOrderByAggregateInput = {
    id?: SortOrder
    seriesId?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    methodVersion?: SortOrder
    modelId?: SortOrder
    historicalOriginStartAt?: SortOrder
    minimumTrainingObservations?: SortOrder
    minimumCalibrationSamples?: SortOrder
    latestSourceObservationAt?: SortOrder
    latestSourceHistoryStartAt?: SortOrder
    latestSourceObservationCount?: SortOrder
    latestSourceHistoryFingerprint?: SortOrder
    lastProcessedOriginAt?: SortOrder
    lastMaturedObservedAt?: SortOrder
    lastMaintenanceAt?: SortOrder
    lastMaintenanceStatus?: SortOrder
    lastFailureReason?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type RollingDailyMaintenanceStateMinOrderByAggregateInput = {
    id?: SortOrder
    seriesId?: SortOrder
    inputSource?: SortOrder
    inputRunId?: SortOrder
    targetBasis?: SortOrder
    methodId?: SortOrder
    methodVersion?: SortOrder
    modelId?: SortOrder
    historicalOriginStartAt?: SortOrder
    minimumTrainingObservations?: SortOrder
    minimumCalibrationSamples?: SortOrder
    latestSourceObservationAt?: SortOrder
    latestSourceHistoryStartAt?: SortOrder
    latestSourceObservationCount?: SortOrder
    latestSourceHistoryFingerprint?: SortOrder
    lastProcessedOriginAt?: SortOrder
    lastMaturedObservedAt?: SortOrder
    lastMaintenanceAt?: SortOrder
    lastMaintenanceStatus?: SortOrder
    lastFailureReason?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type RollingDailyMaintenanceStateSumOrderByAggregateInput = {
    minimumTrainingObservations?: SortOrder
    minimumCalibrationSamples?: SortOrder
    latestSourceObservationCount?: SortOrder
  }

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type ForecastCurrentPointCreateNestedManyWithoutRunInput = {
    create?: XOR<ForecastCurrentPointCreateWithoutRunInput, ForecastCurrentPointUncheckedCreateWithoutRunInput> | ForecastCurrentPointCreateWithoutRunInput[] | ForecastCurrentPointUncheckedCreateWithoutRunInput[]
    connectOrCreate?: ForecastCurrentPointCreateOrConnectWithoutRunInput | ForecastCurrentPointCreateOrConnectWithoutRunInput[]
    createMany?: ForecastCurrentPointCreateManyRunInputEnvelope
    connect?: ForecastCurrentPointWhereUniqueInput | ForecastCurrentPointWhereUniqueInput[]
  }

  export type ForecastCurrentPointUncheckedCreateNestedManyWithoutRunInput = {
    create?: XOR<ForecastCurrentPointCreateWithoutRunInput, ForecastCurrentPointUncheckedCreateWithoutRunInput> | ForecastCurrentPointCreateWithoutRunInput[] | ForecastCurrentPointUncheckedCreateWithoutRunInput[]
    connectOrCreate?: ForecastCurrentPointCreateOrConnectWithoutRunInput | ForecastCurrentPointCreateOrConnectWithoutRunInput[]
    createMany?: ForecastCurrentPointCreateManyRunInputEnvelope
    connect?: ForecastCurrentPointWhereUniqueInput | ForecastCurrentPointWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type EnumForecastTargetBasisFieldUpdateOperationsInput = {
    set?: $Enums.ForecastTargetBasis
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NullableFloatFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type ForecastCurrentPointUpdateManyWithoutRunNestedInput = {
    create?: XOR<ForecastCurrentPointCreateWithoutRunInput, ForecastCurrentPointUncheckedCreateWithoutRunInput> | ForecastCurrentPointCreateWithoutRunInput[] | ForecastCurrentPointUncheckedCreateWithoutRunInput[]
    connectOrCreate?: ForecastCurrentPointCreateOrConnectWithoutRunInput | ForecastCurrentPointCreateOrConnectWithoutRunInput[]
    upsert?: ForecastCurrentPointUpsertWithWhereUniqueWithoutRunInput | ForecastCurrentPointUpsertWithWhereUniqueWithoutRunInput[]
    createMany?: ForecastCurrentPointCreateManyRunInputEnvelope
    set?: ForecastCurrentPointWhereUniqueInput | ForecastCurrentPointWhereUniqueInput[]
    disconnect?: ForecastCurrentPointWhereUniqueInput | ForecastCurrentPointWhereUniqueInput[]
    delete?: ForecastCurrentPointWhereUniqueInput | ForecastCurrentPointWhereUniqueInput[]
    connect?: ForecastCurrentPointWhereUniqueInput | ForecastCurrentPointWhereUniqueInput[]
    update?: ForecastCurrentPointUpdateWithWhereUniqueWithoutRunInput | ForecastCurrentPointUpdateWithWhereUniqueWithoutRunInput[]
    updateMany?: ForecastCurrentPointUpdateManyWithWhereWithoutRunInput | ForecastCurrentPointUpdateManyWithWhereWithoutRunInput[]
    deleteMany?: ForecastCurrentPointScalarWhereInput | ForecastCurrentPointScalarWhereInput[]
  }

  export type ForecastCurrentPointUncheckedUpdateManyWithoutRunNestedInput = {
    create?: XOR<ForecastCurrentPointCreateWithoutRunInput, ForecastCurrentPointUncheckedCreateWithoutRunInput> | ForecastCurrentPointCreateWithoutRunInput[] | ForecastCurrentPointUncheckedCreateWithoutRunInput[]
    connectOrCreate?: ForecastCurrentPointCreateOrConnectWithoutRunInput | ForecastCurrentPointCreateOrConnectWithoutRunInput[]
    upsert?: ForecastCurrentPointUpsertWithWhereUniqueWithoutRunInput | ForecastCurrentPointUpsertWithWhereUniqueWithoutRunInput[]
    createMany?: ForecastCurrentPointCreateManyRunInputEnvelope
    set?: ForecastCurrentPointWhereUniqueInput | ForecastCurrentPointWhereUniqueInput[]
    disconnect?: ForecastCurrentPointWhereUniqueInput | ForecastCurrentPointWhereUniqueInput[]
    delete?: ForecastCurrentPointWhereUniqueInput | ForecastCurrentPointWhereUniqueInput[]
    connect?: ForecastCurrentPointWhereUniqueInput | ForecastCurrentPointWhereUniqueInput[]
    update?: ForecastCurrentPointUpdateWithWhereUniqueWithoutRunInput | ForecastCurrentPointUpdateWithWhereUniqueWithoutRunInput[]
    updateMany?: ForecastCurrentPointUpdateManyWithWhereWithoutRunInput | ForecastCurrentPointUpdateManyWithWhereWithoutRunInput[]
    deleteMany?: ForecastCurrentPointScalarWhereInput | ForecastCurrentPointScalarWhereInput[]
  }

  export type ForecastCurrentRunCreateNestedOneWithoutPointsInput = {
    create?: XOR<ForecastCurrentRunCreateWithoutPointsInput, ForecastCurrentRunUncheckedCreateWithoutPointsInput>
    connectOrCreate?: ForecastCurrentRunCreateOrConnectWithoutPointsInput
    connect?: ForecastCurrentRunWhereUniqueInput
  }

  export type NullableDecimalFieldUpdateOperationsInput = {
    set?: Decimal | DecimalJsLike | number | string | null
    increment?: Decimal | DecimalJsLike | number | string
    decrement?: Decimal | DecimalJsLike | number | string
    multiply?: Decimal | DecimalJsLike | number | string
    divide?: Decimal | DecimalJsLike | number | string
  }

  export type ForecastCurrentRunUpdateOneRequiredWithoutPointsNestedInput = {
    create?: XOR<ForecastCurrentRunCreateWithoutPointsInput, ForecastCurrentRunUncheckedCreateWithoutPointsInput>
    connectOrCreate?: ForecastCurrentRunCreateOrConnectWithoutPointsInput
    upsert?: ForecastCurrentRunUpsertWithoutPointsInput
    connect?: ForecastCurrentRunWhereUniqueInput
    update?: XOR<XOR<ForecastCurrentRunUpdateToOneWithWhereWithoutPointsInput, ForecastCurrentRunUpdateWithoutPointsInput>, ForecastCurrentRunUncheckedUpdateWithoutPointsInput>
  }

  export type ForecastVerificationMetricCreateNestedManyWithoutRunInput = {
    create?: XOR<ForecastVerificationMetricCreateWithoutRunInput, ForecastVerificationMetricUncheckedCreateWithoutRunInput> | ForecastVerificationMetricCreateWithoutRunInput[] | ForecastVerificationMetricUncheckedCreateWithoutRunInput[]
    connectOrCreate?: ForecastVerificationMetricCreateOrConnectWithoutRunInput | ForecastVerificationMetricCreateOrConnectWithoutRunInput[]
    createMany?: ForecastVerificationMetricCreateManyRunInputEnvelope
    connect?: ForecastVerificationMetricWhereUniqueInput | ForecastVerificationMetricWhereUniqueInput[]
  }

  export type ForecastVerificationPointCreateNestedManyWithoutRunInput = {
    create?: XOR<ForecastVerificationPointCreateWithoutRunInput, ForecastVerificationPointUncheckedCreateWithoutRunInput> | ForecastVerificationPointCreateWithoutRunInput[] | ForecastVerificationPointUncheckedCreateWithoutRunInput[]
    connectOrCreate?: ForecastVerificationPointCreateOrConnectWithoutRunInput | ForecastVerificationPointCreateOrConnectWithoutRunInput[]
    createMany?: ForecastVerificationPointCreateManyRunInputEnvelope
    connect?: ForecastVerificationPointWhereUniqueInput | ForecastVerificationPointWhereUniqueInput[]
  }

  export type ForecastVerificationMetricUncheckedCreateNestedManyWithoutRunInput = {
    create?: XOR<ForecastVerificationMetricCreateWithoutRunInput, ForecastVerificationMetricUncheckedCreateWithoutRunInput> | ForecastVerificationMetricCreateWithoutRunInput[] | ForecastVerificationMetricUncheckedCreateWithoutRunInput[]
    connectOrCreate?: ForecastVerificationMetricCreateOrConnectWithoutRunInput | ForecastVerificationMetricCreateOrConnectWithoutRunInput[]
    createMany?: ForecastVerificationMetricCreateManyRunInputEnvelope
    connect?: ForecastVerificationMetricWhereUniqueInput | ForecastVerificationMetricWhereUniqueInput[]
  }

  export type ForecastVerificationPointUncheckedCreateNestedManyWithoutRunInput = {
    create?: XOR<ForecastVerificationPointCreateWithoutRunInput, ForecastVerificationPointUncheckedCreateWithoutRunInput> | ForecastVerificationPointCreateWithoutRunInput[] | ForecastVerificationPointUncheckedCreateWithoutRunInput[]
    connectOrCreate?: ForecastVerificationPointCreateOrConnectWithoutRunInput | ForecastVerificationPointCreateOrConnectWithoutRunInput[]
    createMany?: ForecastVerificationPointCreateManyRunInputEnvelope
    connect?: ForecastVerificationPointWhereUniqueInput | ForecastVerificationPointWhereUniqueInput[]
  }

  export type ForecastVerificationMetricUpdateManyWithoutRunNestedInput = {
    create?: XOR<ForecastVerificationMetricCreateWithoutRunInput, ForecastVerificationMetricUncheckedCreateWithoutRunInput> | ForecastVerificationMetricCreateWithoutRunInput[] | ForecastVerificationMetricUncheckedCreateWithoutRunInput[]
    connectOrCreate?: ForecastVerificationMetricCreateOrConnectWithoutRunInput | ForecastVerificationMetricCreateOrConnectWithoutRunInput[]
    upsert?: ForecastVerificationMetricUpsertWithWhereUniqueWithoutRunInput | ForecastVerificationMetricUpsertWithWhereUniqueWithoutRunInput[]
    createMany?: ForecastVerificationMetricCreateManyRunInputEnvelope
    set?: ForecastVerificationMetricWhereUniqueInput | ForecastVerificationMetricWhereUniqueInput[]
    disconnect?: ForecastVerificationMetricWhereUniqueInput | ForecastVerificationMetricWhereUniqueInput[]
    delete?: ForecastVerificationMetricWhereUniqueInput | ForecastVerificationMetricWhereUniqueInput[]
    connect?: ForecastVerificationMetricWhereUniqueInput | ForecastVerificationMetricWhereUniqueInput[]
    update?: ForecastVerificationMetricUpdateWithWhereUniqueWithoutRunInput | ForecastVerificationMetricUpdateWithWhereUniqueWithoutRunInput[]
    updateMany?: ForecastVerificationMetricUpdateManyWithWhereWithoutRunInput | ForecastVerificationMetricUpdateManyWithWhereWithoutRunInput[]
    deleteMany?: ForecastVerificationMetricScalarWhereInput | ForecastVerificationMetricScalarWhereInput[]
  }

  export type ForecastVerificationPointUpdateManyWithoutRunNestedInput = {
    create?: XOR<ForecastVerificationPointCreateWithoutRunInput, ForecastVerificationPointUncheckedCreateWithoutRunInput> | ForecastVerificationPointCreateWithoutRunInput[] | ForecastVerificationPointUncheckedCreateWithoutRunInput[]
    connectOrCreate?: ForecastVerificationPointCreateOrConnectWithoutRunInput | ForecastVerificationPointCreateOrConnectWithoutRunInput[]
    upsert?: ForecastVerificationPointUpsertWithWhereUniqueWithoutRunInput | ForecastVerificationPointUpsertWithWhereUniqueWithoutRunInput[]
    createMany?: ForecastVerificationPointCreateManyRunInputEnvelope
    set?: ForecastVerificationPointWhereUniqueInput | ForecastVerificationPointWhereUniqueInput[]
    disconnect?: ForecastVerificationPointWhereUniqueInput | ForecastVerificationPointWhereUniqueInput[]
    delete?: ForecastVerificationPointWhereUniqueInput | ForecastVerificationPointWhereUniqueInput[]
    connect?: ForecastVerificationPointWhereUniqueInput | ForecastVerificationPointWhereUniqueInput[]
    update?: ForecastVerificationPointUpdateWithWhereUniqueWithoutRunInput | ForecastVerificationPointUpdateWithWhereUniqueWithoutRunInput[]
    updateMany?: ForecastVerificationPointUpdateManyWithWhereWithoutRunInput | ForecastVerificationPointUpdateManyWithWhereWithoutRunInput[]
    deleteMany?: ForecastVerificationPointScalarWhereInput | ForecastVerificationPointScalarWhereInput[]
  }

  export type ForecastVerificationMetricUncheckedUpdateManyWithoutRunNestedInput = {
    create?: XOR<ForecastVerificationMetricCreateWithoutRunInput, ForecastVerificationMetricUncheckedCreateWithoutRunInput> | ForecastVerificationMetricCreateWithoutRunInput[] | ForecastVerificationMetricUncheckedCreateWithoutRunInput[]
    connectOrCreate?: ForecastVerificationMetricCreateOrConnectWithoutRunInput | ForecastVerificationMetricCreateOrConnectWithoutRunInput[]
    upsert?: ForecastVerificationMetricUpsertWithWhereUniqueWithoutRunInput | ForecastVerificationMetricUpsertWithWhereUniqueWithoutRunInput[]
    createMany?: ForecastVerificationMetricCreateManyRunInputEnvelope
    set?: ForecastVerificationMetricWhereUniqueInput | ForecastVerificationMetricWhereUniqueInput[]
    disconnect?: ForecastVerificationMetricWhereUniqueInput | ForecastVerificationMetricWhereUniqueInput[]
    delete?: ForecastVerificationMetricWhereUniqueInput | ForecastVerificationMetricWhereUniqueInput[]
    connect?: ForecastVerificationMetricWhereUniqueInput | ForecastVerificationMetricWhereUniqueInput[]
    update?: ForecastVerificationMetricUpdateWithWhereUniqueWithoutRunInput | ForecastVerificationMetricUpdateWithWhereUniqueWithoutRunInput[]
    updateMany?: ForecastVerificationMetricUpdateManyWithWhereWithoutRunInput | ForecastVerificationMetricUpdateManyWithWhereWithoutRunInput[]
    deleteMany?: ForecastVerificationMetricScalarWhereInput | ForecastVerificationMetricScalarWhereInput[]
  }

  export type ForecastVerificationPointUncheckedUpdateManyWithoutRunNestedInput = {
    create?: XOR<ForecastVerificationPointCreateWithoutRunInput, ForecastVerificationPointUncheckedCreateWithoutRunInput> | ForecastVerificationPointCreateWithoutRunInput[] | ForecastVerificationPointUncheckedCreateWithoutRunInput[]
    connectOrCreate?: ForecastVerificationPointCreateOrConnectWithoutRunInput | ForecastVerificationPointCreateOrConnectWithoutRunInput[]
    upsert?: ForecastVerificationPointUpsertWithWhereUniqueWithoutRunInput | ForecastVerificationPointUpsertWithWhereUniqueWithoutRunInput[]
    createMany?: ForecastVerificationPointCreateManyRunInputEnvelope
    set?: ForecastVerificationPointWhereUniqueInput | ForecastVerificationPointWhereUniqueInput[]
    disconnect?: ForecastVerificationPointWhereUniqueInput | ForecastVerificationPointWhereUniqueInput[]
    delete?: ForecastVerificationPointWhereUniqueInput | ForecastVerificationPointWhereUniqueInput[]
    connect?: ForecastVerificationPointWhereUniqueInput | ForecastVerificationPointWhereUniqueInput[]
    update?: ForecastVerificationPointUpdateWithWhereUniqueWithoutRunInput | ForecastVerificationPointUpdateWithWhereUniqueWithoutRunInput[]
    updateMany?: ForecastVerificationPointUpdateManyWithWhereWithoutRunInput | ForecastVerificationPointUpdateManyWithWhereWithoutRunInput[]
    deleteMany?: ForecastVerificationPointScalarWhereInput | ForecastVerificationPointScalarWhereInput[]
  }

  export type ForecastVerificationRunCreateNestedOneWithoutMetricsInput = {
    create?: XOR<ForecastVerificationRunCreateWithoutMetricsInput, ForecastVerificationRunUncheckedCreateWithoutMetricsInput>
    connectOrCreate?: ForecastVerificationRunCreateOrConnectWithoutMetricsInput
    connect?: ForecastVerificationRunWhereUniqueInput
  }

  export type FloatFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type ForecastVerificationRunUpdateOneRequiredWithoutMetricsNestedInput = {
    create?: XOR<ForecastVerificationRunCreateWithoutMetricsInput, ForecastVerificationRunUncheckedCreateWithoutMetricsInput>
    connectOrCreate?: ForecastVerificationRunCreateOrConnectWithoutMetricsInput
    upsert?: ForecastVerificationRunUpsertWithoutMetricsInput
    connect?: ForecastVerificationRunWhereUniqueInput
    update?: XOR<XOR<ForecastVerificationRunUpdateToOneWithWhereWithoutMetricsInput, ForecastVerificationRunUpdateWithoutMetricsInput>, ForecastVerificationRunUncheckedUpdateWithoutMetricsInput>
  }

  export type ForecastVerificationRunCreateNestedOneWithoutPointsInput = {
    create?: XOR<ForecastVerificationRunCreateWithoutPointsInput, ForecastVerificationRunUncheckedCreateWithoutPointsInput>
    connectOrCreate?: ForecastVerificationRunCreateOrConnectWithoutPointsInput
    connect?: ForecastVerificationRunWhereUniqueInput
  }

  export type DecimalFieldUpdateOperationsInput = {
    set?: Decimal | DecimalJsLike | number | string
    increment?: Decimal | DecimalJsLike | number | string
    decrement?: Decimal | DecimalJsLike | number | string
    multiply?: Decimal | DecimalJsLike | number | string
    divide?: Decimal | DecimalJsLike | number | string
  }

  export type ForecastVerificationRunUpdateOneRequiredWithoutPointsNestedInput = {
    create?: XOR<ForecastVerificationRunCreateWithoutPointsInput, ForecastVerificationRunUncheckedCreateWithoutPointsInput>
    connectOrCreate?: ForecastVerificationRunCreateOrConnectWithoutPointsInput
    upsert?: ForecastVerificationRunUpsertWithoutPointsInput
    connect?: ForecastVerificationRunWhereUniqueInput
    update?: XOR<XOR<ForecastVerificationRunUpdateToOneWithWhereWithoutPointsInput, ForecastVerificationRunUpdateWithoutPointsInput>, ForecastVerificationRunUncheckedUpdateWithoutPointsInput>
  }

  export type EnumRollingDailyVerificationMaturityStatusFieldUpdateOperationsInput = {
    set?: $Enums.RollingDailyVerificationMaturityStatus
  }

  export type EnumRollingDailyCalibrationStatusFieldUpdateOperationsInput = {
    set?: $Enums.RollingDailyCalibrationStatus
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedEnumForecastTargetBasisFilter<$PrismaModel = never> = {
    equals?: $Enums.ForecastTargetBasis | EnumForecastTargetBasisFieldRefInput<$PrismaModel>
    in?: $Enums.ForecastTargetBasis[] | ListEnumForecastTargetBasisFieldRefInput<$PrismaModel>
    notIn?: $Enums.ForecastTargetBasis[] | ListEnumForecastTargetBasisFieldRefInput<$PrismaModel>
    not?: NestedEnumForecastTargetBasisFilter<$PrismaModel> | $Enums.ForecastTargetBasis
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedEnumForecastTargetBasisWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.ForecastTargetBasis | EnumForecastTargetBasisFieldRefInput<$PrismaModel>
    in?: $Enums.ForecastTargetBasis[] | ListEnumForecastTargetBasisFieldRefInput<$PrismaModel>
    notIn?: $Enums.ForecastTargetBasis[] | ListEnumForecastTargetBasisFieldRefInput<$PrismaModel>
    not?: NestedEnumForecastTargetBasisWithAggregatesFilter<$PrismaModel> | $Enums.ForecastTargetBasis
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumForecastTargetBasisFilter<$PrismaModel>
    _max?: NestedEnumForecastTargetBasisFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedFloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedFloatNullableFilter<$PrismaModel>
    _min?: NestedFloatNullableFilter<$PrismaModel>
    _max?: NestedFloatNullableFilter<$PrismaModel>
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedDecimalNullableFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel> | null
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalNullableFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string | null
  }

  export type NestedDecimalNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel> | null
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalNullableWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedDecimalNullableFilter<$PrismaModel>
    _sum?: NestedDecimalNullableFilter<$PrismaModel>
    _min?: NestedDecimalNullableFilter<$PrismaModel>
    _max?: NestedDecimalNullableFilter<$PrismaModel>
  }
  export type NestedJsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type NestedFloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type NestedDecimalFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
  }

  export type NestedDecimalWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedDecimalFilter<$PrismaModel>
    _sum?: NestedDecimalFilter<$PrismaModel>
    _min?: NestedDecimalFilter<$PrismaModel>
    _max?: NestedDecimalFilter<$PrismaModel>
  }

  export type NestedEnumRollingDailyVerificationMaturityStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.RollingDailyVerificationMaturityStatus | EnumRollingDailyVerificationMaturityStatusFieldRefInput<$PrismaModel>
    in?: $Enums.RollingDailyVerificationMaturityStatus[] | ListEnumRollingDailyVerificationMaturityStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.RollingDailyVerificationMaturityStatus[] | ListEnumRollingDailyVerificationMaturityStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumRollingDailyVerificationMaturityStatusFilter<$PrismaModel> | $Enums.RollingDailyVerificationMaturityStatus
  }

  export type NestedEnumRollingDailyVerificationMaturityStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.RollingDailyVerificationMaturityStatus | EnumRollingDailyVerificationMaturityStatusFieldRefInput<$PrismaModel>
    in?: $Enums.RollingDailyVerificationMaturityStatus[] | ListEnumRollingDailyVerificationMaturityStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.RollingDailyVerificationMaturityStatus[] | ListEnumRollingDailyVerificationMaturityStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumRollingDailyVerificationMaturityStatusWithAggregatesFilter<$PrismaModel> | $Enums.RollingDailyVerificationMaturityStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumRollingDailyVerificationMaturityStatusFilter<$PrismaModel>
    _max?: NestedEnumRollingDailyVerificationMaturityStatusFilter<$PrismaModel>
  }
  export type NestedJsonFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type NestedEnumRollingDailyCalibrationStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.RollingDailyCalibrationStatus | EnumRollingDailyCalibrationStatusFieldRefInput<$PrismaModel>
    in?: $Enums.RollingDailyCalibrationStatus[] | ListEnumRollingDailyCalibrationStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.RollingDailyCalibrationStatus[] | ListEnumRollingDailyCalibrationStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumRollingDailyCalibrationStatusFilter<$PrismaModel> | $Enums.RollingDailyCalibrationStatus
  }

  export type NestedEnumRollingDailyCalibrationStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.RollingDailyCalibrationStatus | EnumRollingDailyCalibrationStatusFieldRefInput<$PrismaModel>
    in?: $Enums.RollingDailyCalibrationStatus[] | ListEnumRollingDailyCalibrationStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.RollingDailyCalibrationStatus[] | ListEnumRollingDailyCalibrationStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumRollingDailyCalibrationStatusWithAggregatesFilter<$PrismaModel> | $Enums.RollingDailyCalibrationStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumRollingDailyCalibrationStatusFilter<$PrismaModel>
    _max?: NestedEnumRollingDailyCalibrationStatusFilter<$PrismaModel>
  }

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type ForecastCurrentPointCreateWithoutRunInput = {
    id?: string
    horizonLabel: string
    horizonSteps: number
    forecastDate: Date | string
    forecastValue?: Decimal | DecimalJsLike | number | string | null
    fitStatus?: string | null
    failureReason?: string | null
    selectedVariant?: string | null
    selectionMetric?: string | null
    selectionScore?: number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ForecastCurrentPointUncheckedCreateWithoutRunInput = {
    id?: string
    horizonLabel: string
    horizonSteps: number
    forecastDate: Date | string
    forecastValue?: Decimal | DecimalJsLike | number | string | null
    fitStatus?: string | null
    failureReason?: string | null
    selectedVariant?: string | null
    selectionMetric?: string | null
    selectionScore?: number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ForecastCurrentPointCreateOrConnectWithoutRunInput = {
    where: ForecastCurrentPointWhereUniqueInput
    create: XOR<ForecastCurrentPointCreateWithoutRunInput, ForecastCurrentPointUncheckedCreateWithoutRunInput>
  }

  export type ForecastCurrentPointCreateManyRunInputEnvelope = {
    data: ForecastCurrentPointCreateManyRunInput | ForecastCurrentPointCreateManyRunInput[]
    skipDuplicates?: boolean
  }

  export type ForecastCurrentPointUpsertWithWhereUniqueWithoutRunInput = {
    where: ForecastCurrentPointWhereUniqueInput
    update: XOR<ForecastCurrentPointUpdateWithoutRunInput, ForecastCurrentPointUncheckedUpdateWithoutRunInput>
    create: XOR<ForecastCurrentPointCreateWithoutRunInput, ForecastCurrentPointUncheckedCreateWithoutRunInput>
  }

  export type ForecastCurrentPointUpdateWithWhereUniqueWithoutRunInput = {
    where: ForecastCurrentPointWhereUniqueInput
    data: XOR<ForecastCurrentPointUpdateWithoutRunInput, ForecastCurrentPointUncheckedUpdateWithoutRunInput>
  }

  export type ForecastCurrentPointUpdateManyWithWhereWithoutRunInput = {
    where: ForecastCurrentPointScalarWhereInput
    data: XOR<ForecastCurrentPointUpdateManyMutationInput, ForecastCurrentPointUncheckedUpdateManyWithoutRunInput>
  }

  export type ForecastCurrentPointScalarWhereInput = {
    AND?: ForecastCurrentPointScalarWhereInput | ForecastCurrentPointScalarWhereInput[]
    OR?: ForecastCurrentPointScalarWhereInput[]
    NOT?: ForecastCurrentPointScalarWhereInput | ForecastCurrentPointScalarWhereInput[]
    id?: StringFilter<"ForecastCurrentPoint"> | string
    runId?: StringFilter<"ForecastCurrentPoint"> | string
    horizonLabel?: StringFilter<"ForecastCurrentPoint"> | string
    horizonSteps?: IntFilter<"ForecastCurrentPoint"> | number
    forecastDate?: DateTimeFilter<"ForecastCurrentPoint"> | Date | string
    forecastValue?: DecimalNullableFilter<"ForecastCurrentPoint"> | Decimal | DecimalJsLike | number | string | null
    fitStatus?: StringNullableFilter<"ForecastCurrentPoint"> | string | null
    failureReason?: StringNullableFilter<"ForecastCurrentPoint"> | string | null
    selectedVariant?: StringNullableFilter<"ForecastCurrentPoint"> | string | null
    selectionMetric?: StringNullableFilter<"ForecastCurrentPoint"> | string | null
    selectionScore?: FloatNullableFilter<"ForecastCurrentPoint"> | number | null
    metadataJson?: JsonNullableFilter<"ForecastCurrentPoint">
    createdAt?: DateTimeFilter<"ForecastCurrentPoint"> | Date | string
    updatedAt?: DateTimeFilter<"ForecastCurrentPoint"> | Date | string
  }

  export type ForecastCurrentRunCreateWithoutPointsInput = {
    id?: string
    seriesId: string
    displayName: string
    description?: string | null
    frequency?: string | null
    currency?: string | null
    unit?: string | null
    sourceLabel?: string | null
    inputSource: string
    inputRunId?: string | null
    historyFingerprint: string
    targetBasis?: $Enums.ForecastTargetBasis
    methodId: string
    historyStartAt?: Date | string | null
    historyEndAt?: Date | string | null
    observationCount: number
    forecastOriginAt?: Date | string | null
    modelId: string
    methodVersion: string
    status: string
    failureReason?: string | null
    runtimeSeconds?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ForecastCurrentRunUncheckedCreateWithoutPointsInput = {
    id?: string
    seriesId: string
    displayName: string
    description?: string | null
    frequency?: string | null
    currency?: string | null
    unit?: string | null
    sourceLabel?: string | null
    inputSource: string
    inputRunId?: string | null
    historyFingerprint: string
    targetBasis?: $Enums.ForecastTargetBasis
    methodId: string
    historyStartAt?: Date | string | null
    historyEndAt?: Date | string | null
    observationCount: number
    forecastOriginAt?: Date | string | null
    modelId: string
    methodVersion: string
    status: string
    failureReason?: string | null
    runtimeSeconds?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ForecastCurrentRunCreateOrConnectWithoutPointsInput = {
    where: ForecastCurrentRunWhereUniqueInput
    create: XOR<ForecastCurrentRunCreateWithoutPointsInput, ForecastCurrentRunUncheckedCreateWithoutPointsInput>
  }

  export type ForecastCurrentRunUpsertWithoutPointsInput = {
    update: XOR<ForecastCurrentRunUpdateWithoutPointsInput, ForecastCurrentRunUncheckedUpdateWithoutPointsInput>
    create: XOR<ForecastCurrentRunCreateWithoutPointsInput, ForecastCurrentRunUncheckedCreateWithoutPointsInput>
    where?: ForecastCurrentRunWhereInput
  }

  export type ForecastCurrentRunUpdateToOneWithWhereWithoutPointsInput = {
    where?: ForecastCurrentRunWhereInput
    data: XOR<ForecastCurrentRunUpdateWithoutPointsInput, ForecastCurrentRunUncheckedUpdateWithoutPointsInput>
  }

  export type ForecastCurrentRunUpdateWithoutPointsInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    frequency?: NullableStringFieldUpdateOperationsInput | string | null
    currency?: NullableStringFieldUpdateOperationsInput | string | null
    unit?: NullableStringFieldUpdateOperationsInput | string | null
    sourceLabel?: NullableStringFieldUpdateOperationsInput | string | null
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    historyFingerprint?: StringFieldUpdateOperationsInput | string
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    historyStartAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    historyEndAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    observationCount?: IntFieldUpdateOperationsInput | number
    forecastOriginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    modelId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    failureReason?: NullableStringFieldUpdateOperationsInput | string | null
    runtimeSeconds?: NullableFloatFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ForecastCurrentRunUncheckedUpdateWithoutPointsInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    frequency?: NullableStringFieldUpdateOperationsInput | string | null
    currency?: NullableStringFieldUpdateOperationsInput | string | null
    unit?: NullableStringFieldUpdateOperationsInput | string | null
    sourceLabel?: NullableStringFieldUpdateOperationsInput | string | null
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    historyFingerprint?: StringFieldUpdateOperationsInput | string
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    historyStartAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    historyEndAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    observationCount?: IntFieldUpdateOperationsInput | number
    forecastOriginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    modelId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    failureReason?: NullableStringFieldUpdateOperationsInput | string | null
    runtimeSeconds?: NullableFloatFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ForecastVerificationMetricCreateWithoutRunInput = {
    id?: string
    horizonLabel: string
    horizonSteps: number
    origins: number
    expectedOrigins: number
    failedOrigins: number
    coverage: number
    mae?: number | null
    rmse?: number | null
    mase?: number | null
    smape?: number | null
    directionalAccuracy?: number | null
    bias?: number | null
    failureSummaryJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ForecastVerificationMetricUncheckedCreateWithoutRunInput = {
    id?: string
    horizonLabel: string
    horizonSteps: number
    origins: number
    expectedOrigins: number
    failedOrigins: number
    coverage: number
    mae?: number | null
    rmse?: number | null
    mase?: number | null
    smape?: number | null
    directionalAccuracy?: number | null
    bias?: number | null
    failureSummaryJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ForecastVerificationMetricCreateOrConnectWithoutRunInput = {
    where: ForecastVerificationMetricWhereUniqueInput
    create: XOR<ForecastVerificationMetricCreateWithoutRunInput, ForecastVerificationMetricUncheckedCreateWithoutRunInput>
  }

  export type ForecastVerificationMetricCreateManyRunInputEnvelope = {
    data: ForecastVerificationMetricCreateManyRunInput | ForecastVerificationMetricCreateManyRunInput[]
    skipDuplicates?: boolean
  }

  export type ForecastVerificationPointCreateWithoutRunInput = {
    id?: string
    horizonLabel: string
    horizonSteps: number
    forecastOriginAt: Date | string
    targetDate: Date | string
    actualObservedAt?: Date | string | null
    originValue: Decimal | DecimalJsLike | number | string
    forecastValue: Decimal | DecimalJsLike | number | string
    actualValue: Decimal | DecimalJsLike | number | string
    errorValue: Decimal | DecimalJsLike | number | string
    absoluteErrorValue: Decimal | DecimalJsLike | number | string
    deltaValue: Decimal | DecimalJsLike | number | string
    deltaPct?: number | null
    maseScale: Decimal | DecimalJsLike | number | string
    selectedVariant?: string | null
    selectionMetric?: string | null
    selectionScore?: number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ForecastVerificationPointUncheckedCreateWithoutRunInput = {
    id?: string
    horizonLabel: string
    horizonSteps: number
    forecastOriginAt: Date | string
    targetDate: Date | string
    actualObservedAt?: Date | string | null
    originValue: Decimal | DecimalJsLike | number | string
    forecastValue: Decimal | DecimalJsLike | number | string
    actualValue: Decimal | DecimalJsLike | number | string
    errorValue: Decimal | DecimalJsLike | number | string
    absoluteErrorValue: Decimal | DecimalJsLike | number | string
    deltaValue: Decimal | DecimalJsLike | number | string
    deltaPct?: number | null
    maseScale: Decimal | DecimalJsLike | number | string
    selectedVariant?: string | null
    selectionMetric?: string | null
    selectionScore?: number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ForecastVerificationPointCreateOrConnectWithoutRunInput = {
    where: ForecastVerificationPointWhereUniqueInput
    create: XOR<ForecastVerificationPointCreateWithoutRunInput, ForecastVerificationPointUncheckedCreateWithoutRunInput>
  }

  export type ForecastVerificationPointCreateManyRunInputEnvelope = {
    data: ForecastVerificationPointCreateManyRunInput | ForecastVerificationPointCreateManyRunInput[]
    skipDuplicates?: boolean
  }

  export type ForecastVerificationMetricUpsertWithWhereUniqueWithoutRunInput = {
    where: ForecastVerificationMetricWhereUniqueInput
    update: XOR<ForecastVerificationMetricUpdateWithoutRunInput, ForecastVerificationMetricUncheckedUpdateWithoutRunInput>
    create: XOR<ForecastVerificationMetricCreateWithoutRunInput, ForecastVerificationMetricUncheckedCreateWithoutRunInput>
  }

  export type ForecastVerificationMetricUpdateWithWhereUniqueWithoutRunInput = {
    where: ForecastVerificationMetricWhereUniqueInput
    data: XOR<ForecastVerificationMetricUpdateWithoutRunInput, ForecastVerificationMetricUncheckedUpdateWithoutRunInput>
  }

  export type ForecastVerificationMetricUpdateManyWithWhereWithoutRunInput = {
    where: ForecastVerificationMetricScalarWhereInput
    data: XOR<ForecastVerificationMetricUpdateManyMutationInput, ForecastVerificationMetricUncheckedUpdateManyWithoutRunInput>
  }

  export type ForecastVerificationMetricScalarWhereInput = {
    AND?: ForecastVerificationMetricScalarWhereInput | ForecastVerificationMetricScalarWhereInput[]
    OR?: ForecastVerificationMetricScalarWhereInput[]
    NOT?: ForecastVerificationMetricScalarWhereInput | ForecastVerificationMetricScalarWhereInput[]
    id?: StringFilter<"ForecastVerificationMetric"> | string
    runId?: StringFilter<"ForecastVerificationMetric"> | string
    horizonLabel?: StringFilter<"ForecastVerificationMetric"> | string
    horizonSteps?: IntFilter<"ForecastVerificationMetric"> | number
    origins?: IntFilter<"ForecastVerificationMetric"> | number
    expectedOrigins?: IntFilter<"ForecastVerificationMetric"> | number
    failedOrigins?: IntFilter<"ForecastVerificationMetric"> | number
    coverage?: FloatFilter<"ForecastVerificationMetric"> | number
    mae?: FloatNullableFilter<"ForecastVerificationMetric"> | number | null
    rmse?: FloatNullableFilter<"ForecastVerificationMetric"> | number | null
    mase?: FloatNullableFilter<"ForecastVerificationMetric"> | number | null
    smape?: FloatNullableFilter<"ForecastVerificationMetric"> | number | null
    directionalAccuracy?: FloatNullableFilter<"ForecastVerificationMetric"> | number | null
    bias?: FloatNullableFilter<"ForecastVerificationMetric"> | number | null
    failureSummaryJson?: JsonNullableFilter<"ForecastVerificationMetric">
    createdAt?: DateTimeFilter<"ForecastVerificationMetric"> | Date | string
    updatedAt?: DateTimeFilter<"ForecastVerificationMetric"> | Date | string
  }

  export type ForecastVerificationPointUpsertWithWhereUniqueWithoutRunInput = {
    where: ForecastVerificationPointWhereUniqueInput
    update: XOR<ForecastVerificationPointUpdateWithoutRunInput, ForecastVerificationPointUncheckedUpdateWithoutRunInput>
    create: XOR<ForecastVerificationPointCreateWithoutRunInput, ForecastVerificationPointUncheckedCreateWithoutRunInput>
  }

  export type ForecastVerificationPointUpdateWithWhereUniqueWithoutRunInput = {
    where: ForecastVerificationPointWhereUniqueInput
    data: XOR<ForecastVerificationPointUpdateWithoutRunInput, ForecastVerificationPointUncheckedUpdateWithoutRunInput>
  }

  export type ForecastVerificationPointUpdateManyWithWhereWithoutRunInput = {
    where: ForecastVerificationPointScalarWhereInput
    data: XOR<ForecastVerificationPointUpdateManyMutationInput, ForecastVerificationPointUncheckedUpdateManyWithoutRunInput>
  }

  export type ForecastVerificationPointScalarWhereInput = {
    AND?: ForecastVerificationPointScalarWhereInput | ForecastVerificationPointScalarWhereInput[]
    OR?: ForecastVerificationPointScalarWhereInput[]
    NOT?: ForecastVerificationPointScalarWhereInput | ForecastVerificationPointScalarWhereInput[]
    id?: StringFilter<"ForecastVerificationPoint"> | string
    runId?: StringFilter<"ForecastVerificationPoint"> | string
    horizonLabel?: StringFilter<"ForecastVerificationPoint"> | string
    horizonSteps?: IntFilter<"ForecastVerificationPoint"> | number
    forecastOriginAt?: DateTimeFilter<"ForecastVerificationPoint"> | Date | string
    targetDate?: DateTimeFilter<"ForecastVerificationPoint"> | Date | string
    actualObservedAt?: DateTimeNullableFilter<"ForecastVerificationPoint"> | Date | string | null
    originValue?: DecimalFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    forecastValue?: DecimalFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    actualValue?: DecimalFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    errorValue?: DecimalFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    absoluteErrorValue?: DecimalFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    deltaValue?: DecimalFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    deltaPct?: FloatNullableFilter<"ForecastVerificationPoint"> | number | null
    maseScale?: DecimalFilter<"ForecastVerificationPoint"> | Decimal | DecimalJsLike | number | string
    selectedVariant?: StringNullableFilter<"ForecastVerificationPoint"> | string | null
    selectionMetric?: StringNullableFilter<"ForecastVerificationPoint"> | string | null
    selectionScore?: FloatNullableFilter<"ForecastVerificationPoint"> | number | null
    metadataJson?: JsonNullableFilter<"ForecastVerificationPoint">
    createdAt?: DateTimeFilter<"ForecastVerificationPoint"> | Date | string
    updatedAt?: DateTimeFilter<"ForecastVerificationPoint"> | Date | string
  }

  export type ForecastVerificationRunCreateWithoutMetricsInput = {
    id?: string
    seriesId: string
    displayName: string
    description?: string | null
    frequency?: string | null
    currency?: string | null
    unit?: string | null
    sourceLabel?: string | null
    inputSource: string
    inputRunId?: string | null
    historyFingerprint: string
    targetBasis?: $Enums.ForecastTargetBasis
    methodId: string
    historyStartAt?: Date | string | null
    historyEndAt?: Date | string | null
    observationCount: number
    forecastOriginAt?: Date | string | null
    modelId: string
    methodVersion: string
    status: string
    failureReason?: string | null
    runtimeSeconds?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    points?: ForecastVerificationPointCreateNestedManyWithoutRunInput
  }

  export type ForecastVerificationRunUncheckedCreateWithoutMetricsInput = {
    id?: string
    seriesId: string
    displayName: string
    description?: string | null
    frequency?: string | null
    currency?: string | null
    unit?: string | null
    sourceLabel?: string | null
    inputSource: string
    inputRunId?: string | null
    historyFingerprint: string
    targetBasis?: $Enums.ForecastTargetBasis
    methodId: string
    historyStartAt?: Date | string | null
    historyEndAt?: Date | string | null
    observationCount: number
    forecastOriginAt?: Date | string | null
    modelId: string
    methodVersion: string
    status: string
    failureReason?: string | null
    runtimeSeconds?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    points?: ForecastVerificationPointUncheckedCreateNestedManyWithoutRunInput
  }

  export type ForecastVerificationRunCreateOrConnectWithoutMetricsInput = {
    where: ForecastVerificationRunWhereUniqueInput
    create: XOR<ForecastVerificationRunCreateWithoutMetricsInput, ForecastVerificationRunUncheckedCreateWithoutMetricsInput>
  }

  export type ForecastVerificationRunUpsertWithoutMetricsInput = {
    update: XOR<ForecastVerificationRunUpdateWithoutMetricsInput, ForecastVerificationRunUncheckedUpdateWithoutMetricsInput>
    create: XOR<ForecastVerificationRunCreateWithoutMetricsInput, ForecastVerificationRunUncheckedCreateWithoutMetricsInput>
    where?: ForecastVerificationRunWhereInput
  }

  export type ForecastVerificationRunUpdateToOneWithWhereWithoutMetricsInput = {
    where?: ForecastVerificationRunWhereInput
    data: XOR<ForecastVerificationRunUpdateWithoutMetricsInput, ForecastVerificationRunUncheckedUpdateWithoutMetricsInput>
  }

  export type ForecastVerificationRunUpdateWithoutMetricsInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    frequency?: NullableStringFieldUpdateOperationsInput | string | null
    currency?: NullableStringFieldUpdateOperationsInput | string | null
    unit?: NullableStringFieldUpdateOperationsInput | string | null
    sourceLabel?: NullableStringFieldUpdateOperationsInput | string | null
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    historyFingerprint?: StringFieldUpdateOperationsInput | string
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    historyStartAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    historyEndAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    observationCount?: IntFieldUpdateOperationsInput | number
    forecastOriginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    modelId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    failureReason?: NullableStringFieldUpdateOperationsInput | string | null
    runtimeSeconds?: NullableFloatFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    points?: ForecastVerificationPointUpdateManyWithoutRunNestedInput
  }

  export type ForecastVerificationRunUncheckedUpdateWithoutMetricsInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    frequency?: NullableStringFieldUpdateOperationsInput | string | null
    currency?: NullableStringFieldUpdateOperationsInput | string | null
    unit?: NullableStringFieldUpdateOperationsInput | string | null
    sourceLabel?: NullableStringFieldUpdateOperationsInput | string | null
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    historyFingerprint?: StringFieldUpdateOperationsInput | string
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    historyStartAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    historyEndAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    observationCount?: IntFieldUpdateOperationsInput | number
    forecastOriginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    modelId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    failureReason?: NullableStringFieldUpdateOperationsInput | string | null
    runtimeSeconds?: NullableFloatFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    points?: ForecastVerificationPointUncheckedUpdateManyWithoutRunNestedInput
  }

  export type ForecastVerificationRunCreateWithoutPointsInput = {
    id?: string
    seriesId: string
    displayName: string
    description?: string | null
    frequency?: string | null
    currency?: string | null
    unit?: string | null
    sourceLabel?: string | null
    inputSource: string
    inputRunId?: string | null
    historyFingerprint: string
    targetBasis?: $Enums.ForecastTargetBasis
    methodId: string
    historyStartAt?: Date | string | null
    historyEndAt?: Date | string | null
    observationCount: number
    forecastOriginAt?: Date | string | null
    modelId: string
    methodVersion: string
    status: string
    failureReason?: string | null
    runtimeSeconds?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    metrics?: ForecastVerificationMetricCreateNestedManyWithoutRunInput
  }

  export type ForecastVerificationRunUncheckedCreateWithoutPointsInput = {
    id?: string
    seriesId: string
    displayName: string
    description?: string | null
    frequency?: string | null
    currency?: string | null
    unit?: string | null
    sourceLabel?: string | null
    inputSource: string
    inputRunId?: string | null
    historyFingerprint: string
    targetBasis?: $Enums.ForecastTargetBasis
    methodId: string
    historyStartAt?: Date | string | null
    historyEndAt?: Date | string | null
    observationCount: number
    forecastOriginAt?: Date | string | null
    modelId: string
    methodVersion: string
    status: string
    failureReason?: string | null
    runtimeSeconds?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    metrics?: ForecastVerificationMetricUncheckedCreateNestedManyWithoutRunInput
  }

  export type ForecastVerificationRunCreateOrConnectWithoutPointsInput = {
    where: ForecastVerificationRunWhereUniqueInput
    create: XOR<ForecastVerificationRunCreateWithoutPointsInput, ForecastVerificationRunUncheckedCreateWithoutPointsInput>
  }

  export type ForecastVerificationRunUpsertWithoutPointsInput = {
    update: XOR<ForecastVerificationRunUpdateWithoutPointsInput, ForecastVerificationRunUncheckedUpdateWithoutPointsInput>
    create: XOR<ForecastVerificationRunCreateWithoutPointsInput, ForecastVerificationRunUncheckedCreateWithoutPointsInput>
    where?: ForecastVerificationRunWhereInput
  }

  export type ForecastVerificationRunUpdateToOneWithWhereWithoutPointsInput = {
    where?: ForecastVerificationRunWhereInput
    data: XOR<ForecastVerificationRunUpdateWithoutPointsInput, ForecastVerificationRunUncheckedUpdateWithoutPointsInput>
  }

  export type ForecastVerificationRunUpdateWithoutPointsInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    frequency?: NullableStringFieldUpdateOperationsInput | string | null
    currency?: NullableStringFieldUpdateOperationsInput | string | null
    unit?: NullableStringFieldUpdateOperationsInput | string | null
    sourceLabel?: NullableStringFieldUpdateOperationsInput | string | null
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    historyFingerprint?: StringFieldUpdateOperationsInput | string
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    historyStartAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    historyEndAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    observationCount?: IntFieldUpdateOperationsInput | number
    forecastOriginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    modelId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    failureReason?: NullableStringFieldUpdateOperationsInput | string | null
    runtimeSeconds?: NullableFloatFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metrics?: ForecastVerificationMetricUpdateManyWithoutRunNestedInput
  }

  export type ForecastVerificationRunUncheckedUpdateWithoutPointsInput = {
    id?: StringFieldUpdateOperationsInput | string
    seriesId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    frequency?: NullableStringFieldUpdateOperationsInput | string | null
    currency?: NullableStringFieldUpdateOperationsInput | string | null
    unit?: NullableStringFieldUpdateOperationsInput | string | null
    sourceLabel?: NullableStringFieldUpdateOperationsInput | string | null
    inputSource?: StringFieldUpdateOperationsInput | string
    inputRunId?: NullableStringFieldUpdateOperationsInput | string | null
    historyFingerprint?: StringFieldUpdateOperationsInput | string
    targetBasis?: EnumForecastTargetBasisFieldUpdateOperationsInput | $Enums.ForecastTargetBasis
    methodId?: StringFieldUpdateOperationsInput | string
    historyStartAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    historyEndAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    observationCount?: IntFieldUpdateOperationsInput | number
    forecastOriginAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    modelId?: StringFieldUpdateOperationsInput | string
    methodVersion?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    failureReason?: NullableStringFieldUpdateOperationsInput | string | null
    runtimeSeconds?: NullableFloatFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    metrics?: ForecastVerificationMetricUncheckedUpdateManyWithoutRunNestedInput
  }

  export type ForecastCurrentPointCreateManyRunInput = {
    id?: string
    horizonLabel: string
    horizonSteps: number
    forecastDate: Date | string
    forecastValue?: Decimal | DecimalJsLike | number | string | null
    fitStatus?: string | null
    failureReason?: string | null
    selectedVariant?: string | null
    selectionMetric?: string | null
    selectionScore?: number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ForecastCurrentPointUpdateWithoutRunInput = {
    id?: StringFieldUpdateOperationsInput | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonSteps?: IntFieldUpdateOperationsInput | number
    forecastDate?: DateTimeFieldUpdateOperationsInput | Date | string
    forecastValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    fitStatus?: NullableStringFieldUpdateOperationsInput | string | null
    failureReason?: NullableStringFieldUpdateOperationsInput | string | null
    selectedVariant?: NullableStringFieldUpdateOperationsInput | string | null
    selectionMetric?: NullableStringFieldUpdateOperationsInput | string | null
    selectionScore?: NullableFloatFieldUpdateOperationsInput | number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ForecastCurrentPointUncheckedUpdateWithoutRunInput = {
    id?: StringFieldUpdateOperationsInput | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonSteps?: IntFieldUpdateOperationsInput | number
    forecastDate?: DateTimeFieldUpdateOperationsInput | Date | string
    forecastValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    fitStatus?: NullableStringFieldUpdateOperationsInput | string | null
    failureReason?: NullableStringFieldUpdateOperationsInput | string | null
    selectedVariant?: NullableStringFieldUpdateOperationsInput | string | null
    selectionMetric?: NullableStringFieldUpdateOperationsInput | string | null
    selectionScore?: NullableFloatFieldUpdateOperationsInput | number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ForecastCurrentPointUncheckedUpdateManyWithoutRunInput = {
    id?: StringFieldUpdateOperationsInput | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonSteps?: IntFieldUpdateOperationsInput | number
    forecastDate?: DateTimeFieldUpdateOperationsInput | Date | string
    forecastValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    fitStatus?: NullableStringFieldUpdateOperationsInput | string | null
    failureReason?: NullableStringFieldUpdateOperationsInput | string | null
    selectedVariant?: NullableStringFieldUpdateOperationsInput | string | null
    selectionMetric?: NullableStringFieldUpdateOperationsInput | string | null
    selectionScore?: NullableFloatFieldUpdateOperationsInput | number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ForecastVerificationMetricCreateManyRunInput = {
    id?: string
    horizonLabel: string
    horizonSteps: number
    origins: number
    expectedOrigins: number
    failedOrigins: number
    coverage: number
    mae?: number | null
    rmse?: number | null
    mase?: number | null
    smape?: number | null
    directionalAccuracy?: number | null
    bias?: number | null
    failureSummaryJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ForecastVerificationPointCreateManyRunInput = {
    id?: string
    horizonLabel: string
    horizonSteps: number
    forecastOriginAt: Date | string
    targetDate: Date | string
    actualObservedAt?: Date | string | null
    originValue: Decimal | DecimalJsLike | number | string
    forecastValue: Decimal | DecimalJsLike | number | string
    actualValue: Decimal | DecimalJsLike | number | string
    errorValue: Decimal | DecimalJsLike | number | string
    absoluteErrorValue: Decimal | DecimalJsLike | number | string
    deltaValue: Decimal | DecimalJsLike | number | string
    deltaPct?: number | null
    maseScale: Decimal | DecimalJsLike | number | string
    selectedVariant?: string | null
    selectionMetric?: string | null
    selectionScore?: number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ForecastVerificationMetricUpdateWithoutRunInput = {
    id?: StringFieldUpdateOperationsInput | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonSteps?: IntFieldUpdateOperationsInput | number
    origins?: IntFieldUpdateOperationsInput | number
    expectedOrigins?: IntFieldUpdateOperationsInput | number
    failedOrigins?: IntFieldUpdateOperationsInput | number
    coverage?: FloatFieldUpdateOperationsInput | number
    mae?: NullableFloatFieldUpdateOperationsInput | number | null
    rmse?: NullableFloatFieldUpdateOperationsInput | number | null
    mase?: NullableFloatFieldUpdateOperationsInput | number | null
    smape?: NullableFloatFieldUpdateOperationsInput | number | null
    directionalAccuracy?: NullableFloatFieldUpdateOperationsInput | number | null
    bias?: NullableFloatFieldUpdateOperationsInput | number | null
    failureSummaryJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ForecastVerificationMetricUncheckedUpdateWithoutRunInput = {
    id?: StringFieldUpdateOperationsInput | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonSteps?: IntFieldUpdateOperationsInput | number
    origins?: IntFieldUpdateOperationsInput | number
    expectedOrigins?: IntFieldUpdateOperationsInput | number
    failedOrigins?: IntFieldUpdateOperationsInput | number
    coverage?: FloatFieldUpdateOperationsInput | number
    mae?: NullableFloatFieldUpdateOperationsInput | number | null
    rmse?: NullableFloatFieldUpdateOperationsInput | number | null
    mase?: NullableFloatFieldUpdateOperationsInput | number | null
    smape?: NullableFloatFieldUpdateOperationsInput | number | null
    directionalAccuracy?: NullableFloatFieldUpdateOperationsInput | number | null
    bias?: NullableFloatFieldUpdateOperationsInput | number | null
    failureSummaryJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ForecastVerificationMetricUncheckedUpdateManyWithoutRunInput = {
    id?: StringFieldUpdateOperationsInput | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonSteps?: IntFieldUpdateOperationsInput | number
    origins?: IntFieldUpdateOperationsInput | number
    expectedOrigins?: IntFieldUpdateOperationsInput | number
    failedOrigins?: IntFieldUpdateOperationsInput | number
    coverage?: FloatFieldUpdateOperationsInput | number
    mae?: NullableFloatFieldUpdateOperationsInput | number | null
    rmse?: NullableFloatFieldUpdateOperationsInput | number | null
    mase?: NullableFloatFieldUpdateOperationsInput | number | null
    smape?: NullableFloatFieldUpdateOperationsInput | number | null
    directionalAccuracy?: NullableFloatFieldUpdateOperationsInput | number | null
    bias?: NullableFloatFieldUpdateOperationsInput | number | null
    failureSummaryJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ForecastVerificationPointUpdateWithoutRunInput = {
    id?: StringFieldUpdateOperationsInput | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonSteps?: IntFieldUpdateOperationsInput | number
    forecastOriginAt?: DateTimeFieldUpdateOperationsInput | Date | string
    targetDate?: DateTimeFieldUpdateOperationsInput | Date | string
    actualObservedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    originValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    forecastValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    actualValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    errorValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    absoluteErrorValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    deltaValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    deltaPct?: NullableFloatFieldUpdateOperationsInput | number | null
    maseScale?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    selectedVariant?: NullableStringFieldUpdateOperationsInput | string | null
    selectionMetric?: NullableStringFieldUpdateOperationsInput | string | null
    selectionScore?: NullableFloatFieldUpdateOperationsInput | number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ForecastVerificationPointUncheckedUpdateWithoutRunInput = {
    id?: StringFieldUpdateOperationsInput | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonSteps?: IntFieldUpdateOperationsInput | number
    forecastOriginAt?: DateTimeFieldUpdateOperationsInput | Date | string
    targetDate?: DateTimeFieldUpdateOperationsInput | Date | string
    actualObservedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    originValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    forecastValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    actualValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    errorValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    absoluteErrorValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    deltaValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    deltaPct?: NullableFloatFieldUpdateOperationsInput | number | null
    maseScale?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    selectedVariant?: NullableStringFieldUpdateOperationsInput | string | null
    selectionMetric?: NullableStringFieldUpdateOperationsInput | string | null
    selectionScore?: NullableFloatFieldUpdateOperationsInput | number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ForecastVerificationPointUncheckedUpdateManyWithoutRunInput = {
    id?: StringFieldUpdateOperationsInput | string
    horizonLabel?: StringFieldUpdateOperationsInput | string
    horizonSteps?: IntFieldUpdateOperationsInput | number
    forecastOriginAt?: DateTimeFieldUpdateOperationsInput | Date | string
    targetDate?: DateTimeFieldUpdateOperationsInput | Date | string
    actualObservedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    originValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    forecastValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    actualValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    errorValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    absoluteErrorValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    deltaValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    deltaPct?: NullableFloatFieldUpdateOperationsInput | number | null
    maseScale?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    selectedVariant?: NullableStringFieldUpdateOperationsInput | string | null
    selectionMetric?: NullableStringFieldUpdateOperationsInput | string | null
    selectionScore?: NullableFloatFieldUpdateOperationsInput | number | null
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}
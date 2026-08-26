
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
 * Model DrDashboardIndexRecord
 * 
 */
export type DrDashboardIndexRecord = $Result.DefaultSelection<Prisma.$DrDashboardIndexRecordPayload>
/**
 * Model DrForecastAccuracyRecord
 * 
 */
export type DrForecastAccuracyRecord = $Result.DefaultSelection<Prisma.$DrForecastAccuracyRecordPayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient({
 *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
 * })
 * // Fetch zero or more DrDashboardIndexRecords
 * const drDashboardIndexRecords = await prisma.drDashboardIndexRecord.findMany()
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
   * // Fetch zero or more DrDashboardIndexRecords
   * const drDashboardIndexRecords = await prisma.drDashboardIndexRecord.findMany()
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
   * `prisma.drDashboardIndexRecord`: Exposes CRUD operations for the **DrDashboardIndexRecord** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more DrDashboardIndexRecords
    * const drDashboardIndexRecords = await prisma.drDashboardIndexRecord.findMany()
    * ```
    */
  get drDashboardIndexRecord(): Prisma.DrDashboardIndexRecordDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.drForecastAccuracyRecord`: Exposes CRUD operations for the **DrForecastAccuracyRecord** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more DrForecastAccuracyRecords
    * const drForecastAccuracyRecords = await prisma.drForecastAccuracyRecord.findMany()
    * ```
    */
  get drForecastAccuracyRecord(): Prisma.DrForecastAccuracyRecordDelegate<ExtArgs, ClientOptions>;
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
    DrDashboardIndexRecord: 'DrDashboardIndexRecord',
    DrForecastAccuracyRecord: 'DrForecastAccuracyRecord'
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
      modelProps: "drDashboardIndexRecord" | "drForecastAccuracyRecord"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      DrDashboardIndexRecord: {
        payload: Prisma.$DrDashboardIndexRecordPayload<ExtArgs>
        fields: Prisma.DrDashboardIndexRecordFieldRefs
        operations: {
          findUnique: {
            args: Prisma.DrDashboardIndexRecordFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DrDashboardIndexRecordPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.DrDashboardIndexRecordFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DrDashboardIndexRecordPayload>
          }
          findFirst: {
            args: Prisma.DrDashboardIndexRecordFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DrDashboardIndexRecordPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.DrDashboardIndexRecordFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DrDashboardIndexRecordPayload>
          }
          findMany: {
            args: Prisma.DrDashboardIndexRecordFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DrDashboardIndexRecordPayload>[]
          }
          create: {
            args: Prisma.DrDashboardIndexRecordCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DrDashboardIndexRecordPayload>
          }
          createMany: {
            args: Prisma.DrDashboardIndexRecordCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.DrDashboardIndexRecordCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DrDashboardIndexRecordPayload>[]
          }
          delete: {
            args: Prisma.DrDashboardIndexRecordDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DrDashboardIndexRecordPayload>
          }
          update: {
            args: Prisma.DrDashboardIndexRecordUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DrDashboardIndexRecordPayload>
          }
          deleteMany: {
            args: Prisma.DrDashboardIndexRecordDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.DrDashboardIndexRecordUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.DrDashboardIndexRecordUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DrDashboardIndexRecordPayload>[]
          }
          upsert: {
            args: Prisma.DrDashboardIndexRecordUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DrDashboardIndexRecordPayload>
          }
          aggregate: {
            args: Prisma.DrDashboardIndexRecordAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateDrDashboardIndexRecord>
          }
          groupBy: {
            args: Prisma.DrDashboardIndexRecordGroupByArgs<ExtArgs>
            result: $Utils.Optional<DrDashboardIndexRecordGroupByOutputType>[]
          }
          count: {
            args: Prisma.DrDashboardIndexRecordCountArgs<ExtArgs>
            result: $Utils.Optional<DrDashboardIndexRecordCountAggregateOutputType> | number
          }
        }
      }
      DrForecastAccuracyRecord: {
        payload: Prisma.$DrForecastAccuracyRecordPayload<ExtArgs>
        fields: Prisma.DrForecastAccuracyRecordFieldRefs
        operations: {
          findUnique: {
            args: Prisma.DrForecastAccuracyRecordFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DrForecastAccuracyRecordPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.DrForecastAccuracyRecordFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DrForecastAccuracyRecordPayload>
          }
          findFirst: {
            args: Prisma.DrForecastAccuracyRecordFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DrForecastAccuracyRecordPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.DrForecastAccuracyRecordFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DrForecastAccuracyRecordPayload>
          }
          findMany: {
            args: Prisma.DrForecastAccuracyRecordFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DrForecastAccuracyRecordPayload>[]
          }
          create: {
            args: Prisma.DrForecastAccuracyRecordCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DrForecastAccuracyRecordPayload>
          }
          createMany: {
            args: Prisma.DrForecastAccuracyRecordCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.DrForecastAccuracyRecordCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DrForecastAccuracyRecordPayload>[]
          }
          delete: {
            args: Prisma.DrForecastAccuracyRecordDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DrForecastAccuracyRecordPayload>
          }
          update: {
            args: Prisma.DrForecastAccuracyRecordUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DrForecastAccuracyRecordPayload>
          }
          deleteMany: {
            args: Prisma.DrForecastAccuracyRecordDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.DrForecastAccuracyRecordUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.DrForecastAccuracyRecordUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DrForecastAccuracyRecordPayload>[]
          }
          upsert: {
            args: Prisma.DrForecastAccuracyRecordUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DrForecastAccuracyRecordPayload>
          }
          aggregate: {
            args: Prisma.DrForecastAccuracyRecordAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateDrForecastAccuracyRecord>
          }
          groupBy: {
            args: Prisma.DrForecastAccuracyRecordGroupByArgs<ExtArgs>
            result: $Utils.Optional<DrForecastAccuracyRecordGroupByOutputType>[]
          }
          count: {
            args: Prisma.DrForecastAccuracyRecordCountArgs<ExtArgs>
            result: $Utils.Optional<DrForecastAccuracyRecordCountAggregateOutputType> | number
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
    drDashboardIndexRecord?: DrDashboardIndexRecordOmit
    drForecastAccuracyRecord?: DrForecastAccuracyRecordOmit
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
   * Models
   */

  /**
   * Model DrDashboardIndexRecord
   */

  export type AggregateDrDashboardIndexRecord = {
    _count: DrDashboardIndexRecordCountAggregateOutputType | null
    _avg: DrDashboardIndexRecordAvgAggregateOutputType | null
    _sum: DrDashboardIndexRecordSumAggregateOutputType | null
    _min: DrDashboardIndexRecordMinAggregateOutputType | null
    _max: DrDashboardIndexRecordMaxAggregateOutputType | null
  }

  export type DrDashboardIndexRecordAvgAggregateOutputType = {
    metricValue: Decimal | null
    rawRecordCount: number | null
    duplicateCount: number | null
  }

  export type DrDashboardIndexRecordSumAggregateOutputType = {
    metricValue: Decimal | null
    rawRecordCount: number | null
    duplicateCount: number | null
  }

  export type DrDashboardIndexRecordMinAggregateOutputType = {
    id: string | null
    organizationId: string | null
    sourceId: string | null
    datasetId: string | null
    pipelineId: string | null
    latestRunId: string | null
    dedupeKey: string | null
    scenarioType: string | null
    componentId: string | null
    componentName: string | null
    componentCode: string | null
    metricValue: Decimal | null
    unit: string | null
    currency: string | null
    sourceDate: Date | null
    market: string | null
    country: string | null
    qualityStatus: string | null
    duplicateStatus: string | null
    rawRecordCount: number | null
    duplicateCount: number | null
    lastSyncedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
    deletedAt: Date | null
  }

  export type DrDashboardIndexRecordMaxAggregateOutputType = {
    id: string | null
    organizationId: string | null
    sourceId: string | null
    datasetId: string | null
    pipelineId: string | null
    latestRunId: string | null
    dedupeKey: string | null
    scenarioType: string | null
    componentId: string | null
    componentName: string | null
    componentCode: string | null
    metricValue: Decimal | null
    unit: string | null
    currency: string | null
    sourceDate: Date | null
    market: string | null
    country: string | null
    qualityStatus: string | null
    duplicateStatus: string | null
    rawRecordCount: number | null
    duplicateCount: number | null
    lastSyncedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
    deletedAt: Date | null
  }

  export type DrDashboardIndexRecordCountAggregateOutputType = {
    id: number
    organizationId: number
    sourceId: number
    datasetId: number
    pipelineId: number
    latestRunId: number
    dedupeKey: number
    scenarioType: number
    componentId: number
    componentName: number
    componentCode: number
    metricValue: number
    unit: number
    currency: number
    sourceDate: number
    market: number
    country: number
    qualityStatus: number
    duplicateStatus: number
    rawRecordCount: number
    duplicateCount: number
    lineageJson: number
    metadataJson: number
    lastSyncedAt: number
    createdAt: number
    updatedAt: number
    deletedAt: number
    _all: number
  }


  export type DrDashboardIndexRecordAvgAggregateInputType = {
    metricValue?: true
    rawRecordCount?: true
    duplicateCount?: true
  }

  export type DrDashboardIndexRecordSumAggregateInputType = {
    metricValue?: true
    rawRecordCount?: true
    duplicateCount?: true
  }

  export type DrDashboardIndexRecordMinAggregateInputType = {
    id?: true
    organizationId?: true
    sourceId?: true
    datasetId?: true
    pipelineId?: true
    latestRunId?: true
    dedupeKey?: true
    scenarioType?: true
    componentId?: true
    componentName?: true
    componentCode?: true
    metricValue?: true
    unit?: true
    currency?: true
    sourceDate?: true
    market?: true
    country?: true
    qualityStatus?: true
    duplicateStatus?: true
    rawRecordCount?: true
    duplicateCount?: true
    lastSyncedAt?: true
    createdAt?: true
    updatedAt?: true
    deletedAt?: true
  }

  export type DrDashboardIndexRecordMaxAggregateInputType = {
    id?: true
    organizationId?: true
    sourceId?: true
    datasetId?: true
    pipelineId?: true
    latestRunId?: true
    dedupeKey?: true
    scenarioType?: true
    componentId?: true
    componentName?: true
    componentCode?: true
    metricValue?: true
    unit?: true
    currency?: true
    sourceDate?: true
    market?: true
    country?: true
    qualityStatus?: true
    duplicateStatus?: true
    rawRecordCount?: true
    duplicateCount?: true
    lastSyncedAt?: true
    createdAt?: true
    updatedAt?: true
    deletedAt?: true
  }

  export type DrDashboardIndexRecordCountAggregateInputType = {
    id?: true
    organizationId?: true
    sourceId?: true
    datasetId?: true
    pipelineId?: true
    latestRunId?: true
    dedupeKey?: true
    scenarioType?: true
    componentId?: true
    componentName?: true
    componentCode?: true
    metricValue?: true
    unit?: true
    currency?: true
    sourceDate?: true
    market?: true
    country?: true
    qualityStatus?: true
    duplicateStatus?: true
    rawRecordCount?: true
    duplicateCount?: true
    lineageJson?: true
    metadataJson?: true
    lastSyncedAt?: true
    createdAt?: true
    updatedAt?: true
    deletedAt?: true
    _all?: true
  }

  export type DrDashboardIndexRecordAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which DrDashboardIndexRecord to aggregate.
     */
    where?: DrDashboardIndexRecordWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DrDashboardIndexRecords to fetch.
     */
    orderBy?: DrDashboardIndexRecordOrderByWithRelationInput | DrDashboardIndexRecordOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: DrDashboardIndexRecordWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DrDashboardIndexRecords from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DrDashboardIndexRecords.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned DrDashboardIndexRecords
    **/
    _count?: true | DrDashboardIndexRecordCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: DrDashboardIndexRecordAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: DrDashboardIndexRecordSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: DrDashboardIndexRecordMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: DrDashboardIndexRecordMaxAggregateInputType
  }

  export type GetDrDashboardIndexRecordAggregateType<T extends DrDashboardIndexRecordAggregateArgs> = {
        [P in keyof T & keyof AggregateDrDashboardIndexRecord]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateDrDashboardIndexRecord[P]>
      : GetScalarType<T[P], AggregateDrDashboardIndexRecord[P]>
  }




  export type DrDashboardIndexRecordGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: DrDashboardIndexRecordWhereInput
    orderBy?: DrDashboardIndexRecordOrderByWithAggregationInput | DrDashboardIndexRecordOrderByWithAggregationInput[]
    by: DrDashboardIndexRecordScalarFieldEnum[] | DrDashboardIndexRecordScalarFieldEnum
    having?: DrDashboardIndexRecordScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: DrDashboardIndexRecordCountAggregateInputType | true
    _avg?: DrDashboardIndexRecordAvgAggregateInputType
    _sum?: DrDashboardIndexRecordSumAggregateInputType
    _min?: DrDashboardIndexRecordMinAggregateInputType
    _max?: DrDashboardIndexRecordMaxAggregateInputType
  }

  export type DrDashboardIndexRecordGroupByOutputType = {
    id: string
    organizationId: string
    sourceId: string
    datasetId: string
    pipelineId: string
    latestRunId: string
    dedupeKey: string
    scenarioType: string
    componentId: string
    componentName: string
    componentCode: string | null
    metricValue: Decimal | null
    unit: string | null
    currency: string | null
    sourceDate: Date | null
    market: string | null
    country: string | null
    qualityStatus: string | null
    duplicateStatus: string | null
    rawRecordCount: number
    duplicateCount: number
    lineageJson: JsonValue | null
    metadataJson: JsonValue | null
    lastSyncedAt: Date
    createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
    _count: DrDashboardIndexRecordCountAggregateOutputType | null
    _avg: DrDashboardIndexRecordAvgAggregateOutputType | null
    _sum: DrDashboardIndexRecordSumAggregateOutputType | null
    _min: DrDashboardIndexRecordMinAggregateOutputType | null
    _max: DrDashboardIndexRecordMaxAggregateOutputType | null
  }

  type GetDrDashboardIndexRecordGroupByPayload<T extends DrDashboardIndexRecordGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<DrDashboardIndexRecordGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof DrDashboardIndexRecordGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], DrDashboardIndexRecordGroupByOutputType[P]>
            : GetScalarType<T[P], DrDashboardIndexRecordGroupByOutputType[P]>
        }
      >
    >


  export type DrDashboardIndexRecordSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organizationId?: boolean
    sourceId?: boolean
    datasetId?: boolean
    pipelineId?: boolean
    latestRunId?: boolean
    dedupeKey?: boolean
    scenarioType?: boolean
    componentId?: boolean
    componentName?: boolean
    componentCode?: boolean
    metricValue?: boolean
    unit?: boolean
    currency?: boolean
    sourceDate?: boolean
    market?: boolean
    country?: boolean
    qualityStatus?: boolean
    duplicateStatus?: boolean
    rawRecordCount?: boolean
    duplicateCount?: boolean
    lineageJson?: boolean
    metadataJson?: boolean
    lastSyncedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    deletedAt?: boolean
  }, ExtArgs["result"]["drDashboardIndexRecord"]>

  export type DrDashboardIndexRecordSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organizationId?: boolean
    sourceId?: boolean
    datasetId?: boolean
    pipelineId?: boolean
    latestRunId?: boolean
    dedupeKey?: boolean
    scenarioType?: boolean
    componentId?: boolean
    componentName?: boolean
    componentCode?: boolean
    metricValue?: boolean
    unit?: boolean
    currency?: boolean
    sourceDate?: boolean
    market?: boolean
    country?: boolean
    qualityStatus?: boolean
    duplicateStatus?: boolean
    rawRecordCount?: boolean
    duplicateCount?: boolean
    lineageJson?: boolean
    metadataJson?: boolean
    lastSyncedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    deletedAt?: boolean
  }, ExtArgs["result"]["drDashboardIndexRecord"]>

  export type DrDashboardIndexRecordSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organizationId?: boolean
    sourceId?: boolean
    datasetId?: boolean
    pipelineId?: boolean
    latestRunId?: boolean
    dedupeKey?: boolean
    scenarioType?: boolean
    componentId?: boolean
    componentName?: boolean
    componentCode?: boolean
    metricValue?: boolean
    unit?: boolean
    currency?: boolean
    sourceDate?: boolean
    market?: boolean
    country?: boolean
    qualityStatus?: boolean
    duplicateStatus?: boolean
    rawRecordCount?: boolean
    duplicateCount?: boolean
    lineageJson?: boolean
    metadataJson?: boolean
    lastSyncedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    deletedAt?: boolean
  }, ExtArgs["result"]["drDashboardIndexRecord"]>

  export type DrDashboardIndexRecordSelectScalar = {
    id?: boolean
    organizationId?: boolean
    sourceId?: boolean
    datasetId?: boolean
    pipelineId?: boolean
    latestRunId?: boolean
    dedupeKey?: boolean
    scenarioType?: boolean
    componentId?: boolean
    componentName?: boolean
    componentCode?: boolean
    metricValue?: boolean
    unit?: boolean
    currency?: boolean
    sourceDate?: boolean
    market?: boolean
    country?: boolean
    qualityStatus?: boolean
    duplicateStatus?: boolean
    rawRecordCount?: boolean
    duplicateCount?: boolean
    lineageJson?: boolean
    metadataJson?: boolean
    lastSyncedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    deletedAt?: boolean
  }

  export type DrDashboardIndexRecordOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "organizationId" | "sourceId" | "datasetId" | "pipelineId" | "latestRunId" | "dedupeKey" | "scenarioType" | "componentId" | "componentName" | "componentCode" | "metricValue" | "unit" | "currency" | "sourceDate" | "market" | "country" | "qualityStatus" | "duplicateStatus" | "rawRecordCount" | "duplicateCount" | "lineageJson" | "metadataJson" | "lastSyncedAt" | "createdAt" | "updatedAt" | "deletedAt", ExtArgs["result"]["drDashboardIndexRecord"]>

  export type $DrDashboardIndexRecordPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "DrDashboardIndexRecord"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      organizationId: string
      sourceId: string
      datasetId: string
      pipelineId: string
      latestRunId: string
      dedupeKey: string
      scenarioType: string
      componentId: string
      componentName: string
      componentCode: string | null
      metricValue: Prisma.Decimal | null
      unit: string | null
      currency: string | null
      sourceDate: Date | null
      market: string | null
      country: string | null
      qualityStatus: string | null
      duplicateStatus: string | null
      rawRecordCount: number
      duplicateCount: number
      lineageJson: Prisma.JsonValue | null
      metadataJson: Prisma.JsonValue | null
      lastSyncedAt: Date
      createdAt: Date
      updatedAt: Date
      deletedAt: Date | null
    }, ExtArgs["result"]["drDashboardIndexRecord"]>
    composites: {}
  }

  type DrDashboardIndexRecordGetPayload<S extends boolean | null | undefined | DrDashboardIndexRecordDefaultArgs> = $Result.GetResult<Prisma.$DrDashboardIndexRecordPayload, S>

  type DrDashboardIndexRecordCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<DrDashboardIndexRecordFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: DrDashboardIndexRecordCountAggregateInputType | true
    }

  export interface DrDashboardIndexRecordDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['DrDashboardIndexRecord'], meta: { name: 'DrDashboardIndexRecord' } }
    /**
     * Find zero or one DrDashboardIndexRecord that matches the filter.
     * @param {DrDashboardIndexRecordFindUniqueArgs} args - Arguments to find a DrDashboardIndexRecord
     * @example
     * // Get one DrDashboardIndexRecord
     * const drDashboardIndexRecord = await prisma.drDashboardIndexRecord.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends DrDashboardIndexRecordFindUniqueArgs>(args: SelectSubset<T, DrDashboardIndexRecordFindUniqueArgs<ExtArgs>>): Prisma__DrDashboardIndexRecordClient<$Result.GetResult<Prisma.$DrDashboardIndexRecordPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one DrDashboardIndexRecord that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {DrDashboardIndexRecordFindUniqueOrThrowArgs} args - Arguments to find a DrDashboardIndexRecord
     * @example
     * // Get one DrDashboardIndexRecord
     * const drDashboardIndexRecord = await prisma.drDashboardIndexRecord.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends DrDashboardIndexRecordFindUniqueOrThrowArgs>(args: SelectSubset<T, DrDashboardIndexRecordFindUniqueOrThrowArgs<ExtArgs>>): Prisma__DrDashboardIndexRecordClient<$Result.GetResult<Prisma.$DrDashboardIndexRecordPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first DrDashboardIndexRecord that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DrDashboardIndexRecordFindFirstArgs} args - Arguments to find a DrDashboardIndexRecord
     * @example
     * // Get one DrDashboardIndexRecord
     * const drDashboardIndexRecord = await prisma.drDashboardIndexRecord.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends DrDashboardIndexRecordFindFirstArgs>(args?: SelectSubset<T, DrDashboardIndexRecordFindFirstArgs<ExtArgs>>): Prisma__DrDashboardIndexRecordClient<$Result.GetResult<Prisma.$DrDashboardIndexRecordPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first DrDashboardIndexRecord that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DrDashboardIndexRecordFindFirstOrThrowArgs} args - Arguments to find a DrDashboardIndexRecord
     * @example
     * // Get one DrDashboardIndexRecord
     * const drDashboardIndexRecord = await prisma.drDashboardIndexRecord.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends DrDashboardIndexRecordFindFirstOrThrowArgs>(args?: SelectSubset<T, DrDashboardIndexRecordFindFirstOrThrowArgs<ExtArgs>>): Prisma__DrDashboardIndexRecordClient<$Result.GetResult<Prisma.$DrDashboardIndexRecordPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more DrDashboardIndexRecords that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DrDashboardIndexRecordFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all DrDashboardIndexRecords
     * const drDashboardIndexRecords = await prisma.drDashboardIndexRecord.findMany()
     * 
     * // Get first 10 DrDashboardIndexRecords
     * const drDashboardIndexRecords = await prisma.drDashboardIndexRecord.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const drDashboardIndexRecordWithIdOnly = await prisma.drDashboardIndexRecord.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends DrDashboardIndexRecordFindManyArgs>(args?: SelectSubset<T, DrDashboardIndexRecordFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DrDashboardIndexRecordPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a DrDashboardIndexRecord.
     * @param {DrDashboardIndexRecordCreateArgs} args - Arguments to create a DrDashboardIndexRecord.
     * @example
     * // Create one DrDashboardIndexRecord
     * const DrDashboardIndexRecord = await prisma.drDashboardIndexRecord.create({
     *   data: {
     *     // ... data to create a DrDashboardIndexRecord
     *   }
     * })
     * 
     */
    create<T extends DrDashboardIndexRecordCreateArgs>(args: SelectSubset<T, DrDashboardIndexRecordCreateArgs<ExtArgs>>): Prisma__DrDashboardIndexRecordClient<$Result.GetResult<Prisma.$DrDashboardIndexRecordPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many DrDashboardIndexRecords.
     * @param {DrDashboardIndexRecordCreateManyArgs} args - Arguments to create many DrDashboardIndexRecords.
     * @example
     * // Create many DrDashboardIndexRecords
     * const drDashboardIndexRecord = await prisma.drDashboardIndexRecord.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends DrDashboardIndexRecordCreateManyArgs>(args?: SelectSubset<T, DrDashboardIndexRecordCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many DrDashboardIndexRecords and returns the data saved in the database.
     * @param {DrDashboardIndexRecordCreateManyAndReturnArgs} args - Arguments to create many DrDashboardIndexRecords.
     * @example
     * // Create many DrDashboardIndexRecords
     * const drDashboardIndexRecord = await prisma.drDashboardIndexRecord.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many DrDashboardIndexRecords and only return the `id`
     * const drDashboardIndexRecordWithIdOnly = await prisma.drDashboardIndexRecord.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends DrDashboardIndexRecordCreateManyAndReturnArgs>(args?: SelectSubset<T, DrDashboardIndexRecordCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DrDashboardIndexRecordPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a DrDashboardIndexRecord.
     * @param {DrDashboardIndexRecordDeleteArgs} args - Arguments to delete one DrDashboardIndexRecord.
     * @example
     * // Delete one DrDashboardIndexRecord
     * const DrDashboardIndexRecord = await prisma.drDashboardIndexRecord.delete({
     *   where: {
     *     // ... filter to delete one DrDashboardIndexRecord
     *   }
     * })
     * 
     */
    delete<T extends DrDashboardIndexRecordDeleteArgs>(args: SelectSubset<T, DrDashboardIndexRecordDeleteArgs<ExtArgs>>): Prisma__DrDashboardIndexRecordClient<$Result.GetResult<Prisma.$DrDashboardIndexRecordPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one DrDashboardIndexRecord.
     * @param {DrDashboardIndexRecordUpdateArgs} args - Arguments to update one DrDashboardIndexRecord.
     * @example
     * // Update one DrDashboardIndexRecord
     * const drDashboardIndexRecord = await prisma.drDashboardIndexRecord.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends DrDashboardIndexRecordUpdateArgs>(args: SelectSubset<T, DrDashboardIndexRecordUpdateArgs<ExtArgs>>): Prisma__DrDashboardIndexRecordClient<$Result.GetResult<Prisma.$DrDashboardIndexRecordPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more DrDashboardIndexRecords.
     * @param {DrDashboardIndexRecordDeleteManyArgs} args - Arguments to filter DrDashboardIndexRecords to delete.
     * @example
     * // Delete a few DrDashboardIndexRecords
     * const { count } = await prisma.drDashboardIndexRecord.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends DrDashboardIndexRecordDeleteManyArgs>(args?: SelectSubset<T, DrDashboardIndexRecordDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more DrDashboardIndexRecords.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DrDashboardIndexRecordUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many DrDashboardIndexRecords
     * const drDashboardIndexRecord = await prisma.drDashboardIndexRecord.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends DrDashboardIndexRecordUpdateManyArgs>(args: SelectSubset<T, DrDashboardIndexRecordUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more DrDashboardIndexRecords and returns the data updated in the database.
     * @param {DrDashboardIndexRecordUpdateManyAndReturnArgs} args - Arguments to update many DrDashboardIndexRecords.
     * @example
     * // Update many DrDashboardIndexRecords
     * const drDashboardIndexRecord = await prisma.drDashboardIndexRecord.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more DrDashboardIndexRecords and only return the `id`
     * const drDashboardIndexRecordWithIdOnly = await prisma.drDashboardIndexRecord.updateManyAndReturn({
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
    updateManyAndReturn<T extends DrDashboardIndexRecordUpdateManyAndReturnArgs>(args: SelectSubset<T, DrDashboardIndexRecordUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DrDashboardIndexRecordPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one DrDashboardIndexRecord.
     * @param {DrDashboardIndexRecordUpsertArgs} args - Arguments to update or create a DrDashboardIndexRecord.
     * @example
     * // Update or create a DrDashboardIndexRecord
     * const drDashboardIndexRecord = await prisma.drDashboardIndexRecord.upsert({
     *   create: {
     *     // ... data to create a DrDashboardIndexRecord
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the DrDashboardIndexRecord we want to update
     *   }
     * })
     */
    upsert<T extends DrDashboardIndexRecordUpsertArgs>(args: SelectSubset<T, DrDashboardIndexRecordUpsertArgs<ExtArgs>>): Prisma__DrDashboardIndexRecordClient<$Result.GetResult<Prisma.$DrDashboardIndexRecordPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of DrDashboardIndexRecords.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DrDashboardIndexRecordCountArgs} args - Arguments to filter DrDashboardIndexRecords to count.
     * @example
     * // Count the number of DrDashboardIndexRecords
     * const count = await prisma.drDashboardIndexRecord.count({
     *   where: {
     *     // ... the filter for the DrDashboardIndexRecords we want to count
     *   }
     * })
    **/
    count<T extends DrDashboardIndexRecordCountArgs>(
      args?: Subset<T, DrDashboardIndexRecordCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], DrDashboardIndexRecordCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a DrDashboardIndexRecord.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DrDashboardIndexRecordAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends DrDashboardIndexRecordAggregateArgs>(args: Subset<T, DrDashboardIndexRecordAggregateArgs>): Prisma.PrismaPromise<GetDrDashboardIndexRecordAggregateType<T>>

    /**
     * Group by DrDashboardIndexRecord.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DrDashboardIndexRecordGroupByArgs} args - Group by arguments.
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
      T extends DrDashboardIndexRecordGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: DrDashboardIndexRecordGroupByArgs['orderBy'] }
        : { orderBy?: DrDashboardIndexRecordGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, DrDashboardIndexRecordGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetDrDashboardIndexRecordGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the DrDashboardIndexRecord model
   */
  readonly fields: DrDashboardIndexRecordFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for DrDashboardIndexRecord.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__DrDashboardIndexRecordClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
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
   * Fields of the DrDashboardIndexRecord model
   */
  interface DrDashboardIndexRecordFieldRefs {
    readonly id: FieldRef<"DrDashboardIndexRecord", 'String'>
    readonly organizationId: FieldRef<"DrDashboardIndexRecord", 'String'>
    readonly sourceId: FieldRef<"DrDashboardIndexRecord", 'String'>
    readonly datasetId: FieldRef<"DrDashboardIndexRecord", 'String'>
    readonly pipelineId: FieldRef<"DrDashboardIndexRecord", 'String'>
    readonly latestRunId: FieldRef<"DrDashboardIndexRecord", 'String'>
    readonly dedupeKey: FieldRef<"DrDashboardIndexRecord", 'String'>
    readonly scenarioType: FieldRef<"DrDashboardIndexRecord", 'String'>
    readonly componentId: FieldRef<"DrDashboardIndexRecord", 'String'>
    readonly componentName: FieldRef<"DrDashboardIndexRecord", 'String'>
    readonly componentCode: FieldRef<"DrDashboardIndexRecord", 'String'>
    readonly metricValue: FieldRef<"DrDashboardIndexRecord", 'Decimal'>
    readonly unit: FieldRef<"DrDashboardIndexRecord", 'String'>
    readonly currency: FieldRef<"DrDashboardIndexRecord", 'String'>
    readonly sourceDate: FieldRef<"DrDashboardIndexRecord", 'DateTime'>
    readonly market: FieldRef<"DrDashboardIndexRecord", 'String'>
    readonly country: FieldRef<"DrDashboardIndexRecord", 'String'>
    readonly qualityStatus: FieldRef<"DrDashboardIndexRecord", 'String'>
    readonly duplicateStatus: FieldRef<"DrDashboardIndexRecord", 'String'>
    readonly rawRecordCount: FieldRef<"DrDashboardIndexRecord", 'Int'>
    readonly duplicateCount: FieldRef<"DrDashboardIndexRecord", 'Int'>
    readonly lineageJson: FieldRef<"DrDashboardIndexRecord", 'Json'>
    readonly metadataJson: FieldRef<"DrDashboardIndexRecord", 'Json'>
    readonly lastSyncedAt: FieldRef<"DrDashboardIndexRecord", 'DateTime'>
    readonly createdAt: FieldRef<"DrDashboardIndexRecord", 'DateTime'>
    readonly updatedAt: FieldRef<"DrDashboardIndexRecord", 'DateTime'>
    readonly deletedAt: FieldRef<"DrDashboardIndexRecord", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * DrDashboardIndexRecord findUnique
   */
  export type DrDashboardIndexRecordFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DrDashboardIndexRecord
     */
    select?: DrDashboardIndexRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DrDashboardIndexRecord
     */
    omit?: DrDashboardIndexRecordOmit<ExtArgs> | null
    /**
     * Filter, which DrDashboardIndexRecord to fetch.
     */
    where: DrDashboardIndexRecordWhereUniqueInput
  }

  /**
   * DrDashboardIndexRecord findUniqueOrThrow
   */
  export type DrDashboardIndexRecordFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DrDashboardIndexRecord
     */
    select?: DrDashboardIndexRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DrDashboardIndexRecord
     */
    omit?: DrDashboardIndexRecordOmit<ExtArgs> | null
    /**
     * Filter, which DrDashboardIndexRecord to fetch.
     */
    where: DrDashboardIndexRecordWhereUniqueInput
  }

  /**
   * DrDashboardIndexRecord findFirst
   */
  export type DrDashboardIndexRecordFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DrDashboardIndexRecord
     */
    select?: DrDashboardIndexRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DrDashboardIndexRecord
     */
    omit?: DrDashboardIndexRecordOmit<ExtArgs> | null
    /**
     * Filter, which DrDashboardIndexRecord to fetch.
     */
    where?: DrDashboardIndexRecordWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DrDashboardIndexRecords to fetch.
     */
    orderBy?: DrDashboardIndexRecordOrderByWithRelationInput | DrDashboardIndexRecordOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for DrDashboardIndexRecords.
     */
    cursor?: DrDashboardIndexRecordWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DrDashboardIndexRecords from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DrDashboardIndexRecords.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of DrDashboardIndexRecords.
     */
    distinct?: DrDashboardIndexRecordScalarFieldEnum | DrDashboardIndexRecordScalarFieldEnum[]
  }

  /**
   * DrDashboardIndexRecord findFirstOrThrow
   */
  export type DrDashboardIndexRecordFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DrDashboardIndexRecord
     */
    select?: DrDashboardIndexRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DrDashboardIndexRecord
     */
    omit?: DrDashboardIndexRecordOmit<ExtArgs> | null
    /**
     * Filter, which DrDashboardIndexRecord to fetch.
     */
    where?: DrDashboardIndexRecordWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DrDashboardIndexRecords to fetch.
     */
    orderBy?: DrDashboardIndexRecordOrderByWithRelationInput | DrDashboardIndexRecordOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for DrDashboardIndexRecords.
     */
    cursor?: DrDashboardIndexRecordWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DrDashboardIndexRecords from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DrDashboardIndexRecords.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of DrDashboardIndexRecords.
     */
    distinct?: DrDashboardIndexRecordScalarFieldEnum | DrDashboardIndexRecordScalarFieldEnum[]
  }

  /**
   * DrDashboardIndexRecord findMany
   */
  export type DrDashboardIndexRecordFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DrDashboardIndexRecord
     */
    select?: DrDashboardIndexRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DrDashboardIndexRecord
     */
    omit?: DrDashboardIndexRecordOmit<ExtArgs> | null
    /**
     * Filter, which DrDashboardIndexRecords to fetch.
     */
    where?: DrDashboardIndexRecordWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DrDashboardIndexRecords to fetch.
     */
    orderBy?: DrDashboardIndexRecordOrderByWithRelationInput | DrDashboardIndexRecordOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing DrDashboardIndexRecords.
     */
    cursor?: DrDashboardIndexRecordWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DrDashboardIndexRecords from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DrDashboardIndexRecords.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of DrDashboardIndexRecords.
     */
    distinct?: DrDashboardIndexRecordScalarFieldEnum | DrDashboardIndexRecordScalarFieldEnum[]
  }

  /**
   * DrDashboardIndexRecord create
   */
  export type DrDashboardIndexRecordCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DrDashboardIndexRecord
     */
    select?: DrDashboardIndexRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DrDashboardIndexRecord
     */
    omit?: DrDashboardIndexRecordOmit<ExtArgs> | null
    /**
     * The data needed to create a DrDashboardIndexRecord.
     */
    data: XOR<DrDashboardIndexRecordCreateInput, DrDashboardIndexRecordUncheckedCreateInput>
  }

  /**
   * DrDashboardIndexRecord createMany
   */
  export type DrDashboardIndexRecordCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many DrDashboardIndexRecords.
     */
    data: DrDashboardIndexRecordCreateManyInput | DrDashboardIndexRecordCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * DrDashboardIndexRecord createManyAndReturn
   */
  export type DrDashboardIndexRecordCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DrDashboardIndexRecord
     */
    select?: DrDashboardIndexRecordSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the DrDashboardIndexRecord
     */
    omit?: DrDashboardIndexRecordOmit<ExtArgs> | null
    /**
     * The data used to create many DrDashboardIndexRecords.
     */
    data: DrDashboardIndexRecordCreateManyInput | DrDashboardIndexRecordCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * DrDashboardIndexRecord update
   */
  export type DrDashboardIndexRecordUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DrDashboardIndexRecord
     */
    select?: DrDashboardIndexRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DrDashboardIndexRecord
     */
    omit?: DrDashboardIndexRecordOmit<ExtArgs> | null
    /**
     * The data needed to update a DrDashboardIndexRecord.
     */
    data: XOR<DrDashboardIndexRecordUpdateInput, DrDashboardIndexRecordUncheckedUpdateInput>
    /**
     * Choose, which DrDashboardIndexRecord to update.
     */
    where: DrDashboardIndexRecordWhereUniqueInput
  }

  /**
   * DrDashboardIndexRecord updateMany
   */
  export type DrDashboardIndexRecordUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update DrDashboardIndexRecords.
     */
    data: XOR<DrDashboardIndexRecordUpdateManyMutationInput, DrDashboardIndexRecordUncheckedUpdateManyInput>
    /**
     * Filter which DrDashboardIndexRecords to update
     */
    where?: DrDashboardIndexRecordWhereInput
    /**
     * Limit how many DrDashboardIndexRecords to update.
     */
    limit?: number
  }

  /**
   * DrDashboardIndexRecord updateManyAndReturn
   */
  export type DrDashboardIndexRecordUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DrDashboardIndexRecord
     */
    select?: DrDashboardIndexRecordSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the DrDashboardIndexRecord
     */
    omit?: DrDashboardIndexRecordOmit<ExtArgs> | null
    /**
     * The data used to update DrDashboardIndexRecords.
     */
    data: XOR<DrDashboardIndexRecordUpdateManyMutationInput, DrDashboardIndexRecordUncheckedUpdateManyInput>
    /**
     * Filter which DrDashboardIndexRecords to update
     */
    where?: DrDashboardIndexRecordWhereInput
    /**
     * Limit how many DrDashboardIndexRecords to update.
     */
    limit?: number
  }

  /**
   * DrDashboardIndexRecord upsert
   */
  export type DrDashboardIndexRecordUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DrDashboardIndexRecord
     */
    select?: DrDashboardIndexRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DrDashboardIndexRecord
     */
    omit?: DrDashboardIndexRecordOmit<ExtArgs> | null
    /**
     * The filter to search for the DrDashboardIndexRecord to update in case it exists.
     */
    where: DrDashboardIndexRecordWhereUniqueInput
    /**
     * In case the DrDashboardIndexRecord found by the `where` argument doesn't exist, create a new DrDashboardIndexRecord with this data.
     */
    create: XOR<DrDashboardIndexRecordCreateInput, DrDashboardIndexRecordUncheckedCreateInput>
    /**
     * In case the DrDashboardIndexRecord was found with the provided `where` argument, update it with this data.
     */
    update: XOR<DrDashboardIndexRecordUpdateInput, DrDashboardIndexRecordUncheckedUpdateInput>
  }

  /**
   * DrDashboardIndexRecord delete
   */
  export type DrDashboardIndexRecordDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DrDashboardIndexRecord
     */
    select?: DrDashboardIndexRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DrDashboardIndexRecord
     */
    omit?: DrDashboardIndexRecordOmit<ExtArgs> | null
    /**
     * Filter which DrDashboardIndexRecord to delete.
     */
    where: DrDashboardIndexRecordWhereUniqueInput
  }

  /**
   * DrDashboardIndexRecord deleteMany
   */
  export type DrDashboardIndexRecordDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which DrDashboardIndexRecords to delete
     */
    where?: DrDashboardIndexRecordWhereInput
    /**
     * Limit how many DrDashboardIndexRecords to delete.
     */
    limit?: number
  }

  /**
   * DrDashboardIndexRecord without action
   */
  export type DrDashboardIndexRecordDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DrDashboardIndexRecord
     */
    select?: DrDashboardIndexRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DrDashboardIndexRecord
     */
    omit?: DrDashboardIndexRecordOmit<ExtArgs> | null
  }


  /**
   * Model DrForecastAccuracyRecord
   */

  export type AggregateDrForecastAccuracyRecord = {
    _count: DrForecastAccuracyRecordCountAggregateOutputType | null
    _avg: DrForecastAccuracyRecordAvgAggregateOutputType | null
    _sum: DrForecastAccuracyRecordSumAggregateOutputType | null
    _min: DrForecastAccuracyRecordMinAggregateOutputType | null
    _max: DrForecastAccuracyRecordMaxAggregateOutputType | null
  }

  export type DrForecastAccuracyRecordAvgAggregateOutputType = {
    horizonMonths: number | null
    actualValue: Decimal | null
    forecastValue: Decimal | null
    differenceValue: Decimal | null
    rawRecordCount: number | null
    duplicateCount: number | null
  }

  export type DrForecastAccuracyRecordSumAggregateOutputType = {
    horizonMonths: number | null
    actualValue: Decimal | null
    forecastValue: Decimal | null
    differenceValue: Decimal | null
    rawRecordCount: number | null
    duplicateCount: number | null
  }

  export type DrForecastAccuracyRecordMinAggregateOutputType = {
    id: string | null
    organizationId: string | null
    sourceId: string | null
    datasetId: string | null
    pipelineId: string | null
    latestRunId: string | null
    dedupeKey: string | null
    benchmarkCode: string | null
    sourceTableName: string | null
    orgTableName: string | null
    targetDate: Date | null
    horizonMonths: number | null
    actualValue: Decimal | null
    forecastValue: Decimal | null
    differenceValue: Decimal | null
    errorType: string | null
    duplicateStatus: string | null
    rawRecordCount: number | null
    duplicateCount: number | null
    lastSyncedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
    deletedAt: Date | null
  }

  export type DrForecastAccuracyRecordMaxAggregateOutputType = {
    id: string | null
    organizationId: string | null
    sourceId: string | null
    datasetId: string | null
    pipelineId: string | null
    latestRunId: string | null
    dedupeKey: string | null
    benchmarkCode: string | null
    sourceTableName: string | null
    orgTableName: string | null
    targetDate: Date | null
    horizonMonths: number | null
    actualValue: Decimal | null
    forecastValue: Decimal | null
    differenceValue: Decimal | null
    errorType: string | null
    duplicateStatus: string | null
    rawRecordCount: number | null
    duplicateCount: number | null
    lastSyncedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
    deletedAt: Date | null
  }

  export type DrForecastAccuracyRecordCountAggregateOutputType = {
    id: number
    organizationId: number
    sourceId: number
    datasetId: number
    pipelineId: number
    latestRunId: number
    dedupeKey: number
    benchmarkCode: number
    sourceTableName: number
    orgTableName: number
    targetDate: number
    horizonMonths: number
    actualValue: number
    forecastValue: number
    differenceValue: number
    errorType: number
    duplicateStatus: number
    rawRecordCount: number
    duplicateCount: number
    lineageJson: number
    metadataJson: number
    lastSyncedAt: number
    createdAt: number
    updatedAt: number
    deletedAt: number
    _all: number
  }


  export type DrForecastAccuracyRecordAvgAggregateInputType = {
    horizonMonths?: true
    actualValue?: true
    forecastValue?: true
    differenceValue?: true
    rawRecordCount?: true
    duplicateCount?: true
  }

  export type DrForecastAccuracyRecordSumAggregateInputType = {
    horizonMonths?: true
    actualValue?: true
    forecastValue?: true
    differenceValue?: true
    rawRecordCount?: true
    duplicateCount?: true
  }

  export type DrForecastAccuracyRecordMinAggregateInputType = {
    id?: true
    organizationId?: true
    sourceId?: true
    datasetId?: true
    pipelineId?: true
    latestRunId?: true
    dedupeKey?: true
    benchmarkCode?: true
    sourceTableName?: true
    orgTableName?: true
    targetDate?: true
    horizonMonths?: true
    actualValue?: true
    forecastValue?: true
    differenceValue?: true
    errorType?: true
    duplicateStatus?: true
    rawRecordCount?: true
    duplicateCount?: true
    lastSyncedAt?: true
    createdAt?: true
    updatedAt?: true
    deletedAt?: true
  }

  export type DrForecastAccuracyRecordMaxAggregateInputType = {
    id?: true
    organizationId?: true
    sourceId?: true
    datasetId?: true
    pipelineId?: true
    latestRunId?: true
    dedupeKey?: true
    benchmarkCode?: true
    sourceTableName?: true
    orgTableName?: true
    targetDate?: true
    horizonMonths?: true
    actualValue?: true
    forecastValue?: true
    differenceValue?: true
    errorType?: true
    duplicateStatus?: true
    rawRecordCount?: true
    duplicateCount?: true
    lastSyncedAt?: true
    createdAt?: true
    updatedAt?: true
    deletedAt?: true
  }

  export type DrForecastAccuracyRecordCountAggregateInputType = {
    id?: true
    organizationId?: true
    sourceId?: true
    datasetId?: true
    pipelineId?: true
    latestRunId?: true
    dedupeKey?: true
    benchmarkCode?: true
    sourceTableName?: true
    orgTableName?: true
    targetDate?: true
    horizonMonths?: true
    actualValue?: true
    forecastValue?: true
    differenceValue?: true
    errorType?: true
    duplicateStatus?: true
    rawRecordCount?: true
    duplicateCount?: true
    lineageJson?: true
    metadataJson?: true
    lastSyncedAt?: true
    createdAt?: true
    updatedAt?: true
    deletedAt?: true
    _all?: true
  }

  export type DrForecastAccuracyRecordAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which DrForecastAccuracyRecord to aggregate.
     */
    where?: DrForecastAccuracyRecordWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DrForecastAccuracyRecords to fetch.
     */
    orderBy?: DrForecastAccuracyRecordOrderByWithRelationInput | DrForecastAccuracyRecordOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: DrForecastAccuracyRecordWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DrForecastAccuracyRecords from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DrForecastAccuracyRecords.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned DrForecastAccuracyRecords
    **/
    _count?: true | DrForecastAccuracyRecordCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: DrForecastAccuracyRecordAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: DrForecastAccuracyRecordSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: DrForecastAccuracyRecordMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: DrForecastAccuracyRecordMaxAggregateInputType
  }

  export type GetDrForecastAccuracyRecordAggregateType<T extends DrForecastAccuracyRecordAggregateArgs> = {
        [P in keyof T & keyof AggregateDrForecastAccuracyRecord]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateDrForecastAccuracyRecord[P]>
      : GetScalarType<T[P], AggregateDrForecastAccuracyRecord[P]>
  }




  export type DrForecastAccuracyRecordGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: DrForecastAccuracyRecordWhereInput
    orderBy?: DrForecastAccuracyRecordOrderByWithAggregationInput | DrForecastAccuracyRecordOrderByWithAggregationInput[]
    by: DrForecastAccuracyRecordScalarFieldEnum[] | DrForecastAccuracyRecordScalarFieldEnum
    having?: DrForecastAccuracyRecordScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: DrForecastAccuracyRecordCountAggregateInputType | true
    _avg?: DrForecastAccuracyRecordAvgAggregateInputType
    _sum?: DrForecastAccuracyRecordSumAggregateInputType
    _min?: DrForecastAccuracyRecordMinAggregateInputType
    _max?: DrForecastAccuracyRecordMaxAggregateInputType
  }

  export type DrForecastAccuracyRecordGroupByOutputType = {
    id: string
    organizationId: string
    sourceId: string
    datasetId: string
    pipelineId: string
    latestRunId: string
    dedupeKey: string
    benchmarkCode: string
    sourceTableName: string
    orgTableName: string | null
    targetDate: Date
    horizonMonths: number
    actualValue: Decimal | null
    forecastValue: Decimal
    differenceValue: Decimal | null
    errorType: string | null
    duplicateStatus: string | null
    rawRecordCount: number
    duplicateCount: number
    lineageJson: JsonValue | null
    metadataJson: JsonValue | null
    lastSyncedAt: Date
    createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
    _count: DrForecastAccuracyRecordCountAggregateOutputType | null
    _avg: DrForecastAccuracyRecordAvgAggregateOutputType | null
    _sum: DrForecastAccuracyRecordSumAggregateOutputType | null
    _min: DrForecastAccuracyRecordMinAggregateOutputType | null
    _max: DrForecastAccuracyRecordMaxAggregateOutputType | null
  }

  type GetDrForecastAccuracyRecordGroupByPayload<T extends DrForecastAccuracyRecordGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<DrForecastAccuracyRecordGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof DrForecastAccuracyRecordGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], DrForecastAccuracyRecordGroupByOutputType[P]>
            : GetScalarType<T[P], DrForecastAccuracyRecordGroupByOutputType[P]>
        }
      >
    >


  export type DrForecastAccuracyRecordSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organizationId?: boolean
    sourceId?: boolean
    datasetId?: boolean
    pipelineId?: boolean
    latestRunId?: boolean
    dedupeKey?: boolean
    benchmarkCode?: boolean
    sourceTableName?: boolean
    orgTableName?: boolean
    targetDate?: boolean
    horizonMonths?: boolean
    actualValue?: boolean
    forecastValue?: boolean
    differenceValue?: boolean
    errorType?: boolean
    duplicateStatus?: boolean
    rawRecordCount?: boolean
    duplicateCount?: boolean
    lineageJson?: boolean
    metadataJson?: boolean
    lastSyncedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    deletedAt?: boolean
  }, ExtArgs["result"]["drForecastAccuracyRecord"]>

  export type DrForecastAccuracyRecordSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organizationId?: boolean
    sourceId?: boolean
    datasetId?: boolean
    pipelineId?: boolean
    latestRunId?: boolean
    dedupeKey?: boolean
    benchmarkCode?: boolean
    sourceTableName?: boolean
    orgTableName?: boolean
    targetDate?: boolean
    horizonMonths?: boolean
    actualValue?: boolean
    forecastValue?: boolean
    differenceValue?: boolean
    errorType?: boolean
    duplicateStatus?: boolean
    rawRecordCount?: boolean
    duplicateCount?: boolean
    lineageJson?: boolean
    metadataJson?: boolean
    lastSyncedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    deletedAt?: boolean
  }, ExtArgs["result"]["drForecastAccuracyRecord"]>

  export type DrForecastAccuracyRecordSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    organizationId?: boolean
    sourceId?: boolean
    datasetId?: boolean
    pipelineId?: boolean
    latestRunId?: boolean
    dedupeKey?: boolean
    benchmarkCode?: boolean
    sourceTableName?: boolean
    orgTableName?: boolean
    targetDate?: boolean
    horizonMonths?: boolean
    actualValue?: boolean
    forecastValue?: boolean
    differenceValue?: boolean
    errorType?: boolean
    duplicateStatus?: boolean
    rawRecordCount?: boolean
    duplicateCount?: boolean
    lineageJson?: boolean
    metadataJson?: boolean
    lastSyncedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    deletedAt?: boolean
  }, ExtArgs["result"]["drForecastAccuracyRecord"]>

  export type DrForecastAccuracyRecordSelectScalar = {
    id?: boolean
    organizationId?: boolean
    sourceId?: boolean
    datasetId?: boolean
    pipelineId?: boolean
    latestRunId?: boolean
    dedupeKey?: boolean
    benchmarkCode?: boolean
    sourceTableName?: boolean
    orgTableName?: boolean
    targetDate?: boolean
    horizonMonths?: boolean
    actualValue?: boolean
    forecastValue?: boolean
    differenceValue?: boolean
    errorType?: boolean
    duplicateStatus?: boolean
    rawRecordCount?: boolean
    duplicateCount?: boolean
    lineageJson?: boolean
    metadataJson?: boolean
    lastSyncedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    deletedAt?: boolean
  }

  export type DrForecastAccuracyRecordOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "organizationId" | "sourceId" | "datasetId" | "pipelineId" | "latestRunId" | "dedupeKey" | "benchmarkCode" | "sourceTableName" | "orgTableName" | "targetDate" | "horizonMonths" | "actualValue" | "forecastValue" | "differenceValue" | "errorType" | "duplicateStatus" | "rawRecordCount" | "duplicateCount" | "lineageJson" | "metadataJson" | "lastSyncedAt" | "createdAt" | "updatedAt" | "deletedAt", ExtArgs["result"]["drForecastAccuracyRecord"]>

  export type $DrForecastAccuracyRecordPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "DrForecastAccuracyRecord"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      organizationId: string
      sourceId: string
      datasetId: string
      pipelineId: string
      latestRunId: string
      dedupeKey: string
      benchmarkCode: string
      sourceTableName: string
      orgTableName: string | null
      targetDate: Date
      horizonMonths: number
      actualValue: Prisma.Decimal | null
      forecastValue: Prisma.Decimal
      differenceValue: Prisma.Decimal | null
      errorType: string | null
      duplicateStatus: string | null
      rawRecordCount: number
      duplicateCount: number
      lineageJson: Prisma.JsonValue | null
      metadataJson: Prisma.JsonValue | null
      lastSyncedAt: Date
      createdAt: Date
      updatedAt: Date
      deletedAt: Date | null
    }, ExtArgs["result"]["drForecastAccuracyRecord"]>
    composites: {}
  }

  type DrForecastAccuracyRecordGetPayload<S extends boolean | null | undefined | DrForecastAccuracyRecordDefaultArgs> = $Result.GetResult<Prisma.$DrForecastAccuracyRecordPayload, S>

  type DrForecastAccuracyRecordCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<DrForecastAccuracyRecordFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: DrForecastAccuracyRecordCountAggregateInputType | true
    }

  export interface DrForecastAccuracyRecordDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['DrForecastAccuracyRecord'], meta: { name: 'DrForecastAccuracyRecord' } }
    /**
     * Find zero or one DrForecastAccuracyRecord that matches the filter.
     * @param {DrForecastAccuracyRecordFindUniqueArgs} args - Arguments to find a DrForecastAccuracyRecord
     * @example
     * // Get one DrForecastAccuracyRecord
     * const drForecastAccuracyRecord = await prisma.drForecastAccuracyRecord.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends DrForecastAccuracyRecordFindUniqueArgs>(args: SelectSubset<T, DrForecastAccuracyRecordFindUniqueArgs<ExtArgs>>): Prisma__DrForecastAccuracyRecordClient<$Result.GetResult<Prisma.$DrForecastAccuracyRecordPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one DrForecastAccuracyRecord that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {DrForecastAccuracyRecordFindUniqueOrThrowArgs} args - Arguments to find a DrForecastAccuracyRecord
     * @example
     * // Get one DrForecastAccuracyRecord
     * const drForecastAccuracyRecord = await prisma.drForecastAccuracyRecord.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends DrForecastAccuracyRecordFindUniqueOrThrowArgs>(args: SelectSubset<T, DrForecastAccuracyRecordFindUniqueOrThrowArgs<ExtArgs>>): Prisma__DrForecastAccuracyRecordClient<$Result.GetResult<Prisma.$DrForecastAccuracyRecordPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first DrForecastAccuracyRecord that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DrForecastAccuracyRecordFindFirstArgs} args - Arguments to find a DrForecastAccuracyRecord
     * @example
     * // Get one DrForecastAccuracyRecord
     * const drForecastAccuracyRecord = await prisma.drForecastAccuracyRecord.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends DrForecastAccuracyRecordFindFirstArgs>(args?: SelectSubset<T, DrForecastAccuracyRecordFindFirstArgs<ExtArgs>>): Prisma__DrForecastAccuracyRecordClient<$Result.GetResult<Prisma.$DrForecastAccuracyRecordPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first DrForecastAccuracyRecord that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DrForecastAccuracyRecordFindFirstOrThrowArgs} args - Arguments to find a DrForecastAccuracyRecord
     * @example
     * // Get one DrForecastAccuracyRecord
     * const drForecastAccuracyRecord = await prisma.drForecastAccuracyRecord.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends DrForecastAccuracyRecordFindFirstOrThrowArgs>(args?: SelectSubset<T, DrForecastAccuracyRecordFindFirstOrThrowArgs<ExtArgs>>): Prisma__DrForecastAccuracyRecordClient<$Result.GetResult<Prisma.$DrForecastAccuracyRecordPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more DrForecastAccuracyRecords that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DrForecastAccuracyRecordFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all DrForecastAccuracyRecords
     * const drForecastAccuracyRecords = await prisma.drForecastAccuracyRecord.findMany()
     * 
     * // Get first 10 DrForecastAccuracyRecords
     * const drForecastAccuracyRecords = await prisma.drForecastAccuracyRecord.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const drForecastAccuracyRecordWithIdOnly = await prisma.drForecastAccuracyRecord.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends DrForecastAccuracyRecordFindManyArgs>(args?: SelectSubset<T, DrForecastAccuracyRecordFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DrForecastAccuracyRecordPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a DrForecastAccuracyRecord.
     * @param {DrForecastAccuracyRecordCreateArgs} args - Arguments to create a DrForecastAccuracyRecord.
     * @example
     * // Create one DrForecastAccuracyRecord
     * const DrForecastAccuracyRecord = await prisma.drForecastAccuracyRecord.create({
     *   data: {
     *     // ... data to create a DrForecastAccuracyRecord
     *   }
     * })
     * 
     */
    create<T extends DrForecastAccuracyRecordCreateArgs>(args: SelectSubset<T, DrForecastAccuracyRecordCreateArgs<ExtArgs>>): Prisma__DrForecastAccuracyRecordClient<$Result.GetResult<Prisma.$DrForecastAccuracyRecordPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many DrForecastAccuracyRecords.
     * @param {DrForecastAccuracyRecordCreateManyArgs} args - Arguments to create many DrForecastAccuracyRecords.
     * @example
     * // Create many DrForecastAccuracyRecords
     * const drForecastAccuracyRecord = await prisma.drForecastAccuracyRecord.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends DrForecastAccuracyRecordCreateManyArgs>(args?: SelectSubset<T, DrForecastAccuracyRecordCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many DrForecastAccuracyRecords and returns the data saved in the database.
     * @param {DrForecastAccuracyRecordCreateManyAndReturnArgs} args - Arguments to create many DrForecastAccuracyRecords.
     * @example
     * // Create many DrForecastAccuracyRecords
     * const drForecastAccuracyRecord = await prisma.drForecastAccuracyRecord.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many DrForecastAccuracyRecords and only return the `id`
     * const drForecastAccuracyRecordWithIdOnly = await prisma.drForecastAccuracyRecord.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends DrForecastAccuracyRecordCreateManyAndReturnArgs>(args?: SelectSubset<T, DrForecastAccuracyRecordCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DrForecastAccuracyRecordPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a DrForecastAccuracyRecord.
     * @param {DrForecastAccuracyRecordDeleteArgs} args - Arguments to delete one DrForecastAccuracyRecord.
     * @example
     * // Delete one DrForecastAccuracyRecord
     * const DrForecastAccuracyRecord = await prisma.drForecastAccuracyRecord.delete({
     *   where: {
     *     // ... filter to delete one DrForecastAccuracyRecord
     *   }
     * })
     * 
     */
    delete<T extends DrForecastAccuracyRecordDeleteArgs>(args: SelectSubset<T, DrForecastAccuracyRecordDeleteArgs<ExtArgs>>): Prisma__DrForecastAccuracyRecordClient<$Result.GetResult<Prisma.$DrForecastAccuracyRecordPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one DrForecastAccuracyRecord.
     * @param {DrForecastAccuracyRecordUpdateArgs} args - Arguments to update one DrForecastAccuracyRecord.
     * @example
     * // Update one DrForecastAccuracyRecord
     * const drForecastAccuracyRecord = await prisma.drForecastAccuracyRecord.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends DrForecastAccuracyRecordUpdateArgs>(args: SelectSubset<T, DrForecastAccuracyRecordUpdateArgs<ExtArgs>>): Prisma__DrForecastAccuracyRecordClient<$Result.GetResult<Prisma.$DrForecastAccuracyRecordPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more DrForecastAccuracyRecords.
     * @param {DrForecastAccuracyRecordDeleteManyArgs} args - Arguments to filter DrForecastAccuracyRecords to delete.
     * @example
     * // Delete a few DrForecastAccuracyRecords
     * const { count } = await prisma.drForecastAccuracyRecord.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends DrForecastAccuracyRecordDeleteManyArgs>(args?: SelectSubset<T, DrForecastAccuracyRecordDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more DrForecastAccuracyRecords.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DrForecastAccuracyRecordUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many DrForecastAccuracyRecords
     * const drForecastAccuracyRecord = await prisma.drForecastAccuracyRecord.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends DrForecastAccuracyRecordUpdateManyArgs>(args: SelectSubset<T, DrForecastAccuracyRecordUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more DrForecastAccuracyRecords and returns the data updated in the database.
     * @param {DrForecastAccuracyRecordUpdateManyAndReturnArgs} args - Arguments to update many DrForecastAccuracyRecords.
     * @example
     * // Update many DrForecastAccuracyRecords
     * const drForecastAccuracyRecord = await prisma.drForecastAccuracyRecord.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more DrForecastAccuracyRecords and only return the `id`
     * const drForecastAccuracyRecordWithIdOnly = await prisma.drForecastAccuracyRecord.updateManyAndReturn({
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
    updateManyAndReturn<T extends DrForecastAccuracyRecordUpdateManyAndReturnArgs>(args: SelectSubset<T, DrForecastAccuracyRecordUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DrForecastAccuracyRecordPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one DrForecastAccuracyRecord.
     * @param {DrForecastAccuracyRecordUpsertArgs} args - Arguments to update or create a DrForecastAccuracyRecord.
     * @example
     * // Update or create a DrForecastAccuracyRecord
     * const drForecastAccuracyRecord = await prisma.drForecastAccuracyRecord.upsert({
     *   create: {
     *     // ... data to create a DrForecastAccuracyRecord
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the DrForecastAccuracyRecord we want to update
     *   }
     * })
     */
    upsert<T extends DrForecastAccuracyRecordUpsertArgs>(args: SelectSubset<T, DrForecastAccuracyRecordUpsertArgs<ExtArgs>>): Prisma__DrForecastAccuracyRecordClient<$Result.GetResult<Prisma.$DrForecastAccuracyRecordPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of DrForecastAccuracyRecords.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DrForecastAccuracyRecordCountArgs} args - Arguments to filter DrForecastAccuracyRecords to count.
     * @example
     * // Count the number of DrForecastAccuracyRecords
     * const count = await prisma.drForecastAccuracyRecord.count({
     *   where: {
     *     // ... the filter for the DrForecastAccuracyRecords we want to count
     *   }
     * })
    **/
    count<T extends DrForecastAccuracyRecordCountArgs>(
      args?: Subset<T, DrForecastAccuracyRecordCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], DrForecastAccuracyRecordCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a DrForecastAccuracyRecord.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DrForecastAccuracyRecordAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends DrForecastAccuracyRecordAggregateArgs>(args: Subset<T, DrForecastAccuracyRecordAggregateArgs>): Prisma.PrismaPromise<GetDrForecastAccuracyRecordAggregateType<T>>

    /**
     * Group by DrForecastAccuracyRecord.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DrForecastAccuracyRecordGroupByArgs} args - Group by arguments.
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
      T extends DrForecastAccuracyRecordGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: DrForecastAccuracyRecordGroupByArgs['orderBy'] }
        : { orderBy?: DrForecastAccuracyRecordGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, DrForecastAccuracyRecordGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetDrForecastAccuracyRecordGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the DrForecastAccuracyRecord model
   */
  readonly fields: DrForecastAccuracyRecordFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for DrForecastAccuracyRecord.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__DrForecastAccuracyRecordClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
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
   * Fields of the DrForecastAccuracyRecord model
   */
  interface DrForecastAccuracyRecordFieldRefs {
    readonly id: FieldRef<"DrForecastAccuracyRecord", 'String'>
    readonly organizationId: FieldRef<"DrForecastAccuracyRecord", 'String'>
    readonly sourceId: FieldRef<"DrForecastAccuracyRecord", 'String'>
    readonly datasetId: FieldRef<"DrForecastAccuracyRecord", 'String'>
    readonly pipelineId: FieldRef<"DrForecastAccuracyRecord", 'String'>
    readonly latestRunId: FieldRef<"DrForecastAccuracyRecord", 'String'>
    readonly dedupeKey: FieldRef<"DrForecastAccuracyRecord", 'String'>
    readonly benchmarkCode: FieldRef<"DrForecastAccuracyRecord", 'String'>
    readonly sourceTableName: FieldRef<"DrForecastAccuracyRecord", 'String'>
    readonly orgTableName: FieldRef<"DrForecastAccuracyRecord", 'String'>
    readonly targetDate: FieldRef<"DrForecastAccuracyRecord", 'DateTime'>
    readonly horizonMonths: FieldRef<"DrForecastAccuracyRecord", 'Int'>
    readonly actualValue: FieldRef<"DrForecastAccuracyRecord", 'Decimal'>
    readonly forecastValue: FieldRef<"DrForecastAccuracyRecord", 'Decimal'>
    readonly differenceValue: FieldRef<"DrForecastAccuracyRecord", 'Decimal'>
    readonly errorType: FieldRef<"DrForecastAccuracyRecord", 'String'>
    readonly duplicateStatus: FieldRef<"DrForecastAccuracyRecord", 'String'>
    readonly rawRecordCount: FieldRef<"DrForecastAccuracyRecord", 'Int'>
    readonly duplicateCount: FieldRef<"DrForecastAccuracyRecord", 'Int'>
    readonly lineageJson: FieldRef<"DrForecastAccuracyRecord", 'Json'>
    readonly metadataJson: FieldRef<"DrForecastAccuracyRecord", 'Json'>
    readonly lastSyncedAt: FieldRef<"DrForecastAccuracyRecord", 'DateTime'>
    readonly createdAt: FieldRef<"DrForecastAccuracyRecord", 'DateTime'>
    readonly updatedAt: FieldRef<"DrForecastAccuracyRecord", 'DateTime'>
    readonly deletedAt: FieldRef<"DrForecastAccuracyRecord", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * DrForecastAccuracyRecord findUnique
   */
  export type DrForecastAccuracyRecordFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DrForecastAccuracyRecord
     */
    select?: DrForecastAccuracyRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DrForecastAccuracyRecord
     */
    omit?: DrForecastAccuracyRecordOmit<ExtArgs> | null
    /**
     * Filter, which DrForecastAccuracyRecord to fetch.
     */
    where: DrForecastAccuracyRecordWhereUniqueInput
  }

  /**
   * DrForecastAccuracyRecord findUniqueOrThrow
   */
  export type DrForecastAccuracyRecordFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DrForecastAccuracyRecord
     */
    select?: DrForecastAccuracyRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DrForecastAccuracyRecord
     */
    omit?: DrForecastAccuracyRecordOmit<ExtArgs> | null
    /**
     * Filter, which DrForecastAccuracyRecord to fetch.
     */
    where: DrForecastAccuracyRecordWhereUniqueInput
  }

  /**
   * DrForecastAccuracyRecord findFirst
   */
  export type DrForecastAccuracyRecordFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DrForecastAccuracyRecord
     */
    select?: DrForecastAccuracyRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DrForecastAccuracyRecord
     */
    omit?: DrForecastAccuracyRecordOmit<ExtArgs> | null
    /**
     * Filter, which DrForecastAccuracyRecord to fetch.
     */
    where?: DrForecastAccuracyRecordWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DrForecastAccuracyRecords to fetch.
     */
    orderBy?: DrForecastAccuracyRecordOrderByWithRelationInput | DrForecastAccuracyRecordOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for DrForecastAccuracyRecords.
     */
    cursor?: DrForecastAccuracyRecordWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DrForecastAccuracyRecords from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DrForecastAccuracyRecords.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of DrForecastAccuracyRecords.
     */
    distinct?: DrForecastAccuracyRecordScalarFieldEnum | DrForecastAccuracyRecordScalarFieldEnum[]
  }

  /**
   * DrForecastAccuracyRecord findFirstOrThrow
   */
  export type DrForecastAccuracyRecordFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DrForecastAccuracyRecord
     */
    select?: DrForecastAccuracyRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DrForecastAccuracyRecord
     */
    omit?: DrForecastAccuracyRecordOmit<ExtArgs> | null
    /**
     * Filter, which DrForecastAccuracyRecord to fetch.
     */
    where?: DrForecastAccuracyRecordWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DrForecastAccuracyRecords to fetch.
     */
    orderBy?: DrForecastAccuracyRecordOrderByWithRelationInput | DrForecastAccuracyRecordOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for DrForecastAccuracyRecords.
     */
    cursor?: DrForecastAccuracyRecordWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DrForecastAccuracyRecords from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DrForecastAccuracyRecords.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of DrForecastAccuracyRecords.
     */
    distinct?: DrForecastAccuracyRecordScalarFieldEnum | DrForecastAccuracyRecordScalarFieldEnum[]
  }

  /**
   * DrForecastAccuracyRecord findMany
   */
  export type DrForecastAccuracyRecordFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DrForecastAccuracyRecord
     */
    select?: DrForecastAccuracyRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DrForecastAccuracyRecord
     */
    omit?: DrForecastAccuracyRecordOmit<ExtArgs> | null
    /**
     * Filter, which DrForecastAccuracyRecords to fetch.
     */
    where?: DrForecastAccuracyRecordWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DrForecastAccuracyRecords to fetch.
     */
    orderBy?: DrForecastAccuracyRecordOrderByWithRelationInput | DrForecastAccuracyRecordOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing DrForecastAccuracyRecords.
     */
    cursor?: DrForecastAccuracyRecordWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DrForecastAccuracyRecords from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DrForecastAccuracyRecords.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of DrForecastAccuracyRecords.
     */
    distinct?: DrForecastAccuracyRecordScalarFieldEnum | DrForecastAccuracyRecordScalarFieldEnum[]
  }

  /**
   * DrForecastAccuracyRecord create
   */
  export type DrForecastAccuracyRecordCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DrForecastAccuracyRecord
     */
    select?: DrForecastAccuracyRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DrForecastAccuracyRecord
     */
    omit?: DrForecastAccuracyRecordOmit<ExtArgs> | null
    /**
     * The data needed to create a DrForecastAccuracyRecord.
     */
    data: XOR<DrForecastAccuracyRecordCreateInput, DrForecastAccuracyRecordUncheckedCreateInput>
  }

  /**
   * DrForecastAccuracyRecord createMany
   */
  export type DrForecastAccuracyRecordCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many DrForecastAccuracyRecords.
     */
    data: DrForecastAccuracyRecordCreateManyInput | DrForecastAccuracyRecordCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * DrForecastAccuracyRecord createManyAndReturn
   */
  export type DrForecastAccuracyRecordCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DrForecastAccuracyRecord
     */
    select?: DrForecastAccuracyRecordSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the DrForecastAccuracyRecord
     */
    omit?: DrForecastAccuracyRecordOmit<ExtArgs> | null
    /**
     * The data used to create many DrForecastAccuracyRecords.
     */
    data: DrForecastAccuracyRecordCreateManyInput | DrForecastAccuracyRecordCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * DrForecastAccuracyRecord update
   */
  export type DrForecastAccuracyRecordUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DrForecastAccuracyRecord
     */
    select?: DrForecastAccuracyRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DrForecastAccuracyRecord
     */
    omit?: DrForecastAccuracyRecordOmit<ExtArgs> | null
    /**
     * The data needed to update a DrForecastAccuracyRecord.
     */
    data: XOR<DrForecastAccuracyRecordUpdateInput, DrForecastAccuracyRecordUncheckedUpdateInput>
    /**
     * Choose, which DrForecastAccuracyRecord to update.
     */
    where: DrForecastAccuracyRecordWhereUniqueInput
  }

  /**
   * DrForecastAccuracyRecord updateMany
   */
  export type DrForecastAccuracyRecordUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update DrForecastAccuracyRecords.
     */
    data: XOR<DrForecastAccuracyRecordUpdateManyMutationInput, DrForecastAccuracyRecordUncheckedUpdateManyInput>
    /**
     * Filter which DrForecastAccuracyRecords to update
     */
    where?: DrForecastAccuracyRecordWhereInput
    /**
     * Limit how many DrForecastAccuracyRecords to update.
     */
    limit?: number
  }

  /**
   * DrForecastAccuracyRecord updateManyAndReturn
   */
  export type DrForecastAccuracyRecordUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DrForecastAccuracyRecord
     */
    select?: DrForecastAccuracyRecordSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the DrForecastAccuracyRecord
     */
    omit?: DrForecastAccuracyRecordOmit<ExtArgs> | null
    /**
     * The data used to update DrForecastAccuracyRecords.
     */
    data: XOR<DrForecastAccuracyRecordUpdateManyMutationInput, DrForecastAccuracyRecordUncheckedUpdateManyInput>
    /**
     * Filter which DrForecastAccuracyRecords to update
     */
    where?: DrForecastAccuracyRecordWhereInput
    /**
     * Limit how many DrForecastAccuracyRecords to update.
     */
    limit?: number
  }

  /**
   * DrForecastAccuracyRecord upsert
   */
  export type DrForecastAccuracyRecordUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DrForecastAccuracyRecord
     */
    select?: DrForecastAccuracyRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DrForecastAccuracyRecord
     */
    omit?: DrForecastAccuracyRecordOmit<ExtArgs> | null
    /**
     * The filter to search for the DrForecastAccuracyRecord to update in case it exists.
     */
    where: DrForecastAccuracyRecordWhereUniqueInput
    /**
     * In case the DrForecastAccuracyRecord found by the `where` argument doesn't exist, create a new DrForecastAccuracyRecord with this data.
     */
    create: XOR<DrForecastAccuracyRecordCreateInput, DrForecastAccuracyRecordUncheckedCreateInput>
    /**
     * In case the DrForecastAccuracyRecord was found with the provided `where` argument, update it with this data.
     */
    update: XOR<DrForecastAccuracyRecordUpdateInput, DrForecastAccuracyRecordUncheckedUpdateInput>
  }

  /**
   * DrForecastAccuracyRecord delete
   */
  export type DrForecastAccuracyRecordDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DrForecastAccuracyRecord
     */
    select?: DrForecastAccuracyRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DrForecastAccuracyRecord
     */
    omit?: DrForecastAccuracyRecordOmit<ExtArgs> | null
    /**
     * Filter which DrForecastAccuracyRecord to delete.
     */
    where: DrForecastAccuracyRecordWhereUniqueInput
  }

  /**
   * DrForecastAccuracyRecord deleteMany
   */
  export type DrForecastAccuracyRecordDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which DrForecastAccuracyRecords to delete
     */
    where?: DrForecastAccuracyRecordWhereInput
    /**
     * Limit how many DrForecastAccuracyRecords to delete.
     */
    limit?: number
  }

  /**
   * DrForecastAccuracyRecord without action
   */
  export type DrForecastAccuracyRecordDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DrForecastAccuracyRecord
     */
    select?: DrForecastAccuracyRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DrForecastAccuracyRecord
     */
    omit?: DrForecastAccuracyRecordOmit<ExtArgs> | null
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


  export const DrDashboardIndexRecordScalarFieldEnum: {
    id: 'id',
    organizationId: 'organizationId',
    sourceId: 'sourceId',
    datasetId: 'datasetId',
    pipelineId: 'pipelineId',
    latestRunId: 'latestRunId',
    dedupeKey: 'dedupeKey',
    scenarioType: 'scenarioType',
    componentId: 'componentId',
    componentName: 'componentName',
    componentCode: 'componentCode',
    metricValue: 'metricValue',
    unit: 'unit',
    currency: 'currency',
    sourceDate: 'sourceDate',
    market: 'market',
    country: 'country',
    qualityStatus: 'qualityStatus',
    duplicateStatus: 'duplicateStatus',
    rawRecordCount: 'rawRecordCount',
    duplicateCount: 'duplicateCount',
    lineageJson: 'lineageJson',
    metadataJson: 'metadataJson',
    lastSyncedAt: 'lastSyncedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    deletedAt: 'deletedAt'
  };

  export type DrDashboardIndexRecordScalarFieldEnum = (typeof DrDashboardIndexRecordScalarFieldEnum)[keyof typeof DrDashboardIndexRecordScalarFieldEnum]


  export const DrForecastAccuracyRecordScalarFieldEnum: {
    id: 'id',
    organizationId: 'organizationId',
    sourceId: 'sourceId',
    datasetId: 'datasetId',
    pipelineId: 'pipelineId',
    latestRunId: 'latestRunId',
    dedupeKey: 'dedupeKey',
    benchmarkCode: 'benchmarkCode',
    sourceTableName: 'sourceTableName',
    orgTableName: 'orgTableName',
    targetDate: 'targetDate',
    horizonMonths: 'horizonMonths',
    actualValue: 'actualValue',
    forecastValue: 'forecastValue',
    differenceValue: 'differenceValue',
    errorType: 'errorType',
    duplicateStatus: 'duplicateStatus',
    rawRecordCount: 'rawRecordCount',
    duplicateCount: 'duplicateCount',
    lineageJson: 'lineageJson',
    metadataJson: 'metadataJson',
    lastSyncedAt: 'lastSyncedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    deletedAt: 'deletedAt'
  };

  export type DrForecastAccuracyRecordScalarFieldEnum = (typeof DrForecastAccuracyRecordScalarFieldEnum)[keyof typeof DrForecastAccuracyRecordScalarFieldEnum]


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


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


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
   * Reference to a field of type 'Decimal'
   */
  export type DecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal'>
    


  /**
   * Reference to a field of type 'Decimal[]'
   */
  export type ListDecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal[]'>
    


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
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    


  /**
   * Reference to a field of type 'QueryMode'
   */
  export type EnumQueryModeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'QueryMode'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    
  /**
   * Deep Input Types
   */


  export type DrDashboardIndexRecordWhereInput = {
    AND?: DrDashboardIndexRecordWhereInput | DrDashboardIndexRecordWhereInput[]
    OR?: DrDashboardIndexRecordWhereInput[]
    NOT?: DrDashboardIndexRecordWhereInput | DrDashboardIndexRecordWhereInput[]
    id?: StringFilter<"DrDashboardIndexRecord"> | string
    organizationId?: StringFilter<"DrDashboardIndexRecord"> | string
    sourceId?: StringFilter<"DrDashboardIndexRecord"> | string
    datasetId?: StringFilter<"DrDashboardIndexRecord"> | string
    pipelineId?: StringFilter<"DrDashboardIndexRecord"> | string
    latestRunId?: StringFilter<"DrDashboardIndexRecord"> | string
    dedupeKey?: StringFilter<"DrDashboardIndexRecord"> | string
    scenarioType?: StringFilter<"DrDashboardIndexRecord"> | string
    componentId?: StringFilter<"DrDashboardIndexRecord"> | string
    componentName?: StringFilter<"DrDashboardIndexRecord"> | string
    componentCode?: StringNullableFilter<"DrDashboardIndexRecord"> | string | null
    metricValue?: DecimalNullableFilter<"DrDashboardIndexRecord"> | Decimal | DecimalJsLike | number | string | null
    unit?: StringNullableFilter<"DrDashboardIndexRecord"> | string | null
    currency?: StringNullableFilter<"DrDashboardIndexRecord"> | string | null
    sourceDate?: DateTimeNullableFilter<"DrDashboardIndexRecord"> | Date | string | null
    market?: StringNullableFilter<"DrDashboardIndexRecord"> | string | null
    country?: StringNullableFilter<"DrDashboardIndexRecord"> | string | null
    qualityStatus?: StringNullableFilter<"DrDashboardIndexRecord"> | string | null
    duplicateStatus?: StringNullableFilter<"DrDashboardIndexRecord"> | string | null
    rawRecordCount?: IntFilter<"DrDashboardIndexRecord"> | number
    duplicateCount?: IntFilter<"DrDashboardIndexRecord"> | number
    lineageJson?: JsonNullableFilter<"DrDashboardIndexRecord">
    metadataJson?: JsonNullableFilter<"DrDashboardIndexRecord">
    lastSyncedAt?: DateTimeFilter<"DrDashboardIndexRecord"> | Date | string
    createdAt?: DateTimeFilter<"DrDashboardIndexRecord"> | Date | string
    updatedAt?: DateTimeFilter<"DrDashboardIndexRecord"> | Date | string
    deletedAt?: DateTimeNullableFilter<"DrDashboardIndexRecord"> | Date | string | null
  }

  export type DrDashboardIndexRecordOrderByWithRelationInput = {
    id?: SortOrder
    organizationId?: SortOrder
    sourceId?: SortOrder
    datasetId?: SortOrder
    pipelineId?: SortOrder
    latestRunId?: SortOrder
    dedupeKey?: SortOrder
    scenarioType?: SortOrder
    componentId?: SortOrder
    componentName?: SortOrder
    componentCode?: SortOrderInput | SortOrder
    metricValue?: SortOrderInput | SortOrder
    unit?: SortOrderInput | SortOrder
    currency?: SortOrderInput | SortOrder
    sourceDate?: SortOrderInput | SortOrder
    market?: SortOrderInput | SortOrder
    country?: SortOrderInput | SortOrder
    qualityStatus?: SortOrderInput | SortOrder
    duplicateStatus?: SortOrderInput | SortOrder
    rawRecordCount?: SortOrder
    duplicateCount?: SortOrder
    lineageJson?: SortOrderInput | SortOrder
    metadataJson?: SortOrderInput | SortOrder
    lastSyncedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
  }

  export type DrDashboardIndexRecordWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    organizationId_pipelineId_dedupeKey?: DrDashboardIndexRecordOrganizationIdPipelineIdDedupeKeyCompoundUniqueInput
    AND?: DrDashboardIndexRecordWhereInput | DrDashboardIndexRecordWhereInput[]
    OR?: DrDashboardIndexRecordWhereInput[]
    NOT?: DrDashboardIndexRecordWhereInput | DrDashboardIndexRecordWhereInput[]
    organizationId?: StringFilter<"DrDashboardIndexRecord"> | string
    sourceId?: StringFilter<"DrDashboardIndexRecord"> | string
    datasetId?: StringFilter<"DrDashboardIndexRecord"> | string
    pipelineId?: StringFilter<"DrDashboardIndexRecord"> | string
    latestRunId?: StringFilter<"DrDashboardIndexRecord"> | string
    dedupeKey?: StringFilter<"DrDashboardIndexRecord"> | string
    scenarioType?: StringFilter<"DrDashboardIndexRecord"> | string
    componentId?: StringFilter<"DrDashboardIndexRecord"> | string
    componentName?: StringFilter<"DrDashboardIndexRecord"> | string
    componentCode?: StringNullableFilter<"DrDashboardIndexRecord"> | string | null
    metricValue?: DecimalNullableFilter<"DrDashboardIndexRecord"> | Decimal | DecimalJsLike | number | string | null
    unit?: StringNullableFilter<"DrDashboardIndexRecord"> | string | null
    currency?: StringNullableFilter<"DrDashboardIndexRecord"> | string | null
    sourceDate?: DateTimeNullableFilter<"DrDashboardIndexRecord"> | Date | string | null
    market?: StringNullableFilter<"DrDashboardIndexRecord"> | string | null
    country?: StringNullableFilter<"DrDashboardIndexRecord"> | string | null
    qualityStatus?: StringNullableFilter<"DrDashboardIndexRecord"> | string | null
    duplicateStatus?: StringNullableFilter<"DrDashboardIndexRecord"> | string | null
    rawRecordCount?: IntFilter<"DrDashboardIndexRecord"> | number
    duplicateCount?: IntFilter<"DrDashboardIndexRecord"> | number
    lineageJson?: JsonNullableFilter<"DrDashboardIndexRecord">
    metadataJson?: JsonNullableFilter<"DrDashboardIndexRecord">
    lastSyncedAt?: DateTimeFilter<"DrDashboardIndexRecord"> | Date | string
    createdAt?: DateTimeFilter<"DrDashboardIndexRecord"> | Date | string
    updatedAt?: DateTimeFilter<"DrDashboardIndexRecord"> | Date | string
    deletedAt?: DateTimeNullableFilter<"DrDashboardIndexRecord"> | Date | string | null
  }, "id" | "organizationId_pipelineId_dedupeKey">

  export type DrDashboardIndexRecordOrderByWithAggregationInput = {
    id?: SortOrder
    organizationId?: SortOrder
    sourceId?: SortOrder
    datasetId?: SortOrder
    pipelineId?: SortOrder
    latestRunId?: SortOrder
    dedupeKey?: SortOrder
    scenarioType?: SortOrder
    componentId?: SortOrder
    componentName?: SortOrder
    componentCode?: SortOrderInput | SortOrder
    metricValue?: SortOrderInput | SortOrder
    unit?: SortOrderInput | SortOrder
    currency?: SortOrderInput | SortOrder
    sourceDate?: SortOrderInput | SortOrder
    market?: SortOrderInput | SortOrder
    country?: SortOrderInput | SortOrder
    qualityStatus?: SortOrderInput | SortOrder
    duplicateStatus?: SortOrderInput | SortOrder
    rawRecordCount?: SortOrder
    duplicateCount?: SortOrder
    lineageJson?: SortOrderInput | SortOrder
    metadataJson?: SortOrderInput | SortOrder
    lastSyncedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
    _count?: DrDashboardIndexRecordCountOrderByAggregateInput
    _avg?: DrDashboardIndexRecordAvgOrderByAggregateInput
    _max?: DrDashboardIndexRecordMaxOrderByAggregateInput
    _min?: DrDashboardIndexRecordMinOrderByAggregateInput
    _sum?: DrDashboardIndexRecordSumOrderByAggregateInput
  }

  export type DrDashboardIndexRecordScalarWhereWithAggregatesInput = {
    AND?: DrDashboardIndexRecordScalarWhereWithAggregatesInput | DrDashboardIndexRecordScalarWhereWithAggregatesInput[]
    OR?: DrDashboardIndexRecordScalarWhereWithAggregatesInput[]
    NOT?: DrDashboardIndexRecordScalarWhereWithAggregatesInput | DrDashboardIndexRecordScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"DrDashboardIndexRecord"> | string
    organizationId?: StringWithAggregatesFilter<"DrDashboardIndexRecord"> | string
    sourceId?: StringWithAggregatesFilter<"DrDashboardIndexRecord"> | string
    datasetId?: StringWithAggregatesFilter<"DrDashboardIndexRecord"> | string
    pipelineId?: StringWithAggregatesFilter<"DrDashboardIndexRecord"> | string
    latestRunId?: StringWithAggregatesFilter<"DrDashboardIndexRecord"> | string
    dedupeKey?: StringWithAggregatesFilter<"DrDashboardIndexRecord"> | string
    scenarioType?: StringWithAggregatesFilter<"DrDashboardIndexRecord"> | string
    componentId?: StringWithAggregatesFilter<"DrDashboardIndexRecord"> | string
    componentName?: StringWithAggregatesFilter<"DrDashboardIndexRecord"> | string
    componentCode?: StringNullableWithAggregatesFilter<"DrDashboardIndexRecord"> | string | null
    metricValue?: DecimalNullableWithAggregatesFilter<"DrDashboardIndexRecord"> | Decimal | DecimalJsLike | number | string | null
    unit?: StringNullableWithAggregatesFilter<"DrDashboardIndexRecord"> | string | null
    currency?: StringNullableWithAggregatesFilter<"DrDashboardIndexRecord"> | string | null
    sourceDate?: DateTimeNullableWithAggregatesFilter<"DrDashboardIndexRecord"> | Date | string | null
    market?: StringNullableWithAggregatesFilter<"DrDashboardIndexRecord"> | string | null
    country?: StringNullableWithAggregatesFilter<"DrDashboardIndexRecord"> | string | null
    qualityStatus?: StringNullableWithAggregatesFilter<"DrDashboardIndexRecord"> | string | null
    duplicateStatus?: StringNullableWithAggregatesFilter<"DrDashboardIndexRecord"> | string | null
    rawRecordCount?: IntWithAggregatesFilter<"DrDashboardIndexRecord"> | number
    duplicateCount?: IntWithAggregatesFilter<"DrDashboardIndexRecord"> | number
    lineageJson?: JsonNullableWithAggregatesFilter<"DrDashboardIndexRecord">
    metadataJson?: JsonNullableWithAggregatesFilter<"DrDashboardIndexRecord">
    lastSyncedAt?: DateTimeWithAggregatesFilter<"DrDashboardIndexRecord"> | Date | string
    createdAt?: DateTimeWithAggregatesFilter<"DrDashboardIndexRecord"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"DrDashboardIndexRecord"> | Date | string
    deletedAt?: DateTimeNullableWithAggregatesFilter<"DrDashboardIndexRecord"> | Date | string | null
  }

  export type DrForecastAccuracyRecordWhereInput = {
    AND?: DrForecastAccuracyRecordWhereInput | DrForecastAccuracyRecordWhereInput[]
    OR?: DrForecastAccuracyRecordWhereInput[]
    NOT?: DrForecastAccuracyRecordWhereInput | DrForecastAccuracyRecordWhereInput[]
    id?: StringFilter<"DrForecastAccuracyRecord"> | string
    organizationId?: StringFilter<"DrForecastAccuracyRecord"> | string
    sourceId?: StringFilter<"DrForecastAccuracyRecord"> | string
    datasetId?: StringFilter<"DrForecastAccuracyRecord"> | string
    pipelineId?: StringFilter<"DrForecastAccuracyRecord"> | string
    latestRunId?: StringFilter<"DrForecastAccuracyRecord"> | string
    dedupeKey?: StringFilter<"DrForecastAccuracyRecord"> | string
    benchmarkCode?: StringFilter<"DrForecastAccuracyRecord"> | string
    sourceTableName?: StringFilter<"DrForecastAccuracyRecord"> | string
    orgTableName?: StringNullableFilter<"DrForecastAccuracyRecord"> | string | null
    targetDate?: DateTimeFilter<"DrForecastAccuracyRecord"> | Date | string
    horizonMonths?: IntFilter<"DrForecastAccuracyRecord"> | number
    actualValue?: DecimalNullableFilter<"DrForecastAccuracyRecord"> | Decimal | DecimalJsLike | number | string | null
    forecastValue?: DecimalFilter<"DrForecastAccuracyRecord"> | Decimal | DecimalJsLike | number | string
    differenceValue?: DecimalNullableFilter<"DrForecastAccuracyRecord"> | Decimal | DecimalJsLike | number | string | null
    errorType?: StringNullableFilter<"DrForecastAccuracyRecord"> | string | null
    duplicateStatus?: StringNullableFilter<"DrForecastAccuracyRecord"> | string | null
    rawRecordCount?: IntFilter<"DrForecastAccuracyRecord"> | number
    duplicateCount?: IntFilter<"DrForecastAccuracyRecord"> | number
    lineageJson?: JsonNullableFilter<"DrForecastAccuracyRecord">
    metadataJson?: JsonNullableFilter<"DrForecastAccuracyRecord">
    lastSyncedAt?: DateTimeFilter<"DrForecastAccuracyRecord"> | Date | string
    createdAt?: DateTimeFilter<"DrForecastAccuracyRecord"> | Date | string
    updatedAt?: DateTimeFilter<"DrForecastAccuracyRecord"> | Date | string
    deletedAt?: DateTimeNullableFilter<"DrForecastAccuracyRecord"> | Date | string | null
  }

  export type DrForecastAccuracyRecordOrderByWithRelationInput = {
    id?: SortOrder
    organizationId?: SortOrder
    sourceId?: SortOrder
    datasetId?: SortOrder
    pipelineId?: SortOrder
    latestRunId?: SortOrder
    dedupeKey?: SortOrder
    benchmarkCode?: SortOrder
    sourceTableName?: SortOrder
    orgTableName?: SortOrderInput | SortOrder
    targetDate?: SortOrder
    horizonMonths?: SortOrder
    actualValue?: SortOrderInput | SortOrder
    forecastValue?: SortOrder
    differenceValue?: SortOrderInput | SortOrder
    errorType?: SortOrderInput | SortOrder
    duplicateStatus?: SortOrderInput | SortOrder
    rawRecordCount?: SortOrder
    duplicateCount?: SortOrder
    lineageJson?: SortOrderInput | SortOrder
    metadataJson?: SortOrderInput | SortOrder
    lastSyncedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
  }

  export type DrForecastAccuracyRecordWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    organizationId_pipelineId_dedupeKey?: DrForecastAccuracyRecordOrganizationIdPipelineIdDedupeKeyCompoundUniqueInput
    AND?: DrForecastAccuracyRecordWhereInput | DrForecastAccuracyRecordWhereInput[]
    OR?: DrForecastAccuracyRecordWhereInput[]
    NOT?: DrForecastAccuracyRecordWhereInput | DrForecastAccuracyRecordWhereInput[]
    organizationId?: StringFilter<"DrForecastAccuracyRecord"> | string
    sourceId?: StringFilter<"DrForecastAccuracyRecord"> | string
    datasetId?: StringFilter<"DrForecastAccuracyRecord"> | string
    pipelineId?: StringFilter<"DrForecastAccuracyRecord"> | string
    latestRunId?: StringFilter<"DrForecastAccuracyRecord"> | string
    dedupeKey?: StringFilter<"DrForecastAccuracyRecord"> | string
    benchmarkCode?: StringFilter<"DrForecastAccuracyRecord"> | string
    sourceTableName?: StringFilter<"DrForecastAccuracyRecord"> | string
    orgTableName?: StringNullableFilter<"DrForecastAccuracyRecord"> | string | null
    targetDate?: DateTimeFilter<"DrForecastAccuracyRecord"> | Date | string
    horizonMonths?: IntFilter<"DrForecastAccuracyRecord"> | number
    actualValue?: DecimalNullableFilter<"DrForecastAccuracyRecord"> | Decimal | DecimalJsLike | number | string | null
    forecastValue?: DecimalFilter<"DrForecastAccuracyRecord"> | Decimal | DecimalJsLike | number | string
    differenceValue?: DecimalNullableFilter<"DrForecastAccuracyRecord"> | Decimal | DecimalJsLike | number | string | null
    errorType?: StringNullableFilter<"DrForecastAccuracyRecord"> | string | null
    duplicateStatus?: StringNullableFilter<"DrForecastAccuracyRecord"> | string | null
    rawRecordCount?: IntFilter<"DrForecastAccuracyRecord"> | number
    duplicateCount?: IntFilter<"DrForecastAccuracyRecord"> | number
    lineageJson?: JsonNullableFilter<"DrForecastAccuracyRecord">
    metadataJson?: JsonNullableFilter<"DrForecastAccuracyRecord">
    lastSyncedAt?: DateTimeFilter<"DrForecastAccuracyRecord"> | Date | string
    createdAt?: DateTimeFilter<"DrForecastAccuracyRecord"> | Date | string
    updatedAt?: DateTimeFilter<"DrForecastAccuracyRecord"> | Date | string
    deletedAt?: DateTimeNullableFilter<"DrForecastAccuracyRecord"> | Date | string | null
  }, "id" | "organizationId_pipelineId_dedupeKey">

  export type DrForecastAccuracyRecordOrderByWithAggregationInput = {
    id?: SortOrder
    organizationId?: SortOrder
    sourceId?: SortOrder
    datasetId?: SortOrder
    pipelineId?: SortOrder
    latestRunId?: SortOrder
    dedupeKey?: SortOrder
    benchmarkCode?: SortOrder
    sourceTableName?: SortOrder
    orgTableName?: SortOrderInput | SortOrder
    targetDate?: SortOrder
    horizonMonths?: SortOrder
    actualValue?: SortOrderInput | SortOrder
    forecastValue?: SortOrder
    differenceValue?: SortOrderInput | SortOrder
    errorType?: SortOrderInput | SortOrder
    duplicateStatus?: SortOrderInput | SortOrder
    rawRecordCount?: SortOrder
    duplicateCount?: SortOrder
    lineageJson?: SortOrderInput | SortOrder
    metadataJson?: SortOrderInput | SortOrder
    lastSyncedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deletedAt?: SortOrderInput | SortOrder
    _count?: DrForecastAccuracyRecordCountOrderByAggregateInput
    _avg?: DrForecastAccuracyRecordAvgOrderByAggregateInput
    _max?: DrForecastAccuracyRecordMaxOrderByAggregateInput
    _min?: DrForecastAccuracyRecordMinOrderByAggregateInput
    _sum?: DrForecastAccuracyRecordSumOrderByAggregateInput
  }

  export type DrForecastAccuracyRecordScalarWhereWithAggregatesInput = {
    AND?: DrForecastAccuracyRecordScalarWhereWithAggregatesInput | DrForecastAccuracyRecordScalarWhereWithAggregatesInput[]
    OR?: DrForecastAccuracyRecordScalarWhereWithAggregatesInput[]
    NOT?: DrForecastAccuracyRecordScalarWhereWithAggregatesInput | DrForecastAccuracyRecordScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"DrForecastAccuracyRecord"> | string
    organizationId?: StringWithAggregatesFilter<"DrForecastAccuracyRecord"> | string
    sourceId?: StringWithAggregatesFilter<"DrForecastAccuracyRecord"> | string
    datasetId?: StringWithAggregatesFilter<"DrForecastAccuracyRecord"> | string
    pipelineId?: StringWithAggregatesFilter<"DrForecastAccuracyRecord"> | string
    latestRunId?: StringWithAggregatesFilter<"DrForecastAccuracyRecord"> | string
    dedupeKey?: StringWithAggregatesFilter<"DrForecastAccuracyRecord"> | string
    benchmarkCode?: StringWithAggregatesFilter<"DrForecastAccuracyRecord"> | string
    sourceTableName?: StringWithAggregatesFilter<"DrForecastAccuracyRecord"> | string
    orgTableName?: StringNullableWithAggregatesFilter<"DrForecastAccuracyRecord"> | string | null
    targetDate?: DateTimeWithAggregatesFilter<"DrForecastAccuracyRecord"> | Date | string
    horizonMonths?: IntWithAggregatesFilter<"DrForecastAccuracyRecord"> | number
    actualValue?: DecimalNullableWithAggregatesFilter<"DrForecastAccuracyRecord"> | Decimal | DecimalJsLike | number | string | null
    forecastValue?: DecimalWithAggregatesFilter<"DrForecastAccuracyRecord"> | Decimal | DecimalJsLike | number | string
    differenceValue?: DecimalNullableWithAggregatesFilter<"DrForecastAccuracyRecord"> | Decimal | DecimalJsLike | number | string | null
    errorType?: StringNullableWithAggregatesFilter<"DrForecastAccuracyRecord"> | string | null
    duplicateStatus?: StringNullableWithAggregatesFilter<"DrForecastAccuracyRecord"> | string | null
    rawRecordCount?: IntWithAggregatesFilter<"DrForecastAccuracyRecord"> | number
    duplicateCount?: IntWithAggregatesFilter<"DrForecastAccuracyRecord"> | number
    lineageJson?: JsonNullableWithAggregatesFilter<"DrForecastAccuracyRecord">
    metadataJson?: JsonNullableWithAggregatesFilter<"DrForecastAccuracyRecord">
    lastSyncedAt?: DateTimeWithAggregatesFilter<"DrForecastAccuracyRecord"> | Date | string
    createdAt?: DateTimeWithAggregatesFilter<"DrForecastAccuracyRecord"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"DrForecastAccuracyRecord"> | Date | string
    deletedAt?: DateTimeNullableWithAggregatesFilter<"DrForecastAccuracyRecord"> | Date | string | null
  }

  export type DrDashboardIndexRecordCreateInput = {
    id?: string
    organizationId: string
    sourceId: string
    datasetId: string
    pipelineId: string
    latestRunId: string
    dedupeKey: string
    scenarioType: string
    componentId: string
    componentName: string
    componentCode?: string | null
    metricValue?: Decimal | DecimalJsLike | number | string | null
    unit?: string | null
    currency?: string | null
    sourceDate?: Date | string | null
    market?: string | null
    country?: string | null
    qualityStatus?: string | null
    duplicateStatus?: string | null
    rawRecordCount?: number
    duplicateCount?: number
    lineageJson?: NullableJsonNullValueInput | InputJsonValue
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    lastSyncedAt: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
  }

  export type DrDashboardIndexRecordUncheckedCreateInput = {
    id?: string
    organizationId: string
    sourceId: string
    datasetId: string
    pipelineId: string
    latestRunId: string
    dedupeKey: string
    scenarioType: string
    componentId: string
    componentName: string
    componentCode?: string | null
    metricValue?: Decimal | DecimalJsLike | number | string | null
    unit?: string | null
    currency?: string | null
    sourceDate?: Date | string | null
    market?: string | null
    country?: string | null
    qualityStatus?: string | null
    duplicateStatus?: string | null
    rawRecordCount?: number
    duplicateCount?: number
    lineageJson?: NullableJsonNullValueInput | InputJsonValue
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    lastSyncedAt: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
  }

  export type DrDashboardIndexRecordUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    sourceId?: StringFieldUpdateOperationsInput | string
    datasetId?: StringFieldUpdateOperationsInput | string
    pipelineId?: StringFieldUpdateOperationsInput | string
    latestRunId?: StringFieldUpdateOperationsInput | string
    dedupeKey?: StringFieldUpdateOperationsInput | string
    scenarioType?: StringFieldUpdateOperationsInput | string
    componentId?: StringFieldUpdateOperationsInput | string
    componentName?: StringFieldUpdateOperationsInput | string
    componentCode?: NullableStringFieldUpdateOperationsInput | string | null
    metricValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    unit?: NullableStringFieldUpdateOperationsInput | string | null
    currency?: NullableStringFieldUpdateOperationsInput | string | null
    sourceDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    market?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    qualityStatus?: NullableStringFieldUpdateOperationsInput | string | null
    duplicateStatus?: NullableStringFieldUpdateOperationsInput | string | null
    rawRecordCount?: IntFieldUpdateOperationsInput | number
    duplicateCount?: IntFieldUpdateOperationsInput | number
    lineageJson?: NullableJsonNullValueInput | InputJsonValue
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    lastSyncedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type DrDashboardIndexRecordUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    sourceId?: StringFieldUpdateOperationsInput | string
    datasetId?: StringFieldUpdateOperationsInput | string
    pipelineId?: StringFieldUpdateOperationsInput | string
    latestRunId?: StringFieldUpdateOperationsInput | string
    dedupeKey?: StringFieldUpdateOperationsInput | string
    scenarioType?: StringFieldUpdateOperationsInput | string
    componentId?: StringFieldUpdateOperationsInput | string
    componentName?: StringFieldUpdateOperationsInput | string
    componentCode?: NullableStringFieldUpdateOperationsInput | string | null
    metricValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    unit?: NullableStringFieldUpdateOperationsInput | string | null
    currency?: NullableStringFieldUpdateOperationsInput | string | null
    sourceDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    market?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    qualityStatus?: NullableStringFieldUpdateOperationsInput | string | null
    duplicateStatus?: NullableStringFieldUpdateOperationsInput | string | null
    rawRecordCount?: IntFieldUpdateOperationsInput | number
    duplicateCount?: IntFieldUpdateOperationsInput | number
    lineageJson?: NullableJsonNullValueInput | InputJsonValue
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    lastSyncedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type DrDashboardIndexRecordCreateManyInput = {
    id?: string
    organizationId: string
    sourceId: string
    datasetId: string
    pipelineId: string
    latestRunId: string
    dedupeKey: string
    scenarioType: string
    componentId: string
    componentName: string
    componentCode?: string | null
    metricValue?: Decimal | DecimalJsLike | number | string | null
    unit?: string | null
    currency?: string | null
    sourceDate?: Date | string | null
    market?: string | null
    country?: string | null
    qualityStatus?: string | null
    duplicateStatus?: string | null
    rawRecordCount?: number
    duplicateCount?: number
    lineageJson?: NullableJsonNullValueInput | InputJsonValue
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    lastSyncedAt: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
  }

  export type DrDashboardIndexRecordUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    sourceId?: StringFieldUpdateOperationsInput | string
    datasetId?: StringFieldUpdateOperationsInput | string
    pipelineId?: StringFieldUpdateOperationsInput | string
    latestRunId?: StringFieldUpdateOperationsInput | string
    dedupeKey?: StringFieldUpdateOperationsInput | string
    scenarioType?: StringFieldUpdateOperationsInput | string
    componentId?: StringFieldUpdateOperationsInput | string
    componentName?: StringFieldUpdateOperationsInput | string
    componentCode?: NullableStringFieldUpdateOperationsInput | string | null
    metricValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    unit?: NullableStringFieldUpdateOperationsInput | string | null
    currency?: NullableStringFieldUpdateOperationsInput | string | null
    sourceDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    market?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    qualityStatus?: NullableStringFieldUpdateOperationsInput | string | null
    duplicateStatus?: NullableStringFieldUpdateOperationsInput | string | null
    rawRecordCount?: IntFieldUpdateOperationsInput | number
    duplicateCount?: IntFieldUpdateOperationsInput | number
    lineageJson?: NullableJsonNullValueInput | InputJsonValue
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    lastSyncedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type DrDashboardIndexRecordUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    sourceId?: StringFieldUpdateOperationsInput | string
    datasetId?: StringFieldUpdateOperationsInput | string
    pipelineId?: StringFieldUpdateOperationsInput | string
    latestRunId?: StringFieldUpdateOperationsInput | string
    dedupeKey?: StringFieldUpdateOperationsInput | string
    scenarioType?: StringFieldUpdateOperationsInput | string
    componentId?: StringFieldUpdateOperationsInput | string
    componentName?: StringFieldUpdateOperationsInput | string
    componentCode?: NullableStringFieldUpdateOperationsInput | string | null
    metricValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    unit?: NullableStringFieldUpdateOperationsInput | string | null
    currency?: NullableStringFieldUpdateOperationsInput | string | null
    sourceDate?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    market?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    qualityStatus?: NullableStringFieldUpdateOperationsInput | string | null
    duplicateStatus?: NullableStringFieldUpdateOperationsInput | string | null
    rawRecordCount?: IntFieldUpdateOperationsInput | number
    duplicateCount?: IntFieldUpdateOperationsInput | number
    lineageJson?: NullableJsonNullValueInput | InputJsonValue
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    lastSyncedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type DrForecastAccuracyRecordCreateInput = {
    id?: string
    organizationId: string
    sourceId: string
    datasetId: string
    pipelineId: string
    latestRunId: string
    dedupeKey: string
    benchmarkCode: string
    sourceTableName: string
    orgTableName?: string | null
    targetDate: Date | string
    horizonMonths: number
    actualValue?: Decimal | DecimalJsLike | number | string | null
    forecastValue: Decimal | DecimalJsLike | number | string
    differenceValue?: Decimal | DecimalJsLike | number | string | null
    errorType?: string | null
    duplicateStatus?: string | null
    rawRecordCount?: number
    duplicateCount?: number
    lineageJson?: NullableJsonNullValueInput | InputJsonValue
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    lastSyncedAt: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
  }

  export type DrForecastAccuracyRecordUncheckedCreateInput = {
    id?: string
    organizationId: string
    sourceId: string
    datasetId: string
    pipelineId: string
    latestRunId: string
    dedupeKey: string
    benchmarkCode: string
    sourceTableName: string
    orgTableName?: string | null
    targetDate: Date | string
    horizonMonths: number
    actualValue?: Decimal | DecimalJsLike | number | string | null
    forecastValue: Decimal | DecimalJsLike | number | string
    differenceValue?: Decimal | DecimalJsLike | number | string | null
    errorType?: string | null
    duplicateStatus?: string | null
    rawRecordCount?: number
    duplicateCount?: number
    lineageJson?: NullableJsonNullValueInput | InputJsonValue
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    lastSyncedAt: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
  }

  export type DrForecastAccuracyRecordUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    sourceId?: StringFieldUpdateOperationsInput | string
    datasetId?: StringFieldUpdateOperationsInput | string
    pipelineId?: StringFieldUpdateOperationsInput | string
    latestRunId?: StringFieldUpdateOperationsInput | string
    dedupeKey?: StringFieldUpdateOperationsInput | string
    benchmarkCode?: StringFieldUpdateOperationsInput | string
    sourceTableName?: StringFieldUpdateOperationsInput | string
    orgTableName?: NullableStringFieldUpdateOperationsInput | string | null
    targetDate?: DateTimeFieldUpdateOperationsInput | Date | string
    horizonMonths?: IntFieldUpdateOperationsInput | number
    actualValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    forecastValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    differenceValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    errorType?: NullableStringFieldUpdateOperationsInput | string | null
    duplicateStatus?: NullableStringFieldUpdateOperationsInput | string | null
    rawRecordCount?: IntFieldUpdateOperationsInput | number
    duplicateCount?: IntFieldUpdateOperationsInput | number
    lineageJson?: NullableJsonNullValueInput | InputJsonValue
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    lastSyncedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type DrForecastAccuracyRecordUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    sourceId?: StringFieldUpdateOperationsInput | string
    datasetId?: StringFieldUpdateOperationsInput | string
    pipelineId?: StringFieldUpdateOperationsInput | string
    latestRunId?: StringFieldUpdateOperationsInput | string
    dedupeKey?: StringFieldUpdateOperationsInput | string
    benchmarkCode?: StringFieldUpdateOperationsInput | string
    sourceTableName?: StringFieldUpdateOperationsInput | string
    orgTableName?: NullableStringFieldUpdateOperationsInput | string | null
    targetDate?: DateTimeFieldUpdateOperationsInput | Date | string
    horizonMonths?: IntFieldUpdateOperationsInput | number
    actualValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    forecastValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    differenceValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    errorType?: NullableStringFieldUpdateOperationsInput | string | null
    duplicateStatus?: NullableStringFieldUpdateOperationsInput | string | null
    rawRecordCount?: IntFieldUpdateOperationsInput | number
    duplicateCount?: IntFieldUpdateOperationsInput | number
    lineageJson?: NullableJsonNullValueInput | InputJsonValue
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    lastSyncedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type DrForecastAccuracyRecordCreateManyInput = {
    id?: string
    organizationId: string
    sourceId: string
    datasetId: string
    pipelineId: string
    latestRunId: string
    dedupeKey: string
    benchmarkCode: string
    sourceTableName: string
    orgTableName?: string | null
    targetDate: Date | string
    horizonMonths: number
    actualValue?: Decimal | DecimalJsLike | number | string | null
    forecastValue: Decimal | DecimalJsLike | number | string
    differenceValue?: Decimal | DecimalJsLike | number | string | null
    errorType?: string | null
    duplicateStatus?: string | null
    rawRecordCount?: number
    duplicateCount?: number
    lineageJson?: NullableJsonNullValueInput | InputJsonValue
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    lastSyncedAt: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    deletedAt?: Date | string | null
  }

  export type DrForecastAccuracyRecordUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    sourceId?: StringFieldUpdateOperationsInput | string
    datasetId?: StringFieldUpdateOperationsInput | string
    pipelineId?: StringFieldUpdateOperationsInput | string
    latestRunId?: StringFieldUpdateOperationsInput | string
    dedupeKey?: StringFieldUpdateOperationsInput | string
    benchmarkCode?: StringFieldUpdateOperationsInput | string
    sourceTableName?: StringFieldUpdateOperationsInput | string
    orgTableName?: NullableStringFieldUpdateOperationsInput | string | null
    targetDate?: DateTimeFieldUpdateOperationsInput | Date | string
    horizonMonths?: IntFieldUpdateOperationsInput | number
    actualValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    forecastValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    differenceValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    errorType?: NullableStringFieldUpdateOperationsInput | string | null
    duplicateStatus?: NullableStringFieldUpdateOperationsInput | string | null
    rawRecordCount?: IntFieldUpdateOperationsInput | number
    duplicateCount?: IntFieldUpdateOperationsInput | number
    lineageJson?: NullableJsonNullValueInput | InputJsonValue
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    lastSyncedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type DrForecastAccuracyRecordUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    organizationId?: StringFieldUpdateOperationsInput | string
    sourceId?: StringFieldUpdateOperationsInput | string
    datasetId?: StringFieldUpdateOperationsInput | string
    pipelineId?: StringFieldUpdateOperationsInput | string
    latestRunId?: StringFieldUpdateOperationsInput | string
    dedupeKey?: StringFieldUpdateOperationsInput | string
    benchmarkCode?: StringFieldUpdateOperationsInput | string
    sourceTableName?: StringFieldUpdateOperationsInput | string
    orgTableName?: NullableStringFieldUpdateOperationsInput | string | null
    targetDate?: DateTimeFieldUpdateOperationsInput | Date | string
    horizonMonths?: IntFieldUpdateOperationsInput | number
    actualValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    forecastValue?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    differenceValue?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    errorType?: NullableStringFieldUpdateOperationsInput | string | null
    duplicateStatus?: NullableStringFieldUpdateOperationsInput | string | null
    rawRecordCount?: IntFieldUpdateOperationsInput | number
    duplicateCount?: IntFieldUpdateOperationsInput | number
    lineageJson?: NullableJsonNullValueInput | InputJsonValue
    metadataJson?: NullableJsonNullValueInput | InputJsonValue
    lastSyncedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    deletedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
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

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type DrDashboardIndexRecordOrganizationIdPipelineIdDedupeKeyCompoundUniqueInput = {
    organizationId: string
    pipelineId: string
    dedupeKey: string
  }

  export type DrDashboardIndexRecordCountOrderByAggregateInput = {
    id?: SortOrder
    organizationId?: SortOrder
    sourceId?: SortOrder
    datasetId?: SortOrder
    pipelineId?: SortOrder
    latestRunId?: SortOrder
    dedupeKey?: SortOrder
    scenarioType?: SortOrder
    componentId?: SortOrder
    componentName?: SortOrder
    componentCode?: SortOrder
    metricValue?: SortOrder
    unit?: SortOrder
    currency?: SortOrder
    sourceDate?: SortOrder
    market?: SortOrder
    country?: SortOrder
    qualityStatus?: SortOrder
    duplicateStatus?: SortOrder
    rawRecordCount?: SortOrder
    duplicateCount?: SortOrder
    lineageJson?: SortOrder
    metadataJson?: SortOrder
    lastSyncedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deletedAt?: SortOrder
  }

  export type DrDashboardIndexRecordAvgOrderByAggregateInput = {
    metricValue?: SortOrder
    rawRecordCount?: SortOrder
    duplicateCount?: SortOrder
  }

  export type DrDashboardIndexRecordMaxOrderByAggregateInput = {
    id?: SortOrder
    organizationId?: SortOrder
    sourceId?: SortOrder
    datasetId?: SortOrder
    pipelineId?: SortOrder
    latestRunId?: SortOrder
    dedupeKey?: SortOrder
    scenarioType?: SortOrder
    componentId?: SortOrder
    componentName?: SortOrder
    componentCode?: SortOrder
    metricValue?: SortOrder
    unit?: SortOrder
    currency?: SortOrder
    sourceDate?: SortOrder
    market?: SortOrder
    country?: SortOrder
    qualityStatus?: SortOrder
    duplicateStatus?: SortOrder
    rawRecordCount?: SortOrder
    duplicateCount?: SortOrder
    lastSyncedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deletedAt?: SortOrder
  }

  export type DrDashboardIndexRecordMinOrderByAggregateInput = {
    id?: SortOrder
    organizationId?: SortOrder
    sourceId?: SortOrder
    datasetId?: SortOrder
    pipelineId?: SortOrder
    latestRunId?: SortOrder
    dedupeKey?: SortOrder
    scenarioType?: SortOrder
    componentId?: SortOrder
    componentName?: SortOrder
    componentCode?: SortOrder
    metricValue?: SortOrder
    unit?: SortOrder
    currency?: SortOrder
    sourceDate?: SortOrder
    market?: SortOrder
    country?: SortOrder
    qualityStatus?: SortOrder
    duplicateStatus?: SortOrder
    rawRecordCount?: SortOrder
    duplicateCount?: SortOrder
    lastSyncedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deletedAt?: SortOrder
  }

  export type DrDashboardIndexRecordSumOrderByAggregateInput = {
    metricValue?: SortOrder
    rawRecordCount?: SortOrder
    duplicateCount?: SortOrder
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

  export type DrForecastAccuracyRecordOrganizationIdPipelineIdDedupeKeyCompoundUniqueInput = {
    organizationId: string
    pipelineId: string
    dedupeKey: string
  }

  export type DrForecastAccuracyRecordCountOrderByAggregateInput = {
    id?: SortOrder
    organizationId?: SortOrder
    sourceId?: SortOrder
    datasetId?: SortOrder
    pipelineId?: SortOrder
    latestRunId?: SortOrder
    dedupeKey?: SortOrder
    benchmarkCode?: SortOrder
    sourceTableName?: SortOrder
    orgTableName?: SortOrder
    targetDate?: SortOrder
    horizonMonths?: SortOrder
    actualValue?: SortOrder
    forecastValue?: SortOrder
    differenceValue?: SortOrder
    errorType?: SortOrder
    duplicateStatus?: SortOrder
    rawRecordCount?: SortOrder
    duplicateCount?: SortOrder
    lineageJson?: SortOrder
    metadataJson?: SortOrder
    lastSyncedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deletedAt?: SortOrder
  }

  export type DrForecastAccuracyRecordAvgOrderByAggregateInput = {
    horizonMonths?: SortOrder
    actualValue?: SortOrder
    forecastValue?: SortOrder
    differenceValue?: SortOrder
    rawRecordCount?: SortOrder
    duplicateCount?: SortOrder
  }

  export type DrForecastAccuracyRecordMaxOrderByAggregateInput = {
    id?: SortOrder
    organizationId?: SortOrder
    sourceId?: SortOrder
    datasetId?: SortOrder
    pipelineId?: SortOrder
    latestRunId?: SortOrder
    dedupeKey?: SortOrder
    benchmarkCode?: SortOrder
    sourceTableName?: SortOrder
    orgTableName?: SortOrder
    targetDate?: SortOrder
    horizonMonths?: SortOrder
    actualValue?: SortOrder
    forecastValue?: SortOrder
    differenceValue?: SortOrder
    errorType?: SortOrder
    duplicateStatus?: SortOrder
    rawRecordCount?: SortOrder
    duplicateCount?: SortOrder
    lastSyncedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deletedAt?: SortOrder
  }

  export type DrForecastAccuracyRecordMinOrderByAggregateInput = {
    id?: SortOrder
    organizationId?: SortOrder
    sourceId?: SortOrder
    datasetId?: SortOrder
    pipelineId?: SortOrder
    latestRunId?: SortOrder
    dedupeKey?: SortOrder
    benchmarkCode?: SortOrder
    sourceTableName?: SortOrder
    orgTableName?: SortOrder
    targetDate?: SortOrder
    horizonMonths?: SortOrder
    actualValue?: SortOrder
    forecastValue?: SortOrder
    differenceValue?: SortOrder
    errorType?: SortOrder
    duplicateStatus?: SortOrder
    rawRecordCount?: SortOrder
    duplicateCount?: SortOrder
    lastSyncedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    deletedAt?: SortOrder
  }

  export type DrForecastAccuracyRecordSumOrderByAggregateInput = {
    horizonMonths?: SortOrder
    actualValue?: SortOrder
    forecastValue?: SortOrder
    differenceValue?: SortOrder
    rawRecordCount?: SortOrder
    duplicateCount?: SortOrder
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

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type NullableDecimalFieldUpdateOperationsInput = {
    set?: Decimal | DecimalJsLike | number | string | null
    increment?: Decimal | DecimalJsLike | number | string
    decrement?: Decimal | DecimalJsLike | number | string
    multiply?: Decimal | DecimalJsLike | number | string
    divide?: Decimal | DecimalJsLike | number | string
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

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type DecimalFieldUpdateOperationsInput = {
    set?: Decimal | DecimalJsLike | number | string
    increment?: Decimal | DecimalJsLike | number | string
    decrement?: Decimal | DecimalJsLike | number | string
    multiply?: Decimal | DecimalJsLike | number | string
    divide?: Decimal | DecimalJsLike | number | string
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
import { ComparisonOperator, Enums, Env, Logger } from '@juicyllama/utils'
import { castArray, isNil, omitBy } from 'lodash'
import {
    And,
    DeepPartial,
    Equal,
    FindManyOptions,
    FindOneOptions,
    FindOperator,
    FindOptionsWhere,
    FindOptionsWhereProperty,
    InsertResult,
    IsNull,
    LessThan,
    LessThanOrEqual,
    Like,
    MoreThan,
    MoreThanOrEqual,
    Not,
    ObjectLiteral,
    Repository,
} from 'typeorm'

import { Entries, TypeOrm } from './TypeOrm'
import { BulkUploadResponse, ImportMode } from './common'

const logger = new Logger()

export class Query<T extends ObjectLiteral> {
    /**
     * Perform a raw SQL query
     * @param repository
     * @param sql
     */

    async raw(repository: Repository<T>, sql: string): Promise<unknown[]> {
        logger.verbose(sql, {
            context: ['@juicyllama/typeorm', 'raw', repository.metadata.tableName],
        })
        return await repository.query(sql)
    }

    async create(repository: Repository<T>, data: DeepPartial<T>, relations: string[] = []): Promise<T> {
        logger.verbose(`[CREATE][${repository.metadata.tableName}]`, {
            context: ['@juicyllama/typeorm', 'create', repository.metadata.tableName],
            params: data,
        })

        try {
            const record = repository.create(data)
            const result = await repository.save(record)

            const createdRecord = relations?.length
                ? await this.findOneById(repository, this.getRecordId(repository, result), relations)
                : result

            logger.verbose(`[CREATE][${repository.metadata.tableName}] Result:`, {
                context: ['@juicyllama/typeorm', 'create', repository.metadata.tableName],
                params: createdRecord,
            })

            return createdRecord
        } catch (e: unknown) {
            this.logCreateError(e instanceof Error ? e : new Error(String(e)), repository, data)
            throw e
        }
    }

    /**
     * Upsert a record
     * @param repository
     * @param data
     */

    async upsert(repository: Repository<T>, data: DeepPartial<T>, dedup_field: string): Promise<InsertResult> {
        logger.verbose(`Upsert`, {
            context: ['@juicyllama/typeorm', 'upsert', repository.metadata.tableName],
            params: data,
        })

        const fields: string[] = []

        for (const field of Object.keys(data)) {
            if (field === dedup_field) continue
            fields.push(field)
        }

        return await repository
            .createQueryBuilder()
            .insert()
            .into(repository.metadata.tableName)
            .values(data)
            .orUpdate(fields, [dedup_field])
            .execute()
    }

    async bulk(
        repository: Repository<T>,
        data: DeepPartial<T>[],
        import_mode: ImportMode,
        dedup_field?: string
    ): Promise<BulkUploadResponse> {
        logger.verbose(`bulk import`, {
            context: ['@juicyllama/typeorm', 'bulk', repository.metadata.tableName, import_mode],
            params: {
                records: data.length,
                first_record: data[0],
                last_record: data[data.length - 1],
            },
        })

        let result: BulkUploadResponse | undefined = undefined

        switch (import_mode) {
            case ImportMode.CREATE:
                result = await this.createBulkRecords(repository, data)
                break

            case ImportMode.UPSERT:
                if (!dedup_field) {
                    throw new Error('Dedup field required for update')
                }

                result = await this.upsertBulkRecords(repository, data, dedup_field)
                break

            case ImportMode.DELETE:
                if (!dedup_field) {
                    throw new Error('Dedup field required for update')
                }
                result = await this.deleteBulkRecords(repository, data, dedup_field)
                break

            case ImportMode.REPOPULATE:
                await this.copyTable(repository)
                await this.truncate(repository)
                try {
                    result = await this.createBulkRecords(repository, data)
                    await this.dropTable(repository, `${repository.metadata.tableName}_COPY`)
                } catch (e: unknown) {
                    const error = e instanceof Error ? e : new Error(String(e))
                    logger.error(error.message, {
                        context: ['@juicyllama/typeorm', 'bulk', repository.metadata.tableName, import_mode],
                        params: error,
                    })
                    await this.restoreTable(repository)
                }
                break
            default:
                throw new Error(`${import_mode} is not a supported import mode`)
        }

        if (!result) {
            throw new Error('Failed to upsert')
        }

        logger.verbose(`Result:`, {
            context: ['@juicyllama/typeorm', 'bulk', repository.metadata.tableName, import_mode],
            params: result,
        })
        return result
    }

    /**
     * Find record by primary key id
     * @param {Repository} repository
     * @param {id} id
     * @param {string[]} [relations]
     */

    async findOneById(repository: Repository<T>, id: number | string, relations?: string[]): Promise<T | null> {
        logger.verbose(`[FIND][ONE][${repository.metadata.tableName}]`, {
            context: ['@juicyllama/typeorm', 'findOneById', repository.metadata.tableName],
            params: {
                [this.getPrimaryKey(repository)]: id,
            },
        })

        const where: FindOptionsWhere<T> = {}
        where[this.getPrimaryKey(repository)] = id as T[keyof T]

        const result = await this.findOne(repository, {
            where: where,
            relations: relations?.length ? relations : this.getRelations(repository),
        })

        if (Env.IsNotProd()) {
            logger.verbose(`Result`, {
                context: ['@juicyllama/typeorm', 'findOneById', repository.metadata.tableName],
                params: result,
            })
        }

        return result
    }

    /**
     * Find record by params
     * @param {Repository} repository
     * @param {FindOptionsWhere<T>[] | FindOptionsWhere<T>} where
     * @param {FindManyOptions} options
     */

    async findOneByWhere(
        repository: Repository<T>,
        where: FindOptionsWhere<T>[] | FindOptionsWhere<T>,
        options?: FindManyOptions
    ): Promise<T | null> {
        options = TypeOrm.findOneOptionsWrapper<T>(repository, options)

        logger.verbose(`[FIND][ONE][${repository.metadata.tableName}]`, {
            context: ['@juicyllama/typeorm', 'findOneByWhere', repository.metadata.tableName],
            params: options,
        })

        const result = await this.findOne(repository, {
            ...options,
            where: where,
        })

        logger.verbose(`[FIND][ONE][${repository.metadata.tableName}] Result:`, {
            context: ['@juicyllama/typeorm', 'findOneByWhere', repository.metadata.tableName],
            params: result,
        })
        return result
    }

    /**
     * Find single record
     * @param repository
     * @param options
     */

    async findOne(repository: Repository<T>, options?: FindOneOptions): Promise<T | null> {
        logger.verbose(`[FIND][ONE][${repository.metadata.tableName}]`, {
            params: options,
            context: ['@juicyllama/typeorm', 'findOne', repository.metadata.tableName],
        })

        options = TypeOrm.findOneOptionsWrapper<T>(repository, options)

        const result = await repository.findOne(options)

        logger.verbose(`[FIND][ONE][${repository.metadata.tableName}] Result:`, {
            context: ['@juicyllama/typeorm', 'findOne', repository.metadata.tableName],
            params: result,
        })

        return result
    }

    /**
     * Find multiple records
     * @param repository
     * @param options
     */

    async findAll(repository: Repository<T>, options?: FindManyOptions): Promise<T[]> {
        logger.verbose(`[FIND][ALL][${repository.metadata.tableName}]`, {
            params: options,
            context: ['@juicyllama/typeorm', 'findAll', repository.metadata.tableName],
        })

        options = TypeOrm.findAllOptionsWrapper<T>(repository, options)
        const result = await repository.find(options)

        logger.verbose(`[FIND][ALL][${repository.metadata.tableName}] Result:`, {
            first: result[0],
            last: result[result.length - 1],
            context: ['@juicyllama/typeorm', 'findAll', repository.metadata.tableName],
        })

        return result
    }

    /**
     * Update a record - must include primary_key for lookup
     * @param repository
     * @param data
     * @param relations - specify any relations you would like to return with the result
     */

    async update(repository: Repository<T>, data: DeepPartial<T>, relations: string[] = []): Promise<T> {
        logger.verbose(`[UPDATE][${repository.metadata.tableName}]`, {
            params: data,
            context: ['@juicyllama/typeorm', 'update', repository.metadata.tableName],
        })

        const recordId = this.getRecordId(repository, data)
        if (!recordId) {
            throw new Error(
                `Primary key ${
                    this.getPrimaryKey(repository) as string
                } missing from update to ${repository.metadata.tableName}`
            )
        }

        try {
            //await repository.update(this.getRecordId(repository, data), data as any)
            const entity = repository.create(data as any)
            await repository.save(entity)

            const updatedRecord = await this.findOneById(repository, recordId, relations)
            if (!updatedRecord) {
                throw new Error(`Updated record ${repository.metadata.tableName} with id ${recordId} not found`)
            }

            return updatedRecord
        } catch (e: unknown) {
            this.logUpdateError(e instanceof Error ? e : new Error(String(e)), repository, data)
            throw e
        }
    }

    /**
     * Counts records
     * @param repository
     * @param options
     */

    async count(repository: Repository<T>, options?: FindManyOptions): Promise<number> {
        logger.verbose(`[COUNT][${repository.metadata.tableName}]`, {
            params: options,
            context: ['@juicyllama/typeorm', 'count', repository.metadata.tableName],
        })

        options = TypeOrm.findAllOptionsWrapper<T>(repository, options)
        return await repository.count(options)
    }

    /**
     * Sum records
     * @param repository
     * @param metric
     * @param options
     */

    async sum(repository: Repository<T>, metric: string, options?: FindManyOptions<T>): Promise<number> {
        logger.verbose(`[SUM][${repository.metadata.tableName}]`, {
            metric: metric,
            params: options,
            context: ['@juicyllama/typeorm', 'sum', repository.metadata.tableName],
        })

        options = TypeOrm.findAllOptionsWrapper<T>(repository, options)

        const result = await repository
            .createQueryBuilder()
            .where(options.where)
            .select(`SUM(${metric}) as sum`)
            .execute()

        return Number(Number(result[0].sum).toFixed(2))
    }

    /**
     * Avg records
     * @param repository
     * @param metric
     * @param options
     */

    async avg(repository: Repository<T>, metric: string, options?: FindManyOptions<T>): Promise<number> {
        logger.verbose(`[AVG][${repository.metadata.tableName}]`, {
            metric: metric,
            params: options,
            context: ['@juicyllama/typeorm', 'avg', repository.metadata.tableName],
        })

        options = TypeOrm.findAllOptionsWrapper<T>(repository, options)

        const result = await repository
            .createQueryBuilder()
            .where(options.where)
            .select(`AVG(${metric}) as average`)
            .execute()

        return Number(Number(result[0].average).toFixed(2))
    }

    /**
     * Soft delete record
     * @param repository
     * @param record
     */

    async remove(repository: Repository<T>, record: T): Promise<T> {
        logger.verbose(`[REMOVE][${repository.metadata.tableName}]`, {
            params: record,
            context: ['@juicyllama/typeorm', 'remove', repository.metadata.tableName],
        })

        await repository.softRemove(record)
        return record
    }

    /**
     * Purge record
     * @param repository
     * @param record
     */

    async purge(repository: Repository<T>, record: T): Promise<void> {
        logger.verbose(`[PURGE][${repository.metadata.tableName}]`, {
            params: record,
            context: ['@juicyllama/typeorm', 'purge', repository.metadata.tableName],
        })

        await repository.remove(record)
    }

    /**
     * Remove all records form a table
     * @param repository
     */

    async truncate(repository: Repository<T>): Promise<void> {
        logger.verbose(`[TRUNCATE][${repository.metadata.tableName}]`, {
            context: ['@juicyllama/typeorm', 'truncate', repository.metadata.tableName],
        })

        const sql_delete = 'DELETE FROM ' + repository.metadata.tableName

        await this.raw(repository, sql_delete)

        const sql_auto_increment = 'ALTER TABLE ' + repository.metadata.tableName + ' AUTO_INCREMENT = 1'

        await this.raw(repository, sql_auto_increment)
    }

    /**
     * Create a copy of a whole table
     * @param repository
     * @param table_name
     */

    async copyTable(repository: Repository<T>, table_name?: string): Promise<void> {
        logger.verbose(`[COPY][TABLE][${repository.metadata.tableName}]`, {
            table_name: table_name,
            context: ['@juicyllama/typeorm', 'copyTable', repository.metadata.tableName],
        })

        await this.dropTable(repository, table_name ?? repository.metadata.tableName + '_COPY')

        const sql_copy = `CREATE TABLE ${
            table_name ?? repository.metadata.tableName + '_COPY'
        } LIKE ${repository.metadata.tableName}`

        await this.raw(repository, sql_copy)

        const sql_refill = `INSERT INTO ${
            table_name ?? repository.metadata.tableName + '_COPY'
        } SELECT * FROM ${repository.metadata.tableName}`

        await this.raw(repository, sql_refill)
    }

    /**
     * Restore a table from a copy
     * @param repository
     * @param table_name
     */

    async restoreTable(repository: Repository<T>, table_name?: string): Promise<void> {
        logger.verbose(`Restore Table`, {
            table_name: table_name,
            context: ['@juicyllama/typeorm', 'restoreTable', repository.metadata.tableName],
        })

        const sql_rename = `RENAME TABLE ${repository.metadata.tableName} TO ${repository.metadata.tableName}_DELETE,
		${table_name ?? repository.metadata.tableName + '_COPY'} TO ${repository.metadata.tableName}`

        await this.raw(repository, sql_rename)
        await this.dropTable(repository, repository.metadata.tableName + '_DELETE')
    }

    /**
     * Drop a table
     * @param repository
     * @param table_name
     */

    async dropTable(repository: Repository<T>, table_name: string): Promise<void> {
        logger.verbose(`Drop Table`, {
            table_name: table_name,
            context: ['@juicyllama/typeorm', 'dropTable', repository.metadata.tableName],
        })

        const sql_drop = `DROP TABLE IF EXISTS ${table_name}`
        await this.raw(repository, sql_drop)
    }

    /**
     * @param repository
     * @returns The primary key's name of the table
     */
    getPrimaryKey(repository: Repository<T>): keyof DeepPartial<T> {
        const pk = repository.metadata.columns.find(column => column.isPrimary)?.propertyName
        if (!pk) {
            throw new Error('no primary key was found')
        }
        return pk as keyof DeepPartial<T>
    }

    /**
     *
     * @param repository
     * @param record
     * @returns The primary key's value of the record
     */
    getRecordId(repository: Repository<T>, record: DeepPartial<T>): number {
        return record[this.getPrimaryKey(repository)] as unknown as number
    }

    getTableName(repository: Repository<T>): string {
        return repository.metadata.tableName
    }

    getRelations(repository: Repository<T>): Record<string, boolean> {
        const result: Record<string, boolean> = {}

        const relations: string[] = repository.metadata.relations.map(column => {
            return column.propertyName
        })

        for (const relation of relations) {
            result[relation] = true
        }

        return result
    }

    private mapComparisonOperatorToTypeORMFindOperators<T>(op: ComparisonOperator, value: T): FindOperator<T> {
        switch (op) {
            case ComparisonOperator.GT:
                return MoreThan<T>(value)
            case ComparisonOperator.GTE:
                return MoreThanOrEqual<T>(value)
            case ComparisonOperator.LT:
                return LessThan<T>(value)
            case ComparisonOperator.LTE:
                return LessThanOrEqual<T>(value)
            case ComparisonOperator.EQ:
                return Equal<T>(value)
            case ComparisonOperator.NE:
                return Not<T>(Equal<T>(value))
            case ComparisonOperator.IS:
                return IsNull() as FindOperator<T>
            case ComparisonOperator.NNULL:
                return Not<T>(IsNull())
            default:
                throw new Error('Unsupported operator ' + String(op))
        }
    }

    buildWhere(options: {
        repository: Repository<T>
        query?: Partial<Record<'search' | keyof T | string, string | string[]>>
        account_id?: number
        account_ids?: number[]
        search_fields?: string[]
    }): FindOptionsWhere<T>[] | FindOptionsWhere<T> {
        const where = []
        const relationsProperty = options.repository.metadata.relations.map(relation => relation.propertyName)

        let whereBase: FindOptionsWhere<T> = {}
        const entries: Entries<T> = Object.entries(options.query ?? {}) as Entries<T>
        if (options.query) {
            for (const [key, value] of entries) {
                const isRelation = (key as string).includes('.')
                const k = isRelation ? (key as string).split('.')[0] : key
                if (
                    options.repository.metadata.columns.find(column => column.propertyName === k) ||
                    relationsProperty.find(r => r === k)
                ) {
                    const fieldLookupWhere: FindOperator<string>[] = castArray(value) // value may be a string or an array of strings
                        .reduce((memo: FindOperator<string>[], currentValue: string) => {
                            if (typeof currentValue !== 'string') return memo
                            // checking if value is of the form "operator:value"
                            const [operator, lookupValue] = splitStringByFirstColon(currentValue)
                            const opKeyName =
                                Enums.getKeyName(ComparisonOperator, operator.toUpperCase()) ||
                                Enums.getKeyName(ComparisonOperator, ComparisonOperator[currentValue.toUpperCase()])
                            if (opKeyName) {
                                // if operator is a valid ComparisonOperator
                                return [
                                    ...memo,
                                    this.mapComparisonOperatorToTypeORMFindOperators(
                                        ComparisonOperator[opKeyName as keyof typeof ComparisonOperator],
                                        lookupValue
                                    ),
                                ]
                            }
                            return memo
                        }, [])

                    const queryValue =
                        fieldLookupWhere.length === 1
                            ? (fieldLookupWhere[0] as keyof T extends 'toString'
                                  ? unknown
                                  : FindOptionsWhereProperty<NonNullable<T[keyof T]>, NonNullable<T[keyof T]>>)
                            : fieldLookupWhere.length > 0
                              ? (And(...fieldLookupWhere) as keyof T extends 'toString'
                                    ? unknown
                                    : FindOptionsWhereProperty<NonNullable<T[keyof T]>, NonNullable<T[keyof T]>>)
                              : (value as keyof T extends 'toString'
                                    ? unknown
                                    : FindOptionsWhereProperty<NonNullable<T[keyof T]>, NonNullable<T[keyof T]>>)
                    if (isRelation) {
                        whereBase = {
                            ...whereBase,
                            ...this.createWhereRelations(key as string, queryValue as string, relationsProperty),
                        }
                    } else {
                        whereBase = {
                            ...whereBase,
                            [key]: queryValue,
                        } as FindOptionsWhere<T>
                    }
                }
            }
        }

        if (options.query?.search?.length === 1 && options.query?.search[0] === 'undefined') {
            delete options.query.search
        }

        if (!options.query?.search || !options.search_fields) {
            return whereBase
        }

        if (options.query?.relations?.length === 1 && options.query?.relations[0] === 'undefined') {
            delete options.query.relations
        }

        for (const search of options.search_fields) {
            // behind the scenes typeORM converts the different array members to OR clauses, and ObjectLiterals to AND clauses
            let whereToMerge = {}
            const searchValue = Array.isArray(options.query.search)
                ? options.query.search.join(' ')
                : options.query.search || ''
            if (search.includes('.')) {
                whereToMerge = {
                    ...whereToMerge,
                    ...this.createWhereRelations(search, Like(`%${searchValue}%`), relationsProperty),
                }
            } else {
                whereToMerge = { ...whereToMerge, [search]: Like(`%${searchValue}%`) }
            }
            where.push({
                ...whereBase,
                ...whereToMerge,
            })
        }

        return where
    }

    findOneOptions(
        query: {
            select?: string | string[]
            relations?: string | string[]
        },
        where: FindOptionsWhere<T>[] | FindOptionsWhere<T>
    ): FindOneOptions<T> {
        let select: string[] | undefined
        let relations: string[] | undefined

        if (query.select) {
            select = typeof query.select === 'string' ? query.select.split(',') : query.select
        }

        if (query.relations) {
            relations = typeof query.relations === 'string' ? query.relations.split(',') : query.relations
        }

        const options = {
            where: where,
            relations: relations ?? null,
            select: select ?? null,
        }

        return omitBy(options, isNil)
    }

    findOptions(
        query: {
            select?: string | string[]
            relations?: string | string[]
            limit?: number
            offset?: number
            order_by?: string
            order_by_type?: string
        },
        where: FindOptionsWhere<T>[] | FindOptionsWhere<T>,
        fallback_order_column?: string
    ): FindManyOptions<T> {
        let select: string[] | undefined
        let relations: string[] | undefined

        if (query.select) {
            select = typeof query.select === 'string' ? query.select.split(',') : query.select
        }

        if (query.relations) {
            relations = typeof query.relations === 'string' ? query.relations.split(',') : query.relations
        }

        const options = {
            take: query.limit ?? 20,
            skip: query.offset ?? 0,
            order: query.order_by
                ? { [query.order_by]: query.order_by_type ?? 'ASC' }
                : { [fallback_order_column ?? 'created_at']: 'DESC' },
            select: select ?? null,
            relations: relations ?? null,
            where: where,
        }

        return omitBy(options, isNil)
    }

    /**
     * Duplicate key error
     */

    logCreateError(e: Error, repository: Repository<T>, data: DeepPartial<T>): void {
        const logger = new Logger()

        if (e.message.startsWith('Duplicate entry')) {
            logger.warn(`[SQL][CREATE] Duplicate entry: ${e.message}`, {
                repository: {
                    tableName: repository.metadata.tableName,
                },
                data: data,
                error: e,
            })
        } else {
            logger.error(`[SQL][CREATE] Error: ${e.message}`, {
                repository: {
                    tableName: repository.metadata.tableName,
                },
                data: data,
                error: {
                    message: e.message,
                    stack: e.stack,
                },
            })
        }
    }

    logUpdateError(e: Error, repository: Repository<T>, data: DeepPartial<T>): void {
        const logger = new Logger()

        if (e.message.startsWith('Duplicate entry')) {
            logger.warn(`[SQL][UPDATE] Duplicate entry: ${e.message}`, {
                repository: {
                    tableName: repository.metadata.tableName,
                },
                data: data,
                error: e,
            })
        } else {
            logger.error(`[SQL][UPDATE]  ${e.message}`, {
                repository: {
                    tableName: repository.metadata.tableName,
                },
                data: data,
                error: {
                    message: e.message,
                    stack: e.stack,
                },
            })
        }
    }

    /**
     * Inserts multiple records
     */

    async createBulkRecords(repository: Repository<T>, data: DeepPartial<T>[]): Promise<BulkUploadResponse> {
        // due to performance issues adding thousands of records at once (with possible subscribers etc), we will insert records individually
        const result: BulkUploadResponse = {
            total: data.length,
            processed: 0,
            created: 0,
            updated: 0,
            deleted: 0,
            errored: 0,
            errors: [],
            ids: [],
        }

        for (const record of data) {
            try {
                const entity = await this.create(repository, record)
                result.ids.push(entity[this.getPrimaryKey(repository)])
                result.created++
            } catch (e: unknown) {
                result.errored++
                result.errors ??= []
                result.errors.push(e instanceof Error ? e.message : String(e))
            }
            result.processed++
        }
        return result
    }

    async upsertBulkRecords(
        repository: Repository<T>,
        data: DeepPartial<T>[],
        dedup_field: string
    ): Promise<BulkUploadResponse> {
        // due to performance issues adding thousands of records at once (with possible subscribers etc), we will insert records individually

        const result: BulkUploadResponse = {
            total: data.length,
            processed: 0,
            created: 0,
            updated: 0,
            deleted: 0,
            errored: 0,
            errors: [],
            ids: [],
        }

        for (const record of data) {
            try {
                const r = await this.findOne(repository, {
                    where: {
                        [dedup_field]: record[dedup_field as keyof DeepPartial<T>],
                    },
                })

                const res = await this.upsert(repository, record, dedup_field)

                if (r) {
                    result.updated++
                } else {
                    result.created++
                }

                result.ids.push(res.identifiers[0][this.getPrimaryKey(repository).toString()])
            } catch (e: unknown) {
                result.errored++
                result.errors ??= []
                logger.debug(`[QUERY][UPSERT][${repository.metadata.tableName}] Error`)
                logger.debug(e)
                result.errors.push(e instanceof Error ? e.message : String(e))
            }
            result.processed++
        }

        return result
    }

    /*
     * Deletes records based on deduplicate fields
     */

    async deleteBulkRecords(
        repository: Repository<T>,
        data: DeepPartial<T>[],
        dedup_field: string
    ): Promise<BulkUploadResponse> {
        const result: BulkUploadResponse = {
            total: data.length,
            processed: 0,
            created: 0,
            updated: 0,
            deleted: 0,
            errored: 0,
            ids: [],
        }

        const records: unknown[] = []

        for (const row of data) {
            records.push(row[dedup_field as keyof DeepPartial<T>])
        }

        for (const record of data) {
            try {
                const r = await this.findOne(repository, {
                    where: {
                        [dedup_field]: record[dedup_field as keyof DeepPartial<T>],
                    },
                } as FindOneOptions<T>)

                if (r) {
                    await this.purge(repository, r)
                    result.deleted++
                }
            } catch (e: unknown) {
                result.errored++
                result.errors ??= []
                result.errors.push(e instanceof Error ? e.message : String(e))
            }
            result.processed++
        }

        return result
    }

    private createWhereRelations(
        keyString: string,
        value: string | FindOperator<string>,
        relations: string[]
    ): FindOptionsWhere<T> {
        const keys = keyString.split('.')

        const result: Record<string, unknown> = {}
        if (!relations.includes(keys[0])) {
            return result as FindOptionsWhere<T>
        }

        let current: Record<string, unknown> = result

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i]
            current = current[key] = {} as Record<string, unknown>
        }

        current[keys[keys.length - 1]] = value
        return result as FindOptionsWhere<T>
    }
}

function splitStringByFirstColon(inputString: string): string[] {
    const indexOfFirstColon = inputString.indexOf(':')

    if (indexOfFirstColon !== -1) {
        const key = inputString.slice(0, indexOfFirstColon)
        const value = inputString.slice(indexOfFirstColon + 1)
        return [key, value]
    } else {
        return [inputString]
    }
}

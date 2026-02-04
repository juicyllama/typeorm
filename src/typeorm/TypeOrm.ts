import { compact, isNil, omitBy } from 'lodash'
import { ColumnType, MoreThan, ObjectLiteral, Repository } from 'typeorm'
import { FindManyOptions } from 'typeorm/find-options/FindManyOptions'
import { FindOneOptions } from 'typeorm/find-options/FindOneOptions'
import { FindOptionsWhere } from 'typeorm/find-options/FindOptionsWhere'

/**
 * Helper function to:
 * * At controller level, take query, where and other settings and convert it to a FindManyOptions object
 */
export function findOptions<T extends ObjectLiteral>(
    query: any,
    where: FindOptionsWhere<T>[] | FindOptionsWhere<T>,
    default_sort: string
): FindManyOptions<T> {
    if (query.select) {
        query.select = query.select.split(',')
    }

    if (query.relations) {
        query.relations = query.relations.split(',')
    }

    const options = {
        take: query.limit ?? 20,
        skip: query.offset ?? 0,
        order: query.order_by ? { [query.order_by]: query.order_by_type ?? 'ASC' } : { [default_sort]: 'ASC' },
        select: query.select ?? null,
        relations: query.relations ?? null,
        where: where,
    }

    return omitBy(options, isNil)
}

export function findOneOptions<T extends ObjectLiteral>(
    query: any,
    where: FindOptionsWhere<T>[] | FindOptionsWhere<T>
): FindOneOptions<T> {
    if (query.select) {
        query.select = query.select.split(',')
    }

    if (query.relations) {
        query.relations = query.relations.split(',')
    }

    const options = {
        select: query.select ?? null,
        relations: query.relations ?? null,
        where: where,
    }

    return omitBy(options, isNil)
}

/**
 * Helper function to:
 *  * Make sure the options are formatted correctly
 *  * Filter out invalid select values
 */
export function findAllOptionsWrapper<T extends ObjectLiteral>(
    repository: Repository<T>,
    options?: FindManyOptions
): FindManyOptions {
    options = handleEmptyOptions(repository, options)
    options = handleEmptyWhere(repository, options)
    options = handleEmptyRelations(repository, options)
    options = filterOutInvalidSelectValues(repository, options)
    return options
}

export function findOneOptionsWrapper<T extends ObjectLiteral>(
    repository: Repository<T>,
    options?: FindManyOptions
): FindManyOptions {
    options = handleEmptyOptions(repository, options)
    options = handleEmptyRelations(repository, options)
    options = filterOutInvalidSelectValues(repository, options)
    return options
}

export function filterOutInvalidSelectValues<T extends ObjectLiteral>(
    repository: Repository<T>,
    options: FindManyOptions
): FindManyOptions {
    if (options?.select) {
        options.select = (options.select as string[]) || []
        const validSelectValues: string[] = repository.metadata.columns.map(column => column.propertyName)
        options.select = options.select.filter(
            (select: string | number | symbol) => typeof select === 'string' && validSelectValues.includes(select)
        )
    }
    return options
}

export function handleEmptyOptions<T extends ObjectLiteral>(repository: Repository<T>, options?: FindManyOptions) {
    options ??= {
        where: {
            [getPrimaryKey(repository) as string]: MoreThan(0),
        },
        order: {
            created_at: 'DESC',
        },
    }

    return options
}

export function handleEmptyWhere<T extends ObjectLiteral>(repository: Repository<T>, options?: FindManyOptions) {
    if (options) {
        options.where ??= {
            [getPrimaryKey(repository) as string]: MoreThan(0),
        }
    }

    return options
}

export function handleEmptyRelations<T extends ObjectLiteral>(
    repository: Repository<T>,
    options: FindManyOptions = {}
) {
    const relations = repository.metadata.relations.map(relation => relation.propertyName)

    options.relations ??= relations

    return options
}

/** Returns the table name of a given repository */

export function getTableName<T extends ObjectLiteral>(repository: Repository<T>) {
    return repository.metadata.tableName
}

/**
 * Returns the primary key of the given repository
 */

export function getPrimaryKey<T extends ObjectLiteral>(repository: Repository<T>): keyof T {
    const pk = repository.metadata.columns.find(column => column.isPrimary)?.propertyName
    if (!pk) {
        throw new Error('Primary key not found')
    }
    return pk
}

/**
 * Returns a unique list of column names for the given repository
 */

export function getColumnNames<T extends ObjectLiteral>(repository: Repository<T>): string[] {
    const columns = repository.metadata.columns.map(column => {
        return column.propertyName
    })

    return columns
}

/**
 * Return the column type for the given column name
 */

export function getColumnType<T extends ObjectLiteral>(repository: Repository<T>, column: string): ColumnType {
    const coll = repository.metadata.columns.find(e => e.propertyName === column)
    if (!coll) {
        throw new Error(`Column ${column} not found`)
    }
    return coll.type
}

/**
 * Return true if column can be null
 */

export function isColumnNullable<T extends ObjectLiteral>(repository: Repository<T>, column: string): boolean {
    return repository.metadata.columns.find(e => e.propertyName === column)?.isNullable ?? true // By default, a column can hold NULL values in mysql
}

/**
 * Returns unique key fields for the given repository
 */

export function getUniqueKeyFields<T extends ObjectLiteral>(repository: Repository<T>): (keyof T)[] {
    const uniques: (keyof T)[] = []

    if (repository.metadata.indices.length) {
        if (repository.metadata.indices[0]?.columnNamesWithOrderingMap) {
            const entries: Entries<T> = Object.entries(
                repository.metadata.indices[0]?.columnNamesWithOrderingMap
            ) as Entries<T>
            for (const [key] of entries) {
                uniques.push(key)
            }
        }
    }

    if (uniques.length) {
        return uniques
    }

    const unqiueKeys = compact(
        repository.metadata.uniques.map(e => Array.isArray(e.givenColumnNames) && e.givenColumnNames[0])
    )
    return unqiueKeys as (keyof T)[]
}

export const TypeOrm = {
    findOptions,
    findOneOptions,
    findAllOptionsWrapper,
    findOneOptionsWrapper,
    filterOutInvalidSelectValues,
    handleEmptyOptions,
    handleEmptyWhere,
    handleEmptyRelations,
    getTableName,
    getPrimaryKey,
    getColumnNames,
    getColumnType,
    isColumnNullable,
    getUniqueKeyFields,
}

export type Entries<T> = {
    [K in keyof T]: [K, T[K]]
}[keyof T][]

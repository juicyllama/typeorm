/**
 * TypeORM 1 removed string-array `select` and `relations`.
 * Callers still pass comma-separated query params and string arrays, so convert those here.
 */

export type FindShape = Record<string, unknown>

export function pathsToFindObject(paths: string[]): FindShape {
    const result: FindShape = {}

    for (const path of paths) {
        const parts = path
            .split('.')
            .map(part => part.trim())
            .filter(part => part.length > 0)
        if (parts.length === 0) continue

        let cursor: FindShape = result
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i]
            const leaf = i === parts.length - 1
            const existing = cursor[part]

            if (leaf) {
                if (existing === undefined) cursor[part] = true
                continue
            }

            if (typeof existing !== 'object' || existing === null) {
                cursor[part] = {}
            }
            cursor = cursor[part] as FindShape
        }
    }

    return result
}

/**
 * Accepts a comma-separated string, a string array, or an object already in TypeORM 1 form.
 * Missing values stay missing so callers can omit select or relations.
 */
export function toFindObject(value: unknown): FindShape | undefined {
    if (value == null || value === '') return undefined
    if (Array.isArray(value)) return pathsToFindObject(value.map(String))
    if (typeof value === 'string') return pathsToFindObject(value.split(','))
    if (typeof value === 'object') return value as FindShape
    return undefined
}

export function normalizeFindShape<T extends { select?: unknown; relations?: unknown }>(options: T): T {
    if (options.select != null) {
        options.select = toFindObject(options.select)
    }
    if (options.relations != null) {
        options.relations = toFindObject(options.relations)
    }
    return options
}
